import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { approvedAcpLaunch, acpModels } from "./acp-plugins";
const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
it("checks approved bytes on every launch and isolates account configuration without exposing tokens", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mycode-acp-"));
  directories.push(dir);
  vi.stubEnv("MYCODE_ACP_PLUGINS_DIR", dir);
  const file = join(dir, "engine.js");
  writeFileSync(file, "approved");
  const engine = {
    id: "engine",
    name: "Engine",
    nameZh: "引擎",
    version: "1",
    command: file,
    args: [],
    accounts: ["work"],
    enabled: true,
    revision: "revision",
    integrity: {
      [file]: createHash("sha256").update("approved").digest("hex"),
    },
    models: [{ id: "vendor/model", name: "Model" }],
  };
  writeFileSync(join(dir, "engine.json"), JSON.stringify(engine));
  expect((await acpModels())[0].id).toBe("acp:engine:work:vendor%2Fmodel");
  const env: NodeJS.ProcessEnv = {
    HOME: "original",
    OPENAI_API_KEY: "private",
    PATH: "preserved",
  };
  await approvedAcpLaunch(
    { id: "engine", revision: "revision", accountId: "work" },
    env,
  );
  expect(env.HOME).toBe(join(dir, "accounts", "engine", "work"));
  expect(env.APPDATA).toBe(env.HOME);
  expect(env.OPENAI_API_KEY).toBeUndefined();
  expect(env.PATH).toBe("preserved");
  writeFileSync(file, "changed");
  await expect(
    approvedAcpLaunch(
      { id: "engine", revision: "revision", accountId: "work" },
      {},
    ),
  ).rejects.toThrow(/changed|变更/);
  await expect(
    approvedAcpLaunch(
      { id: "engine", revision: "revision", accountId: "../work" },
      {},
    ),
  ).rejects.toThrow();
});
