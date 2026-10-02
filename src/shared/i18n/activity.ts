import { getLocale, translate } from ".";

/** Translate app-owned activity grammar; filenames, commands and agent prose stay intact. */
export function translateActivity(text: string): string {
  if (getLocale() !== "zh-CN") return text;
  return text
    .split(" · ")
    .map((part) => {
      const exact = translate(part);
      if (exact !== part) return exact;
      const verbs: Record<string, string> = {
        Editing: "正在编辑",
        Edited: "已编辑",
        Reading: "正在读取",
        Read: "已读取",
        Running: "正在运行",
        Ran: "已运行",
        Searching: "正在搜索",
        Searched: "已搜索",
        Exploring: "正在查看",
        Explored: "已查看",
        Edit: "编辑",
        Write: "写入",
        Shell: "命令",
        Writing: "正在写入",
        Wrote: "已写入",
        List: "列出",
        Glob: "查找",
        Grep: "搜索",
        Execute: "执行",
        Accepted: "已允许",
        Rejected: "已拒绝",
        Pending: "等待确认",
      };
      const match = part.match(
        /^(Editing|Edited|Reading|Read|Running|Ran|Searching|Searched|Exploring|Explored|Edit|Write|Writing|Wrote|Shell|List|Glob|Grep|Execute)\b(?:\s+(.*))?$/,
      );
      if (!match) return part;
      let detail = match[2] ?? "";
      detail = detail.replace(
        /^(\d+) (files|commands|subagents|tools)$/,
        (_, n: string, unit: string) =>
          `${n} ${({ files: "个文件", commands: "条命令", subagents: "个子智能体", tools: "个工具" } as Record<string, string>)[unit]}`,
      );
      return `${verbs[match[1]]}${detail ? " " + detail : ""}`;
    })
    .join(" · ");
}
