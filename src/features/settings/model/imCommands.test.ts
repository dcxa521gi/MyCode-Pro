// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import {
  parseIMControlCommand,
  imChatEnabled,
  setIMChatEnabled,
} from "./imCommands";
import { handleIMAutomation } from "./imAutomations";
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
it("parses bilingual daily commands and rejects invalid times without scheduling", () => {
  expect(
    parseIMControlCommand("/自动化创建 每天 9:05 | 日报 | 汇总进展"),
  ).toEqual({
    kind: "automation-create",
    time: "09:05",
    name: "日报",
    prompt: "汇总进展",
  });
  expect(
    parseIMControlCommand("/schedule daily 25:00 | report | status"),
  ).toEqual({ kind: "help" });
  expect(parseIMControlCommand("/聊天 今天怎么样")).toEqual({
    kind: "chat",
    prompt: "今天怎么样",
  });
  expect(parseIMControlCommand("/continue abc next")).toBeNull();
  expect(parseIMControlCommand("明天能做什么")).toBeNull();
});
it("keeps everyday chat mode isolated by bot and owner", () => {
  setIMChatEnabled("wechat:one", true);
  expect(imChatEnabled("wechat:one")).toBe(true);
  expect(imChatEnabled("discord:one")).toBe(false);
  setIMChatEnabled("wechat:one", false);
  expect(imChatEnabled("wechat:one")).toBe(false);
});
const route = {
  cwd: "D:/work/demo",
  harness: "codex" as const,
  model: "codex:default",
};
it("persists a daily automation with approvals in the selected project", async () => {
  vi.mocked(invoke).mockImplementation(
    async (_cmd, args) => (args as { automation: unknown }).automation,
  );
  const text = await handleIMAutomation(
    {
      kind: "automation-create",
      name: "日报",
      prompt: "汇总进展",
      time: "09:00",
    },
    "wechat:owner",
    route,
    true,
  );
  expect(text).toContain("已创建自动化");
  expect(invoke).toHaveBeenCalledWith("automations_upsert", {
    automation: expect.objectContaining({
      cwd: route.cwd,
      enabled: true,
      runtimeMode: "supervised",
      workspaceMode: "current",
      triggers: [
        expect.objectContaining({
          kind: "time",
          scheduleKind: "daily",
          time: "09:00",
        }),
      ],
    }),
  });
});
it("does not let another sender pause a bot-created schedule", async () => {
  localStorage.setItem(
    "mycode.imAutomationOwners.v1",
    JSON.stringify({ abc: "wechat:owner" }),
  );
  const text = await handleIMAutomation(
    { kind: "automation-toggle", id: "abc", enabled: false },
    "wechat:other",
    route,
    true,
  );
  expect(text).toContain("未找到");
  expect(invoke).not.toHaveBeenCalled();
});
