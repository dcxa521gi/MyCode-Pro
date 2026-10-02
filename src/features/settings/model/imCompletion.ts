export const IM_CHANNELS = [
  "wechat",
  "feishu",
  "dingtalk",
  "wecom",
  "telegram",
  "discord",
] as const;
export type IMCompletionSettings = {
  channels: string[];
  remoteContinue: boolean;
};
const KEY = "mycode.im-completion";
export function loadIMCompletion(): IMCompletionSettings {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      channels: Array.isArray(value.channels)
        ? value.channels.filter(
            (c: unknown) =>
              typeof c === "string" &&
              IM_CHANNELS.includes(c as (typeof IM_CHANNELS)[number]),
          )
        : [],
      remoteContinue: value.remoteContinue === true,
    };
  } catch {
    return { channels: [], remoteContinue: false };
  }
}
export function saveIMCompletion(value: IMCompletionSettings) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export function completionMessage(
  project: string,
  title: string,
  sessionId: string,
  text: string,
  remoteContinue: boolean,
  chinese: boolean,
): string {
  const summary = text.trim().slice(-3000);
  return chinese
    ? `MyCode · 任务已完成\n项目：${project}\n会话：${title}\n\n${summary || "本轮已完成，请在桌面查看结果。"}\n\n${remoteContinue ? `回复 /continue ${sessionId} 你的下一步要求，可继续本会话。` : "远程继续未开启；可在设置 → 会话中开启。"}`
    : `MyCode · Task completed\nProject: ${project}\nSession: ${title}\n\n${summary || "This turn completed. Review the result in MyCode."}\n\n${remoteContinue ? `Reply /continue ${sessionId} your next instruction to continue this session.` : "Remote continuation is off. Enable it in Settings → Chat."}`;
}
