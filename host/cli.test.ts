import { expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type AddressInfo } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { psQuote, runPowerShell } from "./windows";

const exec = promisify(execFile);

it(
  "starts detached, authenticates a device, revokes it, and stops independently of the launcher",
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "monocode-cli-test-"));
    const probe = createServer();
    await new Promise<void>((resolve, reject) => {
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", resolve);
    });
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    const cli = resolve("build/host/monocode-host.mjs");
    const fixtureProfile = join(directory, "profile");
    mkdirSync(fixtureProfile);
    // This lifecycle test must not scan a developer's installed CLIs or
    // profile/config files; provider transports have their own fixtures.
    const fixtureEnvironment = {
      ...process.env,
      HOME: fixtureProfile,
      USERPROFILE: fixtureProfile,
      APPDATA: join(fixtureProfile, "AppData/Roaming"),
      LOCALAPPDATA: join(fixtureProfile, "AppData/Local"),
      PATH: [
        dirname(process.execPath),
        ...(process.platform === "win32"
          ? [join(process.env.SystemRoot ?? "C:/Windows", "System32")]
          : ["/usr/bin", "/bin"]),
      ].join(delimiter),
    };
    const run = (...args: string[]) =>
      exec(
        process.execPath,
        [cli, ...args, "--data-dir", directory, "--port", String(port)],
        {
          timeout: process.platform === "win32" ? 45_000 : 10_000,
          env: fixtureEnvironment,
        },
      );
    let primaryError: unknown;
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code !== "ESRCH";
      }
    };
    const ownedProcesses = async (): Promise<number[]> => {
      const matches = (command: string) =>
        command.includes(cli) &&
        command.includes(directory) &&
        /\bserve\b/.test(command) &&
        command.includes("--data-dir") &&
        command.includes(`--port ${port}`);
      if (process.platform === "win32") {
        const json = await runPowerShell(
          `$cli=${psQuote(cli)}; $dir=${psQuote(directory)}; $port=${psQuote(`--port ${port}`)}; @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($cli) -and $_.CommandLine.Contains($dir) -and $_.CommandLine.Contains($port) -and $_.CommandLine -match '\\bserve\\b' } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`,
        );
        const value = json.trim() ? JSON.parse(json) : [];
        const rows =
          value == null ? [] : Array.isArray(value) ? value : [value];
        return rows
          .filter(
            (row) => row.ProcessId !== process.pid && matches(row.CommandLine),
          )
          .map((row) => row.ProcessId);
      }
      const { stdout } = await exec(
        "ps",
        ["-ax", "-o", "pid=", "-o", "args="],
        { timeout: 5000 },
      );
      return stdout.split("\n").flatMap((line) => {
        const row = /^\s*(\d+)\s+(.*)$/.exec(line);
        return row && Number(row[1]) !== process.pid && matches(row[2])
          ? [Number(row[1])]
          : [];
      });
    };
    try {
      // A stale legacy PID now belongs to this unrelated test process.
      writeFileSync(join(directory, "owner.lock"), String(process.pid));
      expect((await run("start")).stdout).toContain("Host started");
      const startedPid = (
        JSON.parse(readFileSync(join(directory, "running.json"), "utf8")) as {
          pid: number;
        }
      ).pid;
      expect((await run("status")).stdout).toContain("Host is running");
      await expect(run("serve")).rejects.toThrow("A host already owns");
      const before = JSON.parse((await run("connection-info")).stdout);
      // Connecting to an existing host must not install a service or restart it.
      expect(JSON.parse((await run("service", "install")).stdout)).toEqual(
        before,
      );
      const device = JSON.parse(
        (await run("pair", "--name", "Test laptop")).stdout,
      ) as { id: string; token: string; environmentId: string };
      const describe = () =>
        fetch(`http://127.0.0.1:${port}/rpc`, {
          method: "POST",
          headers: { Authorization: `Bearer ${device.token}` },
          body: JSON.stringify({
            version: 1,
            method: "environment.describe",
            params: {},
          }),
        });
      const response = await describe();
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { result: { environmentId: string } })
          .result.environmentId,
      ).toBe(device.environmentId);
      if (process.platform !== "win32") {
        expect(statSync(directory).mode & 0o777).toBe(0o700);
        expect(statSync(join(directory, "running.json")).mode & 0o777).toBe(
          0o600,
        );
      }
      await run("revoke", device.id);
      await expect(run("revoke", device.id)).rejects.toThrow(
        "Device not found",
      );
      expect((await describe()).status).toBe(401);
      expect((await run("stop")).stdout).toContain("Host is stopping");
      await vi.waitFor(() =>
        expect(existsSync(join(directory, "running.json"))).toBe(false),
      );
      expect((await run("status")).stdout).toContain("Host is stopped");
      await vi.waitFor(() => expect(alive(startedPid)).toBe(false), {
        timeout: 10_000,
      });
    } catch (error) {
      primaryError = error;
      writeFileSync(
        resolve("build/020-host-cli-primary-error.log"),
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      if (existsSync(join(directory, "host.log")))
        copyFileSync(
          join(directory, "host.log"),
          resolve("build/019-host-launcher-error.log"),
        );
      throw error;
    } finally {
      try {
        // A timed-out launcher can leave a detached child before running.json
        // is published. Match its actual command and owned fixture directory.
        const owned = await ownedProcesses();
        if (owned.length) {
          await run("stop").catch(() => undefined);
          for (const pid of owned) {
            try {
              await vi.waitFor(() => expect(alive(pid)).toBe(false), {
                timeout: 5000,
              });
            } catch {
              if ((await ownedProcesses()).includes(pid))
                process.kill(pid, "SIGTERM");
            }
            await vi.waitFor(() => expect(alive(pid)).toBe(false), {
              timeout: 5000,
            });
          }
        }
        rmSync(directory, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      } catch (cleanupError) {
        if (primaryError)
          throw new AggregateError(
            [primaryError, cleanupError],
            "Host test failed and fixture cleanup also failed",
          );
        throw cleanupError;
      }
    }
  },
  process.platform === "win32" ? 120_000 : 20_000,
);
