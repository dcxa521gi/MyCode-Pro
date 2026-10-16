export type IMProjectCommand =
  | { kind: "list"; page: number; completedQuestion: boolean }
  | { kind: "switch"; selector: string }
  | { kind: "create"; name: string; prompt: string };

export function parseIMProjectCommand(text: string): IMProjectCommand | null {
  const value = text.trim();
  const list = value.match(/^\/(?:项目|项目列表|projects)(?:\s+(\d+))?$/i);
  if (list) return { kind: "list", page: Math.max(1, Number(list[1] || 1)), completedQuestion: false };
  if (/^(?:总共|有哪些|有多少|列出|查看|告诉我|查询|显示).{0,30}(?:项目|工程)/.test(value) || /^(?:全部|所有|已完结|已完成)(?:的)?(?:项目|工程)/.test(value))
    return { kind: "list", page: 1, completedQuestion: /已完结|已完成/.test(value) };
  const select = value.match(/^\/(?:切换项目|选择项目|switch-project)\s+(.+)$/i);
  if (select) return { kind: "switch", selector: select[1].trim() };
  const create = value.match(/^\/(?:新建项目|new-project)\s+([^|\r\n]+?)(?:\s*\|\s*([\s\S]+))?$/i);
  if (create) return { kind: "create", name: create[1].trim(), prompt: create[2]?.trim() || "" };
  return null;
}

export function formatIMProjects(paths: string[], page: number, completedQuestion: boolean, chinese = true): string {
  const size = 30;
  const start = (page - 1) * size;
  if (start >= paths.length && paths.length) return chinese ? `没有第 ${page} 页。项目共 ${paths.length} 个。` : `Page ${page} does not exist. ${paths.length} projects in total.`;
  const rows = paths.slice(start, start + size).map((path, index) => {
    const name = path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
    return `${start + index + 1}. ${name}\n   ${path}`;
  });
  return [
    completedQuestion ? (chinese ? "MyCode 尚无可靠的“项目已完结”标记，以下列出所有已登记项目：" : "MyCode has no reliable completed-project flag. Here are all registered projects:") : (chinese ? `MyCode 项目（共 ${paths.length} 个）：` : `MyCode projects (${paths.length} total):`),
    ...rows,
    paths.length > start + size ? (chinese ? `发送 /项目 ${page + 1} 查看下一页。` : `Send /projects ${page + 1} for the next page.`) : "",
    chinese ? "发送 /切换项目 编号或名称；发送 /新建项目 名称 | 需求 可创建项目并开始任务。" : "Send /switch-project number-or-name, or /new-project name | request to create and start a task.",
  ].filter(Boolean).join("\n");
}
