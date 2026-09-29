# MyCode 0.8.0

## 使用变化

- 左上角点击“开发 / 办公”切换模式。点击“新建任务”，依次选择工作文件夹、代理和模型。首次默认使用用户目录下的 `MyCode` 文件夹；更换后，各模式分别记住目录。
- 设置主模型后，新任务优先选择支持该接口的可用代理和主模型。仍可在创建时或输入框中切换代理、其他服务商模型或官方模型。Cursor 等未开放自定义接口的 CLI 继续使用其官方模型目录。
- 设置 → 语音输入：可选择 **xiaomimimo API · MiMo-V2.5-ASR**，填写普通 API Key；内置请求适配会将录音作为音频消息发送到 `/v1/chat/completions`。也支持 OpenAI 兼容 `/audio/transcriptions` 本地 ASR 服务。安装包不包含识别模型权重，不会自动启动本地识别服务。
- 输入框麦克风按钮开始 / 停止录音，默认快捷键为 `Ctrl+Shift+Space`，可在快捷键设置修改。只在 MyCode 当前输入框生效；录音最长两分钟，关闭任务或停用输入框会取消录音。识别结果进入草稿，用户确认后发送。
- 开启语音命令后，支持“新建任务”“打开设置”“办公模式”“开发模式”及对应英文完整命令。普通句子不会被当作命令，也没有语音自动发送功能。
- 设置 → 电脑控制：安装本机 Cua Driver，或选择已有驱动，再启用。新建 Claude、Codex、OpenCode 或 MiMo Code 任务后，可要求代理操作本机应用；使用当前任务的模型。截图和窗口内容可能发送到所选模型。
- 电脑控制使用应用拥有的独立 MCP 进程，不注册全局开机服务，不更改系统 PATH。设置页和侧栏均可停止，停止后关闭驱动并拒绝后续操作，已经执行的动作不会撤销。驱动遥测和后台更新检查默认关闭。
- 任务导入支持 Claude Code、Codex、WorkBuddy 和 ZCode，增加来源标签、序号、数量、全选 / 取消全选和每页 20 条翻页。扫描结果在当前应用会话内保留。
- WorkBuddy 读取 `.workbuddy/projects` 的消息记录；ZCode 只读打开 `.zcode/cli/db/db.sqlite`。两者导入可读对话，不冒用其他应用的运行状态、授权或原生会话 ID。
- 技能页展示来源代理，并扫描 WorkBuddy、ZCode、MiMo Code 的技能目录。共享技能标为“共享技能”。
- 小米 MiMo 仅提供 `xiaomimimo API` 与 `xiaomimimo token plan` 两个模板，协议在表单内部选择 OpenAI / Anthropic，地址同步切换。按账号的实际可用模型获取或填写模型 ID。
- 设置 → 常规增加当前开发 / 办公模式的默认工作区，以及缓存文件夹。新的附件、截图临时文件存入所选目录的 `MyCode-cache` 子目录；旧文件、登录状态、会话数据库保持原位置。
- 发送按钮左侧圆环显示最近的上下文占用、缓存命中率、缓存 token 和输出 token。支持压缩的代理可手动压缩，或在当前任务空闲且上下文达到 85% 时自动压缩；可关闭自动压缩。代理未上报的数据不推算，标为暂无数据。
- 用量历史增加任务级与筛选汇总的缓存命中率，按可统计输入 token 加权计算，排除没有上报缓存信息的轮次。
- WorkBuddy / ZCode 导入后首次继续对话，会附上原记录最近 12 条的有限历史节选（最多约 4,000 字符）；完整导入记录仍可在界面阅读。

## 修复

- Codex 的 `codex:default` 是“由 CLI 选择模型”的占位符，不再向服务端发送字面值 `default`。模型目录刷新后也保留正确显示，修复微信等 IM 任务中的 400 错误。
- 账号用量的周期、更新时间、重置时间、已知重置奖励文字，快捷键名称 / 条件，以及项目菜单“在文件资源管理器中显示”随语言切换。
- 服务商导航去除框线，模型服务商表单减少重复卡片边框。

## 来源与范围

语音录入参考 [Cindy 开源录音状态管理](https://github.com/makecindy/cindy/tree/main/packages/voice-input-core)，电脑控制采用同类的 [Cua Driver 本机 MCP](https://cua.ai/docs/reference/cua-driver/embedding)。实现不调用 Cindy 云服务。Windows 一键安装固定为 Cua Driver 0.30.4，下载官方 GitHub 资产并校验 SHA-256；其他系统可以选择已安装的驱动，仍受各系统权限限制。

MiMo 端点依据[小米官方接口文档](https://mimo.mi.com/docs/zh-CN/quick-start/summary/first-api-call)：普通 API 使用 `api.xiaomimimo.com`，Token Plan 使用 `token-plan-cn.xiaomimimo.com`，OpenAI 路径为 `/v1`，Anthropic 路径为 `/anthropic`。

MiMo 语音请求依据[小米语音识别文档](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/Speech-Recognition)，使用 WAV 音频消息和 `mimo-v2.5-asr` 模型，独立配置普通 API 密钥。

语音识别、模型服务商和 IM 机器人使用用户自己的服务与凭据。自动化测试、本机模拟接口和工具握手，不代表真实模型计费、麦克风识别质量或真实微信收发已经验收。

## 验证记录

- TypeScript 检查与生产前端构建通过；Rust 严格 Clippy 检查通过，392 项原生测试通过。
- 前端全套覆盖 3,724 项测试：更新品牌断言及图片粘贴的异步等待后，失败项均定向复测通过；13 项依赖真实代理的测试跳过。
- 实际读取本机 WorkBuddy / ZCode 历史，验证只读扫描、文本导入和来源信息；浏览器验证 43 条任务的全选及每页 20 条分页。
- 独立应用数据目录中验证缓存路径写入、附件内容往返，以及 MiMo 音频请求格式、模拟识别响应和密钥隐藏。
- Cua Driver 实际 MCP 握手、59 项工具列表和停用后的连接撤销通过；没有执行真实桌面点击任务。
- IM 与微信运行时的权限、消息去重、回复上下文和取消测试通过。
