export const mycode0250ZhCN: Record<string, string> = {
  "Enable": "启用",
  "Disable": "停用",
  "Uninstall": "卸载",
  "Account": "账号",
  "The plugin form was saved. Continue this conversation to retrieve the result.": "插件表单已保存，请继续此会话读取结果。",
  "Start time": "开始时间",
  "End time": "结束时间",
  "Remote model catalog timed out. Reconnect and retry.":
    "读取远程模型目录超时，请重新连接后重试。",
  "Local workflow plugins": "本地工作流插件",
  "Import plugin manifest": "导入插件清单",
  "Install local named workflows with native input forms. Workflow plugins supply instructions to your existing agents; they do not install provider engines or execute embedded code.":
    "安装可重复调用的本地工作流，使用原生表单填写参数。工作流插件为现有智能体提供指令，不会安装供应商引擎或执行嵌入代码。",
  "In a conversation, use /operator and ask the agent to list plugins.list, request plugins.run, and read plugins.result after you confirm the form.":
    "在会话中输入 /operator，让智能体通过 plugins.list 列出工具、plugins.run 请求表单，并在你确认后通过 plugins.result 读取结果。",
  "No local workflow plugins installed": "尚未安装本地工作流插件",
  "Review workflow instructions": "查看工作流指令",
  "Review local plugin": "检查本地插件",
  "Each invocation asks you to review its form. An update replaces only this plugin's manifest; provider credentials and conversation history are unchanged.":
    "每次调用都会请你确认表单。更新只替换此插件清单，不影响模型供应商凭据及会话历史。",
  "Install plugin": "安装插件",
  "Confirm and continue": "确认并继续",
  "Confirming sends these inputs back to this conversation. Existing file access and approval settings still apply.":
    "确认后将填写内容发送回此会话，继续遵循当前的文件访问权限与审批设置。",
  "I confirmed the plugin form. Read plugins.result for this operation and continue under the existing project permissions.":
    "我已确认插件表单。请通过 plugins.result 读取本次操作的结果，并在现有项目权限内继续。",
  "Invalid local plugin manifest": "本地插件清单无效",
  "Plugin and tool IDs must use lowercase letters, digits, underscores or hyphens":
    "插件与工具 ID 必须使用小写字母、数字、下划线或连字符，并以字母开头",
  "Plugin labels and instructions require English and Simplified Chinese":
    "插件文案与指令需要同时提供英文和简体中文",
  "The plugin contains unsupported fields. Executable scripts and remote pages are not supported by workflow plugins.":
    "插件包含不支持的字段。工作流插件不支持可执行脚本或远程页面。",
  "Local plugin manifest is too large": "本地插件清单过大",
  "A plugin form supports up to 12 fields": "插件表单最多支持 12 个字段",
  "Unsupported plugin form field": "不支持此插件表单字段类型",
  "Invalid plugin form options": "插件表单选项无效",
  "Duplicate plugin form fields": "插件表单字段重复",
  "Duplicate plugin tool IDs": "插件工具 ID 重复",
  "Duplicate plugin IDs": "插件 ID 重复",
  "At most 64 local plugins can be installed": "最多可安装 64 个本地插件",
  "Unknown plugin form field": "未知的插件表单字段",
  "Invalid plugin form value": "插件表单填写内容无效",
  "Check this form field": "请检查此表单项",
  "Plugin request ID was already used with different input":
    "此插件请求 ID 已用于其他参数，请勿重复使用",
  "This plugin tool is disabled or unavailable": "此插件工具已停用或不可用",
  "Complete or cancel an open plugin form before requesting another":
    "请先完成或取消已打开的插件表单，再请求新表单",
  "This plugin changed while the form was open. Cancel and request it again.":
    "表单打开期间插件发生了变化，请取消后重新请求。",
  "Plugin result was not found in this conversation":
    "未在此会话中找到插件操作结果",
  "Model groups and account pools": "模型组与账号池",
  "In order": "按顺序",
  "Round robin": "轮流使用",
  "Use until exhausted": "用完再换",
  "Most quota remaining": "余量最多优先",
  "Weighted rotation": "按权重轮流",
  "Choose a source for new conversations. Existing conversations keep their model and isolated account; switching a group never migrates credentials or retries completed work.":
    "为新会话选择模型来源。已有会话保持原模型与独立账号；切换模型组不会迁移凭据，也不会重试已完成的工作。",
  "Use for new conversations": "用于新会话",
  "New model group": "新模型组",
  "Add model group": "添加模型组",
  "Selection strategy": "选择策略",
  "Project account": "项目默认账号",
  Weight: "权重",
  "Quota unknown": "额度未知",
  remaining: "可用",
  Selected: "已选中",
  Standby: "待选",
  "Account removed": "账号已移除",
  "Move up": "上移",
  "Add model source": "添加模型来源",
  "Weekday and time exceptions": "星期与时段例外",
  "Overnight ranges belong to the starting weekday. The first matching rule wins; times use this computer's timezone.":
    "跨午夜的时段按开始那一天计算。采用首条匹配规则，时间以本机时区为准。",
  "Add time exception": "添加时段例外",
  "Refresh account quotas": "刷新账号额度",
  "Invalid model group": "模型组配置无效",
  "Choose between 1 and 64 model sources": "请选择 1 至 64 个模型来源",
  "Model source weights must be between 1 and 100":
    "模型来源的权重必须为 1 至 100 的整数",
  "Check the weekdays and time range": "请检查星期和时间范围",
  "No available source in this model group. Check accounts, quota and installed agents.":
    "此模型组暂无可用来源，请检查账号、额度及已安装的代理。",
  "Custom models work in Pi and OpenCode. Hermes supports OpenAI Chat Completions; Claude requires Anthropic Messages; Codex requires OpenAI Responses. Other agents use their own model catalogs.":
    "Pi 和 OpenCode 支持自定义模型。Hermes 支持 OpenAI Chat Completions；Claude 需要 Anthropic Messages；Codex 需要 OpenAI Responses。其他代理使用各自的模型目录。",
  "Refresh the remote model catalog before starting a new conversation.":
    "请先刷新远程模型目录，再开始新会话。",
  "A previous stage dependency is missing or cancelled":
    "前一阶段的依赖任务不存在或已取消",
  "A stage supports up to 20 tasks; a run supports up to 40":
    "每个阶段最多 20 个任务，每次编排最多 40 个任务",
  "The run changed while preparing this stage. Review its state before retrying.":
    "准备此阶段时编排状态发生变化，请检查状态后重试。",
  "A stage agent is no longer ready. Check its installation, account and model.":
    "此阶段有代理尚未就绪，请检查安装状态、账号和模型。",
  Stage: "阶段",
};
