import {
  applyTriggers,
  createAutomationTrigger,
  listAutomations,
  newAutomationDraft,
  saveAutomation,
  setAutomationEnabled,
} from "../../automations/model/automations";
import type { HarnessId } from "../../sessions/model/session";
import type { IMControlCommand } from "./imCommands";
import { imControlHelp } from "./imCommands";

const OWNER_KEY = "mycode.imAutomationOwners.v1";
function owners(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OWNER_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, owner]) => typeof owner === "string"),
    );
  } catch {
    return {};
  }
}
export async function handleIMAutomation(
  command: IMControlCommand,
  owner: string,
  route: { cwd: string; harness: HarnessId; model: string },
  chinese: boolean,
): Promise<string | null> {
  if (command.kind === "help") return imControlHelp(chinese);
  if (command.kind === "automations") {
    const ownership = owners();
    const items = (await listAutomations()).filter(
      (a) => ownership[a.id] === owner,
    );
    return items.length
      ? items
          .map(
            (a) =>
              `${a.enabled ? "▶" : "Ⅱ"} ${a.name}\n${a.id}\n${a.cwd} · ${a.time}`,
          )
          .join("\n\n")
      : chinese
        ? "你尚未通过此机器人创建自动化任务。发送 /帮助 查看创建方法。"
        : "No schedules created by you through this bot. Send /help for instructions.";
  }
  if (command.kind === "automation-create") {
    if (!route.cwd)
      return chinese
        ? "请先用 /切换项目 选择项目。"
        : "Select a project with /switch-project first.";
    // Reserve ownership before persistence so a failed local write never leaves an unmanageable schedule.
    const id = crypto.randomUUID();
    localStorage.setItem(
      OWNER_KEY,
      JSON.stringify({ ...owners(), [id]: owner }),
    );
    const saved = await saveAutomation(
      applyTriggers(
        {
          ...newAutomationDraft(route.cwd, route.harness, route.model),
          id,
          name: command.name,
          prompt: command.prompt,
          workspaceMode: "current",
          runtimeMode: "supervised",
        },
        [createAutomationTrigger("time", "daily", { time: command.time })],
      ),
    );
    return chinese
      ? `已创建自动化：${saved.name}\nID：${saved.id}\n项目：${saved.cwd}\n每天 ${command.time}（电脑本地时间）；需要工具授权时请在桌面审批。`
      : `Created: ${saved.name}\nID: ${saved.id}\nProject: ${saved.cwd}\nDaily at ${command.time} (computer local time). Approve tools on the desktop when requested.`;
  }
  if (command.kind === "automation-toggle") {
    if (owners()[command.id] !== owner)
      return chinese
        ? "未找到由你通过此机器人创建的任务，请发送 /自动化 查看。"
        : "Schedule not found for this bot owner. Send /automations.";
    const item = (await listAutomations()).find((a) => a.id === command.id);
    if (!item) return chinese ? "任务已不存在。" : "Schedule no longer exists.";
    await setAutomationEnabled(item, command.enabled);
    return `${chinese ? (command.enabled ? "已恢复" : "已暂停") : command.enabled ? "Resumed" : "Paused"}: ${item.name}`;
  }
  return null;
}
