import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AcpEngine } from "../src/features/plugins/model/acpEngines";
import type { AgentModel } from "../src/features/sessions/model/models";

export function acpPluginRoot() {
  return (
    process.env.MYCODE_ACP_PLUGINS_DIR ||
    (process.platform === "win32"
      ? join(
          process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
          "com.monocode.desktop",
          "acp-plugins",
        )
      : join(homedir(), ".monocode-host", "acp-plugins"))
  );
}
export async function listAcpPlugins(): Promise<AcpEngine[]> {
  let entries: string[];
  try {
    entries = await readdir(acpPluginRoot());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const result: AcpEngine[] = [];
  for (const name of entries.sort()) {
    if (!/^[a-zA-Z0-9_-]{1,64}\.json$/.test(name)) continue;
    const engine: AcpEngine = JSON.parse(
      await readFile(join(acpPluginRoot(), name), "utf8"),
    );
    if (`${engine.id}.json` !== name)
      throw Error(
        "ACP manifest ID does not match its file / ACP 清单标识与文件名不符",
      );
    result.push(engine);
  }
  return result;
}
export async function acpModels(): Promise<AgentModel[]> {
  return (await listAcpPlugins())
    .filter((e) => e.enabled)
    .flatMap((e) =>
      e.accounts.flatMap((account) =>
        e.models.map((m) => ({
          id: `acp:${e.id}:${account}:${encodeURIComponent(m.id)}`,
          harness: "acp" as const,
          name: `${m.name} · ${account}`,
          provider: { id: e.id, name: e.nameZh || e.name },
        })),
      ),
    );
}
export async function acpFingerprint() {
  return createHash("sha256")
    .update(JSON.stringify(await listAcpPlugins()))
    .digest("hex");
}
export async function approvedAcpLaunch(
  value: unknown,
  env: NodeJS.ProcessEnv,
) {
  const launch = value as {
    id?: unknown;
    revision?: unknown;
    accountId?: unknown;
  };
  if (
    !launch ||
    typeof launch.id !== "string" ||
    typeof launch.accountId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(launch.id) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(launch.accountId)
  )
    throw Error("Invalid ACP launch / ACP 启动参数无效");
  const engine = (await listAcpPlugins()).find(
    (e) =>
      e.id === launch.id &&
      e.enabled &&
      e.revision === launch.revision &&
      e.accounts.includes(String(launch.accountId)),
  );
  if (!engine || !engine.integrity?.[engine.command])
    throw Error("ACP authorization changed / ACP 授权已变更");
  for (const [file, expected] of Object.entries(engine.integrity)) {
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(file)) hash.update(bytes);
    if (hash.digest("hex") !== expected)
      throw Error(
        "ACP program changed; approve the update on the execution computer / ACP 程序已变更，请在执行电脑批准更新",
      );
  }
  const directory = join(
    acpPluginRoot(),
    "accounts",
    engine.id,
    launch.accountId,
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const key of [
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
    "MYCODE_ACCOUNT_DIR",
  ])
    env[key] = directory;
  for (const key of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "CODEX_ACCESS_TOKEN",
    "CODEX_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
  ])
    delete env[key];
  return { command: engine.command, args: engine.args };
}
