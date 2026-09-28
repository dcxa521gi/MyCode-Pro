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

唯一来源：`https://api.github.com/repos/dcxa521gi/MyCode/releases`。检查 latest 并按语义化版本比较；更新内容读取指定版本的 release body。网络失败会显示错误并允许重试，不回退到官方 MonoCode 或打包内旧日志。新版本下载打开可信的本仓库发布页，不把下载动作冒充安装完成。

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
