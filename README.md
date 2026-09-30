<p align="center"><img src="public/mycode-icon.png" alt="MyCode" width="100" /></p>
<h1 align="center">MyCode</h1>
<p align="center">兼顾开发与通用办公的本地 AI 工作台</p>

MyCode 基于 [MonoCode](https://github.com/hardbeat920/monocode)，保留其简洁的工作区、会话、文件、终端和 Git 界面，并参考 [Cindy](https://github.com/makecindy/cindy) 已开源的本地模型连接、项目知识和自动化设计。

**不依赖 Cindy 账号、云服务或未开源后端。** 可使用自己选择的模型 API，也可连接 Ollama、LM Studio 等本地模型服务。

## 下载

[Windows x64 安装包与更新说明](https://github.com/dcxa521gi/MyCode-Pro/releases/latest)

设置 → 常规 → 关于中的版本检查与更新内容均来自本仓库的 GitHub Releases。Windows 检查到新版本后在应用内下载并校验 SHA-256，左下角显示进度；下载完成后查看更新内容，选择安装或跳过。安装需要单独点击确认。

## 主要能力

- **双语界面**：简体中文 / English；默认按电脑时区选择，手动选择立即生效并保存。标签、操作提示、自动化模板与 Windows 托盘菜单随语言变化。
- **模型连接**：小米 MiMo / Token Plan、DeepSeek、通义千问、Kimi、智谱、硅基流动、OpenAI、Anthropic、Gemini、OpenRouter、xAI、Groq、Ollama、LM Studio 和自定义端点模板。输入 Key 后自动获取模型，支持勾选模型、自定义模型 ID、协议、多个连接和连接测试。
- **IM 机器人**：本机扫码连接个人微信，并直连飞书/Lark、钉钉、企业微信、Telegram、Discord，指定允许用户、工作目录和模型；文本任务进入桌面会话并回传结果。
- **任务导入**：扫描本机 Claude Code / Codex / WorkBuddy 历史，显示来源、序号与数量，支持全选和每页 20 条分页，保留原始文件。
- **用量统计**：左下角显示累计 Token，设置中支持日期筛选、活跃热力图、每日趋势及模型、代理和任务排行；服务商卡片按连接统计 Token。
- **应用内 CLI 管理**：Claude Code、Codex、Pi、OpenCode、MiMo Code、Cursor、Grok 与 Windows Hermes 支持应用内安装/更新与版本检查，路径保存后新会话立即生效。
- **存储空间**：本机容量统计、旧日志清理、附件引用扫描与恢复备份、数据库检查和备份压缩；保护会话、笔记及草稿。
- **本地记忆**：个人记忆与按项目区分的知识，可审阅、修改、清空；从下一轮请求开始加入所选模型的上下文。
- **本地 MCP**：配置本机 stdio 服务，接入新建的 Claude Code、Codex、OpenCode、MiMo Code 会话，保留既有 CLI 配置。
- **技能**：保留项目和个人技能管理；新增 `/mycode-documents`、`/mycode-project-memory`、`/mycode-work-report`，用于文档整理、知识梳理和工作报告。
- **自动化**：保留本地定时与事件触发、运行记录和重试机制，新增工作周报、文档索引和项目知识复核模板。
- **语音输入**：本机录音，支持小米 API / Token Plan 的 MiMo-V2.5-ASR 或自选、本地 OpenAI 兼容语音识别服务；可配置模型、快捷键和中英文语音命令，录音中分段转写，文字先进入草稿。
- **无头浏览器**：应用内安装本地 Playwright/Chromium，通过 MCP 浏览、点击、填写表单和截图；独立会话环境，关闭开关撤销连接。
- **电脑控制**：使用本地开源 Cua Driver，支持 Windows 应用内安装，通过兼容代理的 MCP 观察和操作桌面；提供侧栏快速停止。
- **开发工作区**：多代理会话、任务编排、工作树、代码差异、终端、文件检索、笔记及 GitHub 等收件箱集成。

左上角可切换开发 / 办公模式；侧边栏“新建任务”与“项目 +”均打开项目选择；工作区“+”直接继承当前项目文件夹、代理和模型创建会话。点击左上角 LOGO 直接循环切换运行中的会话；没有运行任务时打开最近停止的会话。工作区支持左右切换，会话悬停显示 Token，用右键复制项目/会话 ID。输入框发送按钮旁可增强当前草稿，任务导入切换页面保留扫描结果。

常规设置可修改默认工作区和附件、截图缓存目录。发送按钮左侧的数据圆环显示实际上下文占用与缓存信息，支持代理提供的手动压缩和 85% 阈值自动压缩；用量历史保留 Token 汇总，不再显示缓存命中率。小米 API / Token Plan 分为两个服务商入口，OpenAI / Anthropic 协议在表单内选择。

ZCode 需按官方文档安装并配置 CLI；Windows Hermes 在应用内安装，首次需下载其运行依赖。FX / Antigravity 的原生 Windows CLI 受上游平台支持限制。个人微信通过腾讯 iLink 扫码绑定，默认仅绑定用户可使用。

## 开始使用

1. 安装并登录需要的代理 CLI。原有 Claude Code、Codex、Cursor、OpenCode、Pi 等入口继续可用。
2. 设置 → 服务商 → CLI 代理工具，点击 Pi 的“应用内安装 / 更新”。安装在 MyCode 数据目录，无需系统全局安装 Node/npm。
3. 设置 → 服务商 → 模型服务商，选择模板并输入 API Key，自动获取后选择模型。没有模型目录的接口可手动填写模型 ID。地址可按服务地区修改。
4. 保存并设置主模型后，在**兼容智能体的模型列表**选择或收藏对应连接。Pi、OpenCode、MiMo Code 支持自定义连接；Claude 对接 Anthropic 协议，Codex 对接 Responses 协议；封闭模型目录的智能体使用自身模型。连接测试检查模型目录可达性；实际模型权限和工具调用能力取决于服务商与模型。
5. 设置 → 记忆与 MCP，编辑个人/项目记忆，或配置本地工具。技能通过输入框的 `/` 选择器调用；自动化在工作区的自动化入口创建。

Windows 模型密钥使用当前 Windows 账号的 DPAPI 加密，执行时传给 MyCode 启动的子进程，不写入浏览器存储或用户原有 CLI 配置。非 Windows 构建使用仅当前用户可读写的本地配置文件。记忆只有在发起请求时才发送给用户选择的模型，不上传到 Cindy。

为兼容已有分支数据，保留内部数据标识和历史存储键。安装新版本前正常退出已有 MonoCode/MyCode；安装包不会自动关闭或安装到当前运行的官方版本中。本仓库当前发布 Windows 安装包，其他平台源代码构建不等同于已发布安装包。

## 开发

需要 Node.js 22、Rust stable 和 Tauri 对应平台的构建依赖。

```sh
npm ci
npm run dev
npm run check:web
npm run check:rust
npm run build:windows
```

更多实现边界、参考来源与验证说明见 [本地能力说明](docs/mycode-local-features.md) 和 [语言说明](docs/localization.md)。

## 来源与许可

保留 MonoCode 原有 MIT 许可证及作者署名。Cindy 为 Apache-2.0 项目；本版本复用其开源 IM 传输包（见 `vendor/cindy-im/NOTICE.md` 和许可证），并在 Tauri 架构内实现模型连接与任务导入流程。没有接入 Cindy 云端、账号或私有后端。服务商名称及标识属于各自所有者。

新版操作说明：[MyCode 0.8.0](docs/mycode-0.8.md)。

最新账号登录、模型元数据、更新与接入边界见 [0.10.0 更新说明](docs/mycode-0.10.0.md)。

账号登录是测试功能，不代表最终品质：设置下方可登录，未登录启动时显示对话框，允许稍后再登录。使用系统浏览器、PKCE 和 Windows DPAPI，登录不授予电脑控制权限，也不影响本地功能使用。
