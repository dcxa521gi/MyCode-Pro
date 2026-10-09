# MyCode 0.19.0 功能补齐（2026-10-09）

## 基线与交付

保持版本号 0.19.0，补齐上一轮未移植的能力，重新交付源码及 Windows 安装包。原安装包及校验记录已备份至 `build/019-original-20261008/`，不会覆盖或迁移用户会话、凭据和项目文件。

- MonoCode：本次 main `d26871f246d34479795bc9a00513b43d4d18add2`，从上一轮记录的 `0b2c391f3994ba4cdb1b0ee6e6941faa5e1fbae3` 继续核对，并补齐之前没有融合的功能。
- Cindy：main `fa2ea01b6c77053fc8b78f2edd94337916e8a0f9`，比较本地可运行功能，不接入其云服务。
- Synara：main `6f54f53c66348a9a19c65779daaabd96113773eb`，比较本地开发/办公能力。

## 必须完成的功能清单

1. 常驻 Mono 智能体：独立身份、名称/形象、SOUL 与长期记忆、项目绑定、权限、会话持久化、主动习惯及定时调度、用量限制与恢复。
2. Mono 启动的项目会话：生命周期、完成后回复、会话列表与侧栏可见性；与 MyCode 项目任务及 IM 继续任务保持一致。
3. 浮动聊天：智能体切换/创建、工具活动、任务操作、产物和变更面板。macOS 菜单栏能力在 Windows 适配为系统托盘入口。
4. Artifacts：创建/更新/删除、持久保存、会话卡片、附件关联、专用文档面板及浮窗预览；与已有笔记、文件预览和划词引用共同使用。
5. Mono 专属 Codex 隔离存储：临时会话、上下文轮换、rollout 保存/恢复，Windows 目录联接修复；不修改原 Codex 用户数据。
6. OpenCode 2.x：后台服务、目录/事件/权限/问题/压缩/恢复；适配 MyCode 自定义模型及隔离配置，保留 OpenCode 1.x。
7. 最新新增：Mono 变更/提交页、习惯最长一小时、工具活动展开、文件树键盘导航及其他上游增量修复。
8. 平台更新能力：合入 Linux AppImage 自更新及系统 WebKitGTK 策略；Windows 保留安装包更新并完成其对应托盘/浮窗适配。
9. 全部新增用户界面、菜单、提示、状态、操作反馈和错误支持简体中文及英文。

## 融合与验收要求

- MonoCode 的行为作为基础，保留 MyCode 群聊、IM、技能、自定义模型、登录、手机连接、存储管理和 CLI 安装/更新状态。
- 群聊依然保持各自文件夹和记忆，自动闲聊默认关闭；新习惯须由用户配置，不因升级自动产生持续 Token 消耗。
- 新增持久化内容与缓存分开管理，不把智能体记忆当作可清理缓存；尊重已配置存储位置，保留已有数据。
- 验证真实运行链路和负向路径，不能以空页面、静态卡片或文档代替功能。覆盖持久化、习惯调度、权限/任务完成、浮窗动作、产物更新、Codex 存储、OpenCode 双协议及中文。
- 完成类型、行为、原生、浏览器、打包和公开下载核验，再更新同版本发布。实际整合结果和验证边界写入本文。

## 实际整合与配置适配

- 已采用完整 Git 合并融合 MonoCode main，而非以功能重叠或架构差异跳过常驻智能体、Artifacts 或新协议。
- OpenCode 2.x 桌面使用受管 `serve` 进程，给每个会话传入自己的本地工具授权；自定义服务商转换为 V2 的 `providers/package/settings`、变体数组及 `mcp.servers` 配置。API 密钥通过进程环境引用，不重复明文写入项目配置。
- OpenCode 保留真实用户 home，以继续使用 Git/SSH；其配置、缓存、状态使用项目中被忽略的受保护目录。已有 V2 登录账号沿用原认证数据库；V1 数据库不会被 V2 原地迁移。自定义模型使用独立数据库。
- 新常驻智能体目录遵循默认工作区，已有目录原位读取；专属 Codex 存储、会话分页、rollout、代理状态和窗口之间的所有权随上游融合。
- 远程宿主使用上游固定的 Node 24.21.0 运行时；保留 Windows/SSH/URL 配对和原生进程生命周期能力，支持范围不重新包含已移除的 CLI。
- 新增页面、托盘、操作按钮、时间表、状态、选区引用和说明接入双语言；每轮常驻消息带当前语言策略，语言更改不会仅影响首次聊天。
- 参考：[MonoCode v0.10.0](https://github.com/hardbeat920/monocode/releases/tag/v0.10.0)、[OpenCode V2 服务商配置](https://opencode.ai/v2/docs/providers)、[V2 MCP 配置](https://opencode.ai/v2/docs/mcp-servers)、[V2 账号存储](https://opencode.ai/v2/docs/cli/providers)。

## MonoCode 增量提交清单

以下提交按时间顺序记录从 MyCode 0.18.0 已整合基线到本次完整基线的变化：

- `dc6d0ef` Make diff stats resize to fit sidebar
- `56bae44` Harden Composer file drop handling
- `7933972` Improve scroll stability and output reveal pacing
- `4361fdb` Stabilize GitChangesPanel folder action tests
- `22b4874` Add searchable worktree creation to sidebar switcher
- `610550e` Move workspace actions into the sidebar header
- `990f141` Add soft fades to clipped tabs and scroll areas
- `807c70e` Release v0.7.1
- `889ac20` Paint macOS glass tint natively during resize
- `98da85a` Support async Codex agent questions
- `98845e5` Stop the remote folder dialog from darkening the window (#733)
- `680e1ab` Keep IME composition intact in remote session composers (#741)
- `a6b4b1d` Open general new terminals in the active session's worktree (#732)
- `185b500` Fix editor diff gutter layout and Inbox PR overview diff colors (#759)
- `0bfa5c6` Optimize streaming output, file indexes, and transcript rendering
- `0103647` Improve modal layering and light-theme styling
- `3e05e03` Preserve transcript scroll position during asynchronous updates
- `7eebfc1` fix: preserve focused note title drafts (#769)
- `07f29c1` fix(skills): raise the skill catalog cap from 300 to 5,000 (#750)
- `5736697` Render Nerd Font prompt glyphs in the terminal (#767)
- `b74e803` Keep Pi extension status in one row per key (#760)
- `5aef862` Hide internal and legacy Copilot models from Pi/omp catalogs (#766)
- `850be65` Add persistent Mono agents with memory and scheduled habits (#773)
- `80ba2c0` Throttle GitHub polling and handle rate-limit backoff
- `9ccfc09` Release v0.8.0
- `de033ff` fix(monos): keep IME candidate selection from sending in Mono inputs (#790)
- `93ee54c` Add Mono permission controls to Details
- `de83c79` Add MonoCode session lifecycle controls
- `432ac68` Refine Mono activity display and completion handling
- `0f8e568` Preserve delivered follow-up replies during inline work
- `0b7a21f` Add Mono launched sessions panel and persistence
- `e5794cc` Use chatting icon for session toggle
- `d8902e7` Add per-Mono session sidebar visibility
- `40aa9fe` Add effort selection animations for other harnesses (#672)
- `dddefe4` Stabilize host Vitest integration runs under load. (#683)
- `c2b479d` fix(codex): omit collaboration mode until a model is known (#771)
- `bdc2b64` Fix notes keeping an "untitled" slug after they get a real title (#788)
- `140c6e5` Add floating Mono chat panel with menu bar integration
- `03ae277` Continue Mono replies after sessions complete
- `e79778c` Resize menu bar portrait and fix macOS 27 image visibility
- `b1660e7` Fix ModelPicker type error from stale harness prop
- `53d91c8` Fix macOS Clippy chunking warnings
- `3597485` Route ⌘W and ⌘T to the focused project terminal (#774)
- `eb14d1a` Fix Settings catalog refresh behind fallback models (#783)
- `8899486` Default to masking account emails
- `4d24fd7` Add persisted artifacts with chat attachments and panels
- `9a7b6a2` Release v0.9.0
- `0ee745e` Remove accidental document preview mockup
- `11b5397` Add Mono rail to floating chats for switching and creating
- `c0d1fa0` Add menu bar icon visibility toggle
- `1c53269` Add artifact sheet overlay in floating Mono chat
- `de9650c` Use host WebKitGTK in the Linux AppImage (#824)
- `296d7fd` Stabilize chat history scrolling and add browser regression coverage (#818)
- `b9e2a13` Self-update the Linux AppImage (#825)
- `0eb2773` feat(opencode): support OpenCode 2.x servers (#434)
- `6c67705` Fix Changes list file selection click target and latency (#830)
- `b6e0db8` Stabilize transcript scroll pinning and settled Mono turn headers
- `bbb9162` Wrap active agent names in signature pills
- `514400d` Enable native macOS spell checking in chat composer (#829)
- `0923846` Merge branch 'main' of https://github.com/hardbeat920/monocode
- `e92d803` Keep Mono Codex sessions ephemeral and rotate by context
- `3e157b7` Clean up temporary provider sessions
- `daaad71` Hide scrollbars in Zen phase live content
- `004cab5` Add isolated Codex mono storage and rollout persistence
- `0b2c391` Fix Windows path links and file syncing
- `322fc2a` Fix Windows Codex directory junction creation
- `bf5a30d` Add keyboard navigation to the file tree
- `eb5f69a` Allow mono habits to run for up to one hour
- `8a63eb6` Tone down settled turn agent names
- `b93b95a` Preserve remote sessions when opening local projects
- `43602cd` Make the live activity ticker expandable
- `a3f6f8a` Release v0.10.0
- `d4e40a9` Add session changes panel for Mono diffs
- `d26871f` Add commit tab to Mono changes panel

## 本地验证记录

- 前端：全量 4,965 项执行，其中引用块行为变更后调整对应断言并定向复测 6 项通过；包含常驻智能体、习惯、完成回报、Artifacts、独立 Codex 存储、OpenCode 1.x/2.x 和桌面 V2 受管进程。
- 原生：576 项通过，新增私有服务允许范围调整后 4 项定向测试通过；1 项环境相关测试沿用忽略标记。类型检查、生产前端构建与 Rust Clippy（所有目标、警告视为错误）通过。
- 远程宿主：使用经过官方 SHA-256 校验的 Node 24.21.0，89 项通过；剩余允许范围与会话标题断言修正后 9 项定向测试通过。
- 浏览器：Chromium 验证中文深色、英文、引用完整内容发送、文档链接和会话滚动；浅色组件截图已核查，首次冷加载超时增加有界等待后复测。Linux CI 继续验证 Chromium/WebKit 与平台构建。
- 未执行真实模型付费请求、第三方账号 OAuth 全流程、手机实机或 macOS 实机交互。本轮安卓安装包不变。
- Windows 安装包、公开资源校验和最终源码提交信息以同版本发布的验证附件为准。
