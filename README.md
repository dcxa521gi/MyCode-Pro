<p align="center"><img src="public/mycode-icon.png" alt="MyCode" width="100" /></p>
<h1 align="center">MyCode</h1>
<p align="center">兼顾开发与通用办公的本地 AI 工作台</p>

MyCode 基于 [MonoCode](https://github.com/hardbeat920/monocode)，保留其简洁的工作区、会话、文件、终端和 Git 界面，并参考 [Cindy](https://github.com/makecindy/cindy) 已开源的本地模型连接、项目知识和自动化设计。

**不依赖 Cindy 账号、云服务或未开源后端。** 可使用自己选择的模型 API，也可连接 Ollama、LM Studio 等本地模型服务。

## 下载

[Windows x64 安装包与更新说明](https://github.com/dcxa521gi/MyCode/releases/latest)

设置 → 常规 → 关于中的版本检查与更新内容均来自本仓库的 GitHub Releases。检查到新版本后，点击下载打开该版本发布页；下载完成不代表已经安装，不使用上游更新服务器。

## 主要能力

- **双语界面**：简体中文 / English；默认按电脑时区选择，手动选择立即生效并保存。标签、操作提示、自动化模板与 Windows 托盘菜单随语言变化。
- **模型连接**：DeepSeek、通义千问、Kimi、智谱、硅基流动、OpenAI、Anthropic、Gemini、OpenRouter、xAI、Groq、Ollama、LM Studio 和自定义端点模板。支持自定义模型 ID、协议、多个连接和连接测试。
- **本地记忆**：个人记忆与按项目区分的知识，可审阅、修改、清空；从下一轮请求开始加入所选模型的上下文。
- **本地 MCP**：配置本机 stdio 服务，接入新建的 Claude Code 会话，保留既有 CLI 配置。
- **技能**：保留项目和个人技能管理；新增 `/mycode-documents`、`/mycode-project-memory`、`/mycode-work-report`，用于文档整理、知识梳理和工作报告。
- **自动化**：保留本地定时与事件触发、运行记录和重试机制，新增工作周报、文档索引和项目知识复核模板。
- **开发工作区**：多代理会话、任务编排、工作树、代码差异、终端、文件检索、笔记及 GitHub 等收件箱集成。

## 开始使用

1. 安装并登录需要的代理 CLI。原有 Claude Code、Codex、Cursor、OpenCode、Pi 等入口继续可用。
2. 使用新增厂商连接时，安装 [Pi](https://pi.dev/)：`npm install -g @earendil-works/pi-coding-agent`。本次验证使用 Pi 0.84.3。
3. 设置 → 服务商 → 模型连接，选择模板，填写实际账号可用的模型 ID 和 API Key。地址可按服务地区修改。
4. 保存后在**新对话的 Pi 模型列表**选择对应连接。连接测试检查模型目录可达性；实际模型权限和工具调用能力取决于服务商与模型。
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

保留 MonoCode 原有 MIT 许可证及作者署名。Cindy 为 Apache-2.0 项目；此版本参考其本地能力设计，在现有 Tauri 架构内实现，没有打包 Cindy 云端、账号或私有后端。服务商名称及标识属于各自所有者。
