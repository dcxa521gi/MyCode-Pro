# MyCode 0.15.0

## 升级计划与上游基线

2026-10-03 核对 MonoCode 最新发布 v0.7.0，上游 main 为 `6bd432cada0f492f076cc93f7ccb3027f4ff7102`；上一基线为 `1e97594ddf6f40aa24671f7fa09f2048deb1d5eb`。集成工作树工作区、导航竞态修复、缓存容量限制、进程事件归属、OpenCode 流清理、终端重挂载、Windows 空格路径定位、用量隐私选项及相关回归。保留 MyCode 品牌、模型路由和自有工具页导航。

本次同时完善运行提示翻译、侧栏间距、设置选项、服务商添加和模型管理入口；增加可选 IM 完成推送与原会话远程继续，检测 Hermes / MiniMax 自定义模型支持。

## 接入边界与验收

- 只使用 Cindy 开源本地能力；官方 CLI 授权走各自官方登录，不能冒充通用 API Key 或共享其他订阅。
- IM 通知默认关闭，用户选择已配置渠道后开启；内容限项目名、会话名、摘要和继续入口，不发送密钥、系统提示或工具原始参数。
- 远程继续必须明确会话标识、允许用户身份校验，沿用桌面权限审批；不自动把远程消息发送到最后一个项目。
- 保留原数据、凭据与历史，不迁移或删除用户文件。
- 完成类型检查、针对性回归、运行时协议验证、跨平台 CI、Windows 安装包核验后交付源码与安装包。

上游发布说明：https://github.com/hardbeat920/monocode/releases/tag/v0.7.0

## 本次实现

- 运行时长、动作组和编辑/读取/运行等工具标签按界面语言显示；发送时附加对应语言偏好，保留代码、路径、命令。旧会话中模型自行输出的英文正文不做猜测翻译。
- 工作中会话卡片与 Token 用量增加间距。设置短列表改为分段选项，长模型目录仍可搜索，支持键盘切换并跳过禁用项。
- 模型浮窗新增“管理模型”，直接进入模型服务商设置。
- 服务商添加按选择服务商、配置连接、选择模型分步进行；增加 NVIDIA NIM、Hugging Face、Vercel AI Gateway，模板共 30 个。增加 OpenRouter PKCE 授权和官方 CLI 登录入口，保留 TokenDance 合作商与应用归因。
- Hermes 支持 OpenAI Chat Completions 自定义连接，MiniMax Code 支持 OpenAI Chat Completions/Anthropic Messages。修正 MiniMax 统一模型索引和原生模型命名，凭据通过子进程环境传递，隔离配置不写明文 Key。配置位于项目下的 `.mycode/cli-homes`，原生记录和已有用户配置不移动或删除。
- 自定义模型切换需要重启隔离子进程时，从可见会话内容提供有限历史摘要；不复制隐藏思考和工具参数，也不冒充原生会话 ID。
- 任务导入支持 MiniMax Code、Cursor 编辑器及 CLI、OpenCode，保留原有 Claude、Codex、WorkBuddy；新增统计、搜索、来源筛选、消息预览、导入结果弹窗和局部失败重试。深浅主题使用现有主题变量。
- 新增 IM 完成通知设置，可选择已配置的微信、飞书、钉钉、企业微信、Telegram、Discord。推送项目名称、会话名称、完成摘要及下一步描述；模型未提供的计划不补造。
- 开启远程继续后，允许用户可发送 `/continue 会话ID 下一步要求`。只对成功通知的会话建立关联，有效期七天、限当前应用运行期间；可以恢复已关闭但仍保存在本地的会话。审批继续沿用桌面权限，IM 来源的任务使用原渠道回复，避免重复通知。
- 机器人启动状态本地保存并在桥接初始化时恢复；关闭渠道或重新配置后撤销旧的继续权限。应用退出后不能接收消息。

## 导入与验证边界

导入只读本地数据库，复制用户/助手可见文字，不导入凭据、系统内容、工具参数、隐藏思考或未知二进制格式。SQLite 导入有数量和大小限制，外部数据格式改变时跳过无法识别的记录。Cursor CLI 当前有序 JSON 消息格式按内容哈希校验，不把无序 blob 扫描冒充完整对话；旧版 protobuf 会话格式未纳入本版。导入后的继续是 MyCode 中的新执行，不覆写外部历史。

本地回归和浏览器模拟已覆盖界面、数据过滤、原数据库字节不变、IM 允许用户/受保护消息拒绝、单次回复票据和明确会话关联。实际渠道权限、OAuth 账号、余额、付费模型请求未以用户凭据代测。安装包及跨平台 CI 验证结果见本版本 Release。

本地格式参考：[Cursor CLI 存储读取](https://github.com/wilbeibi/catchup/blob/main/internal/cursor/cursor.go)、[MiniMax Code](https://github.com/MiniMax-AI/minimax-code)、[Hermes 配置](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/)。只参考数据格式和本地能力，不接入 Cindy 云服务。
