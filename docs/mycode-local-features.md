# MyCode 本地能力说明

## 整合方式

保留 MonoCode 的 Tauri / React / Rust 架构和视觉语言。Cindy 的 Electron、账号、设备发现和云目录没有被引入。MyCode 不请求 Cindy 服务。

| Cindy 开源参考 | MyCode 实现 |
| --- | --- |
| model-providers 离线目录及连接/引擎分层 | 本地厂商模板、独立连接、Pi 扩展注册与模型选择 |
| project-context 项目知识 | 个人/项目记忆编辑器、请求上下文注入、项目知识复核技能 |
| 本地 MCP 集成 | Claude Code 的 stdio MCP 配置，不覆盖已有 CLI 配置 |
| 技能与 maker-scheduler 调度思路 | 复用原有技能/调度引擎，增加开发与办公模板、运行历史 |

不是 Cindy 的移动端、跨设备控制、云端嵌入检索或未开源服务的移植。记忆由用户维护；知识复核产生建议，不会悄悄覆盖用户的记忆。自动化需要桌面应用运行，原有补跑规则继续适用。

## 模型连接

厂商模板是可编辑的地址与协议，模型 ID 以自己的账号为准，不把目录中的名称当作账号已获授权。

新连接通过 MyCode 启动的 Pi 进程加载 `local_ai_provider.mjs`。该模块只注册模型，不在加载时发送请求。模型目录从 Pi RPC 进入现有模型选择器，流式响应、工具执行和取消沿用 Pi 适配器。

配置写入应用数据目录的 `local-ai/config.json`。Windows API Key 为 DPAPI 密文，前端只收到是否已设置的标记。子进程环境中的凭据只在执行时使用。不会修改 `~/.pi`、`~/.claude` 或 Codex 的原有配置。

自定义模型以保守的 32K 上下文、4K 输出、文本输入注册；这些是本版本的运行预算，不是厂商规格承诺。多模态、推理和专属协议能力仍可通过已有 CLI 自己的配置使用。服务商的真实账号授权、额度、区域和模型工具兼容性需使用自己的账号验证。

## 更新

唯一来源：`https://api.github.com/repos/dcxa521gi/MyCode-Pro/releases`。检查 latest 并按语义化版本比较；更新内容读取指定版本的 release body。网络失败会显示错误并允许重试，不回退到官方 MonoCode 或打包内旧日志。新版本下载打开可信的本仓库发布页，不把下载动作冒充安装完成。

## 参考资料

- [Cindy 仓库地图](https://github.com/makecindy/cindy/blob/main/docs/dev-rules/repo-map.md)
- [Cindy 模型目录设计](https://github.com/makecindy/cindy/blob/main/docs/dev-rules/model-catalog-maintenance.md)
- [Pi 自定义服务商](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/custom-provider.md)
- [DeepSeek API](https://api-docs.deepseek.com/guides/harness)
- [通义千问兼容接口](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)
- [智谱兼容接口](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)
- [硅基流动接口](https://docs.siliconflow.cn/docs/api/chat-completions-post)
- [Groq 兼容接口](https://console.groq.com/docs/openai)

## 图标

MyCode 图标使用内置 imagegen 生成，项目源文件为 `public/mycode-icon.png`，Tauri CLI 生成平台图标。提示词：深炭色圆角底、米白色折带形成 M 与代码括号、少量铜色、无文字、透明外边距、简洁桌面工具风格。

## 0.6.0：本地 IM、导入、用量与 CLI

- Cindy IM 源码固定于 bfb95c3492e8732497e08d296c8baeae04971e8f；五个平台直接从本机连接各平台官方接口。MyCode 不暴露 Cindy 注册或云端入口。仅允许指定用户 ID 的文本消息进入指定工作目录和模型；工具审批在桌面完成，重启后需重新连接机器人。机器人会话映射在本次应用进程内保持。
- Windows IM 凭据使用 DPAPI；非 Windows 与模型配置一样使用当前用户文件权限。Node/npm 和 IM 传输运行时随安装包分发，无需独立安装 Node。
- 导入扫描 ~/.claude/projects、~/.codex/sessions 和 archived_sessions；跳过符号链接及大于 20 MB 文件，每个根目录最多扫描 3000 个 JSONL。导入用户与助手文本，忽略工具/系统块，不修改源历史。已有任务不覆盖。
- 用量按用户轮次中服务商返回的输入、输出、缓存 Token 汇总，按该轮代理和模型归属；无计量不虚构费用。统计来自保留的任务，删除任务后不再计入；尚未建立独立账单账本。
- 应用内 CLI 安装使用随包 npm 的独立 --prefix，目录为应用数据/cli/服务商；不改系统全局 npm 包。当前管理 Claude Code、Codex、Pi、OpenCode，其他工具保留官方安装和自定义可执行路径。
- 自动模型发现使用用户选定端点，支持 Google/Anthropic 分页；接口不支持模型列表时仍可手动填写模型 ID。
