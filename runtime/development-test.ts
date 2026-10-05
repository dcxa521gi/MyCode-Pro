import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function batchLine(binary: string, args: string[]) {
  const values = [binary, ...args];
  if (values.some((v) => /["&|<>^%!\r\n]/.test(v)))
    throw Error("Unsupported Windows batch argument");
  return '"' + values.map((v) => '"' + v + '"').join(" ") + '"';
}
async function run(
  binary: string,
  args: string[],
  cwd: string,
  detached = false,
) {
  const bat = process.platform === "win32" && /\.(bat|cmd)$/i.test(binary);
  const child = spawn(
    bat ? "cmd.exe" : binary,
    bat ? ["/D", "/S", "/C", batchLine(binary, args)] : args,
    {
      cwd,
      windowsHide: true,
      windowsVerbatimArguments: bat,
      stdio: detached ? "ignore" : ["ignore", "pipe", "pipe"],
    },
  );
  if (detached) {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    return "Started";
  }
  return await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Developer tool timed out"));
    }, 180000);
    const collect = (part: Buffer) => {
      output = (output + part.toString()).slice(-64000);
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output)
        : reject(Error(output || `Tool exited ${code}`));
    });
  });
}
export async function connectRpc(port: number) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
    handshakeTimeout: 2000,
    maxPayload: 12 * 1024 * 1024,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const requests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const exceptions: unknown[] = [];
  socket.on("message", (data) => {
    try {
      const value = JSON.parse(data.toString());
      if (value.method === "App.exceptionThrown") exceptions.push(value.params);
      const pending = requests.get(value.id);
      if (!pending) return;
      requests.delete(value.id);
      clearTimeout(pending.timer);
      value.error
        ? pending.reject(Error(value.error.message || "Automation failed"))
        : pending.resolve(value.result);
    } catch {
      /* Reject by bounded request timeout for malformed data. */
    }
  });
  const fail = () => {
    for (const request of requests.values()) {
      clearTimeout(request.timer);
      request.reject(Error("Automation connection closed"));
    }
    requests.clear();
  };
  socket.on("close", fail);
  socket.on("error", fail);
  return {
    exceptions,
    close: () => socket.close(),
    call: (method: string, params: unknown = {}) =>
      new Promise<any>((resolve, reject) => {
        const id = randomUUID(),
          timer = setTimeout(() => {
            requests.delete(id);
            reject(Error(`Automation timed out: ${method}`));
          }, 15000);
        requests.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      }),
  };
}
async function wechat(
  cwd: string,
  tools: Record<string, string>,
  folder: string,
) {
  await fs.access(path.join(cwd, "project.config.json"));
  const port = await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
  await run(
    tools.wechat,
    ["auto", "--project", cwd, "--auto-port", String(port)],
    cwd,
    true,
  );
  let rpc: Awaited<ReturnType<typeof connectRpc>> | undefined;
  for (let i = 0; i < 60; i++) {
    try {
      rpc = await connectRpc(port);
      break;
    } catch {
      await wait(1000);
    }
  }
  if (!rpc)
    throw Error(
      "WeChat automation unavailable. Enable CLI service, log in and approve the project in DevTools.",
    );
  try {
    await rpc.call("Tool.getInfo");
    await rpc.call("App.enableLog");
    await wait(2000);
    let spec: {
      pages?: string[];
      checks?: { method: string; params?: unknown; expected?: unknown }[];
    } = {};
    try {
      spec = JSON.parse(
        await fs.readFile(path.join(cwd, ".mycode/wechat-tests.json"), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const results = [];
    for (const route of spec.pages?.length ? spec.pages : [null]) {
      if (route) {
        await rpc.call("App.callWxMethod", {
          method: "reLaunch",
          args: [{ url: route }],
        });
        await wait(1500);
      }
      const page = await rpc.call("App.getCurrentPage");
      if (!page?.path) throw Error("Simulator has no active page");
      const shot = await rpc.call("App.captureScreenshot");
      if (typeof shot?.data !== "string")
        throw Error("Simulator did not return a screenshot");
      const file = path.join(folder, `page-${results.length + 1}.png`);
      await fs.writeFile(file, Buffer.from(shot.data, "base64"));
      results.push({ path: page.path, screenshot: file });
    }
    for (const check of spec.checks || []) {
      if (typeof check.method !== "string" || !/^(Page|Element)\.[A-Za-z]+$/.test(check.method))
        throw Error("Configured assertions must use local Page or Element methods");
      const actual = await rpc.call(check.method, check.params);
      if (
        check.expected !== undefined &&
        JSON.stringify(actual) !== JSON.stringify(check.expected)
      )
        throw Error(`Assertion failed: ${check.method}`);
    }
    if (rpc.exceptions.length)
      throw Error(
        `Simulator reported ${rpc.exceptions.length} runtime exceptions`,
      );
    return {
      kind: "wechat-simulator",
      pages: results,
      checks: spec.checks?.length || 0,
      scope: spec.checks?.length
        ? "configured assertions"
        : "current page smoke check",
    };
  } finally {
    rpc.close();
  }
}
async function harmony(
  cwd: string,
  tools: Record<string, string>,
  folder: string,
) {
  await fs.access(path.join(cwd, "build-profile.json5"));
  const spec = JSON.parse(
    await fs.readFile(path.join(cwd, ".mycode/harmony-tests.json"), "utf8"),
  );
  for (const key of ["bundle", "module"])
    if (typeof spec[key] !== "string" || !spec[key].match(/^[\w.]+$/))
      throw Error(`Configure ${key} in .mycode/harmony-tests.json`);
  if (spec.runner && !/^[\w.]+$/.test(spec.runner))
    throw Error("Invalid Hypium runner");
  const instances = JSON.parse(
    await run(tools.emulator, ["-list", "-details"], cwd),
  );
  const choices = instances.filter(
    (v: any) => !spec.emulator || v.name === spec.emulator,
  );
  if (choices.length !== 1)
    throw Error("Choose one installed emulator in .mycode/harmony-tests.json");
  const instance = choices[0];
  const port = Number(spec.port || 10021);
  if (!Number.isInteger(port) || port < 10000 || port > 16555)
    throw Error("Invalid emulator hdc port");
  if (instance.isRunning !== "true" && instance.isRunning !== true)
    await run(
      tools.emulator,
      [
        "-start",
        instance.name,
        "-instancePath",
        path.dirname(instance.instancePath),
        "-imageRoot",
        instance.imageRoot,
        "-hdcPort",
        String(port),
      ],
      cwd,
      true,
    );
  const target = `127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      await run(tools.hdc, ["tconn", target], cwd);
      const targets = await run(tools.hdc, ["list", "targets"], cwd);
      if (targets.split(/\s+/).includes(target)) {
        ready = true;
        break;
      }
    } catch {}
    await wait(1000);
  }
  if (!ready)
    throw Error(
      "Emulator did not become available. Check image compatibility and accepted SDK agreements in DevEco.",
    );
  for (const key of ["hap", "testHap"]) {
    const file = await fs.realpath(path.resolve(cwd, spec[key] || ""));
    const relative = path.relative(await fs.realpath(cwd), file);
    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      !file.endsWith(".hap")
    )
      throw Error("Test HAP must be inside the selected project");
    await run(tools.hdc, ["-t", target, "install", file], cwd);
  }
  const output = await run(
    tools.hdc,
    [
      "-t",
      target,
      "shell",
      "aa",
      "test",
      "-b",
      spec.bundle,
      "-m",
      spec.module,
      "-s",
      "unittest",
      spec.runner || "OpenHarmonyTestRunner",
      "-s",
      "timeout",
      "60000",
    ],
    cwd,
  );
  await fs.writeFile(path.join(folder, "hypium.log"), output);
  if (
    !/OK\s*\(\d+\s+tests?\)|TestFinished-Result:\s*true/i.test(output) ||
    /FAILURES|INSTRUMENTATION_FAILED|Error:/i.test(output)
  )
    throw Error(
      "Hypium did not report successful completed tests. See hypium.log.",
    );
  return { kind: "harmony-simulator", target, output };
}
export async function runDevelopmentTest(
  kind: string,
  cwd: string,
  tools: Record<string, string>,
) {
  const folder = path.join(cwd, ".mycode", "test-results", randomUUID());
  await fs.mkdir(folder, { recursive: true });
  try {
    const result =
      kind === "wechat"
        ? await wechat(cwd, tools, folder)
        : kind === "harmony"
          ? await harmony(cwd, tools, folder)
          : (() => {
              throw Error("Unsupported simulator");
            })();
    await fs.writeFile(
      path.join(folder, "result.json"),
      JSON.stringify({ success: true, ...result }, null, 2),
    );
    return result;
  } catch (error) {
    await fs.writeFile(
      path.join(folder, "result.json"),
      JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    throw error;
  }
}
if (process.argv[1] && /development-test\.(cjs|ts)$/.test(process.argv[1])) {
  const [kind, cwd, config] = process.argv.slice(2);
  runDevelopmentTest(kind, cwd, JSON.parse(config || "{}"))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
