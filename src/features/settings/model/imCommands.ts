/** Shared with the local transport so commands never inherit a notification's task. */
export type IMControlCommand =
  | { kind: "chat"; prompt: string }
  | { kind: "task"; prompt: string }
  | { kind: "automations" }
  | { kind: "automation-create"; time: string; name: string; prompt: string }
  | { kind: "automation-toggle"; id: string; enabled: boolean }
  | { kind: "help" };

export function parseIMControlCommand(text: string): IMControlCommand | null {
  const value = text.trim();
  const mode = value.match(/^\/(聊天|chat|任务|task)(?:\s+([\s\S]+))?$/i);
  if (mode)
    return {
      kind: /^(聊天|chat)$/i.test(mode[1]) ? "chat" : "task",
      prompt: mode[2]?.trim() ?? "",
    };
  if (/^\/(自动化|自动化列表|automations)$/i.test(value))
    return { kind: "automations" };
  const create = value.match(
    /^\/(?:自动化创建|schedule)\s+(?:每天|daily)\s+([01]?\d|2[0-3]):([0-5]\d)\s*\|\s*([^|\r\n]{1,100})\s*\|\s*([\s\S]{1,16000})$/i,
  );
  if (create && create[3].trim() && create[4].trim())
    return {
      kind: "automation-create",
      time: `${create[1].padStart(2, "0")}:${create[2]}`,
      name: create[3].trim(),
      prompt: create[4].trim(),
    };
  const toggle = value.match(
    /^\/(暂停自动化|恢复自动化|pause-automation|resume-automation)\s+([a-z\d-]+)$/i,
  );
  if (toggle)
    return {
      kind: "automation-toggle",
      id: toggle[2],
      enabled: /^(恢复自动化|resume-automation)$/i.test(toggle[1]),
    };
  if (
    /^\/(帮助|help|自动化创建|schedule|暂停自动化|恢复自动化|pause-automation|resume-automation)(?:\s|$)/i.test(
      value,
    )
  )
    return { kind: "help" };
  return null;
}

export function imControlHelp(chinese: boolean): string {
  return chinese
    ? "MyCode 命令：\n/聊天 [内容]：切换独立日常聊天\n/任务 [内容]：返回项目任务\n/项目：列出项目\n/切换项目 编号或名称\n/自动化：查看由你通过机器人创建的任务\n/自动化创建 每天 09:00 | 名称 | 任务内容\n/暂停自动化 任务ID\n/恢复自动化 任务ID\n定时任务使用电脑本地时间；电脑和 MyCode 需保持运行，工具审批在桌面处理。"
    : "MyCode commands:\n/chat [message]: separate everyday chat\n/task [message]: return to project tasks\n/projects\n/switch-project number-or-name\n/automations: your bot-created schedules\n/schedule daily 09:00 | Name | Task\n/pause-automation ID\n/resume-automation ID\nSchedules use this computer's local time. Keep MyCode running; tool approvals remain on the desktop.";
}

const CHAT_KEY = "mycode.imChatModes.v1";
export function imChatEnabled(owner: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}")[owner] === true;
  } catch {
    return false;
  }
}
export function setIMChatEnabled(owner: string, enabled: boolean): void {
  let modes: Record<string, boolean> = {};
  try {
    modes = JSON.parse(localStorage.getItem(CHAT_KEY) || "{}");
  } catch {
    /* recover malformed preferences */
  }
  localStorage.setItem(
    CHAT_KEY,
    JSON.stringify({ ...modes, [owner]: enabled }),
  );
}
