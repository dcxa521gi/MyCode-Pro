import { getLocale } from "../../../shared/i18n";

export const OFFICE_SKILLS = [
  {
    name: "mycode-documents",
    description: "Organize local documents and extract actionable summaries.",
    zh: "整理本地文档并提取摘要与待办。",
    body: "Inspect only the files the user selects in the current workspace. Summarize key facts, sources and actionable items. Preserve originals. Propose a folder/index structure before moving anything; never delete files automatically. Write results as Markdown in the workspace. Do not upload documents or send messages without explicit authorization.",
    bodyZh:
      "只检查用户在当前工作区选择的文件。提取关键事实、来源与待办，并保留原文件。移动文件前先提出目录或索引方案；不自动删除文件。将结果以 Markdown 保存到工作区。未经明确授权，不上传文档或发送消息。",
  },
  {
    name: "mycode-project-memory",
    description: "Review project changes and draft durable project knowledge.",
    zh: "梳理项目变更并起草可复用的项目知识。",
    body: "Read repository guidance and recent changes. Identify stable architecture, commands, decisions and constraints with file references. Compare against existing documentation. Draft concise project memory and flag uncertain or outdated facts. Do not treat generated assumptions as verified facts. Ask the user to review the draft before replacing existing knowledge.",
    bodyZh:
      "阅读仓库规范与近期变更。结合文件来源，提取稳定的架构、命令、决策与约束，并对照已有文档。起草简洁的项目记忆，标明不确定或过时的事实，不把推测当成已验证事实。替换既有知识前，请用户审阅草稿。",
  },
  {
    name: "mycode-work-report",
    description:
      "Create an evidence-based work report from local files and Git history.",
    zh: "根据本地文件和 Git 历史生成有依据的工作报告。",
    body: "Use the requested time window and local Git history or documents. Separate completed, in-progress and blocked work. Include important outcomes, next steps and unresolved validation. Keep the report concise and cite files or commits. Save a Markdown draft locally. Never invent completion, test results or delivery status, and do not publish or send the report automatically.",
    bodyZh:
      "根据用户指定的时间范围，读取本地 Git 历史或文档，区分已完成、进行中和受阻的工作。简洁说明主要成果、下一步和未完成的验证，并引用文件或提交。在本地保存 Markdown 草稿。不虚构完成情况、测试结果或交付状态，不自动发布或发送报告。",
  },
] as const;

export function officeSkillBody(name: string): string | undefined {
  const skill = OFFICE_SKILLS.find((s) => s.name === name);
  return skill
    ? getLocale() === "zh-CN"
      ? skill.bodyZh
      : skill.body
    : undefined;
}
