# MyCode 0.23.4 更新记录（2026-10-19）

## 上游基线和逐提交清单

MonoCode 从 `399c303360686e804c8657d98db91d93f6ae99b6` 更新到 `e53e09aad2f19663cae364266383eb6c251e0811`，新增 61 个提交；上游正式版为 `v0.15.0`。以下完整列出提交及实际处置。代码合入表示当前源码树包含该提交，不把编译或定向测试等同于所有平台实机验收。

| 提交 | 上游内容 | MyCode 处置与验证 |
| --- | --- | --- |
| `05e5bb7d1c` | Stop every keystroke from querying the whole page for the shortcut recorder | 代码已合入；功能与验证层级见下文 |
| `6ea930c4e1` | Stop rebuilding every composer's @-mention index after each agent tool call | 代码已合入；功能与验证层级见下文 |
| `b3bf7b4d5e` | Stop every focus move from re-checking the whole page's styles | 代码已合入；功能与验证层级见下文 |
| `5c388c4e8a` | Add the inset workspace layout | 代码已合入；功能与验证层级见下文 |
| `1aaca824a3` | Add inset workspace themes and tidy composer layout | 代码已合入；功能与验证层级见下文 |
| `100fea1d23` | Add inset-layout Settings header and layout-aware settings rows | 代码已合入；功能与验证层级见下文 |
| `adec79bd4e` | Add project settings flyout and changes dot to inset layout | 代码已合入；功能与验证层级见下文 |
| `ff0415ec7a` | Round usage chips and session rows to rounded-md | 账号接续代码已合入；模型/限额定向测试通过，真实账号待验 |
| `a299b4beda` | Scope Inbox, Notes, and Automations to the active project | 代码已合入；功能与验证层级见下文 |
| `4cc771c517` | Add hover-peek behavior for collapsed sidebar | 代码已合入；功能与验证层级见下文 |
| `9b29d7a8b1` | Move development badge to usage footer | 代码已合入；功能与验证层级见下文 |
| `b184f3fd7b` | Add Mono tabs to the inset glass layout | 代码已合入；功能与验证层级见下文 |
| `5259f86b9b` | Use neutral theme tint for inset layout | 代码已合入；功能与验证层级见下文 |
| `5eed991759` | Preserve full-height layout during right panel transitions | 代码已合入；功能与验证层级见下文 |
| `fe0fae2f2b` | Use applied workspace theme for native window tint | 代码已合入；功能与验证层级见下文 |
| `fafb1c61b2` | Unify inset glass hairline strokes | 代码已合入；功能与验证层级见下文 |
| `0df144cecb` | Move development indicator into the title bar | 代码已合入；功能与验证层级见下文 |
| `4c9170dc64` | Share inset sidebar width with project rail | 代码已合入；功能与验证层级见下文 |
| `832e07c2c3` | Align transcript scrolling with top and bottom fades | 代码已合入；功能与验证层级见下文 |
| `04621b4d61` | Align mono tabs with sidebar projects | 代码已合入；功能与验证层级见下文 |
| `f6df42dcd4` | Polish orchestration sidebar glass layout | 代码已合入；功能与验证层级见下文 |
| `45e2de7781` | Keep operator-started sessions in the sidebar | 代码已合入；功能与验证层级见下文 |
| `7b5b20ee47` | Make the new glass layout opt-in | 代码已合入；功能与验证层级见下文 |
| `6af8ee7193` | Merge remote-tracking branch 'origin/main' into mc/linear-style-glass-layout | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `65034143a3` | Redesign resource pressure notice with grouped stop controls | 代码已合入；功能与验证层级见下文 |
| `cfd2c0d03f` | Preserve opaque window state across theme changes | 代码已合入；功能与验证层级见下文 |
| `e802e398b3` | Keep headerless sidebar resizer visually transparent | 代码已合入；功能与验证层级见下文 |
| `88cc817f7c` | Keep resource monitoring independent of approval toasts | 代码已合入；功能与验证层级见下文 |
| `fda9bb1db1` | Make right panel tabs reorderable and add project space tooltips | 代码已合入；功能与验证层级见下文 |
| `87f5063d38` | Merge release/0.14.0 into mc/linear-style-glass-layout | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `eaa34c146f` | Merge main into mc/linear-style-glass-layout | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `b748d0be2d` | Merge new layout and glass appearance into main | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `c8ed89104f` | Improve empty session layout responsiveness | 代码已合入；功能与验证层级见下文 |
| `123e58f4f1` | Soften session review card borders | 代码已合入；功能与验证层级见下文 |
| `b8035a534b` | Prevent workspace tab flicker during view transitions | 代码已合入；功能与验证层级见下文 |
| `2a5003ff1e` | Fix tab closing around Mono and app view tabs | 代码已合入；功能与验证层级见下文 |
| `4e97c5d24a` | Disable right panel toggle on app views | 代码已合入；功能与验证层级见下文 |
| `5adf77a554` | Stabilize translucent card rendering on macOS | 平台代码已合入；Windows 构建检查通过，macOS 实机待验 |
| `631a65a958` | Use native macOS backdrop blur for workspace glass | 平台代码已合入；Windows 构建检查通过，macOS 实机待验 |
| `eda9cbca34` | Merge pull request #1038 from zcy22606/fix/group-focus-within-invalidation | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `695fcf6698` | Merge pull request #1028 from zcy22606/fix/keydown-recorder-check | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `6b4a4a469d` | Merge pull request #1029 from zcy22606/fix/mention-index-rebuilds | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `5121fc1070` | Merge remote-tracking branch 'origin/main' | 随主线合并；无独立用户操作；本版编译/定向测试覆盖最终树 |
| `36666b9a08` | Polish inset usage chips and modal surfaces | 代码已合入；功能与验证层级见下文 |
| `5aabe2dd10` | Handle fullscreen traffic light insets in title bars | 平台代码已合入；Windows 构建检查通过，macOS 实机待验 |
| `47ada45fba` | Refine message queue styling and inset composer integration | 代码已合入；功能与验证层级见下文 |
| `a18a217d86` | Add a dedicated Git history tab to the right sidebar | 代码已合入；功能与验证层级见下文 |
| `e0dc740a7f` | Keep review tabs mounted and speed up unified diff rendering | 代码已合入；功能与验证层级见下文 |
| `47c3d30baa` | Drive code syntax colors from workspace theme variables | 代码已合入；功能与验证层级见下文 |
| `730039ceed` | Switch code syntax colors to VS Code Dark+ and Light+ | 代码已合入；功能与验证层级见下文 |
| `61719cffcc` | Route session sidebar shortcut to right panel in inset layout | 代码已合入；功能与验证层级见下文 |
| `5f1cc6eb84` | Carry usage-limited sessions to another provider account | 账号接续代码已合入；模型/限额定向测试通过，真实账号待验 |
| `b8119f74f7` | Animate project dock open and close in inset layout | 代码已合入；功能与验证层级见下文 |
| `b6abdb0549` | Animate split panes sliding in and out with file pane deferral | 代码已合入；功能与验证层级见下文 |
| `eee44a48e3` | Add unreleased changelog entries for new layout and fixes | 来源记录已核对；MyCode 发布内容另行撰写 |
| `443cc53101` | Format provider session transfer tests with rustfmt | 测试/格式变更已合入；相应验证结果见下文 |
| `a18874939f` | Fix browser CI tab dragging and reader anchoring | 测试/格式变更已合入；相应验证结果见下文 |
| `c1817d9651` | Wait for reveal progression in browser pacing test | 测试/格式变更已合入；相应验证结果见下文 |
| `a90c558d7b` | Render prefetched diffs without suspending during streaming | 代码已合入；功能与验证层级见下文 |
| `30cd9306c0` | Let cold-loaded surfaces mount while sessions stream | 代码已合入；功能与验证层级见下文 |
| `e53e09aad2` | Release v0.15.0 | 保留上游版本来源；MyCode 独立版本为 0.23.4 |

## 本版实际融合

- **新版工作区**：上游可选 inset 布局、侧栏、标签页、项目切换和主题作为主行为。保留经典布局与当前设置；MyCode 的项目栏首页入口、语音命令和独立群任务重新接入新页面结构。新版布局与主题的中文、英文文案已补齐。
- **项目范围和右侧工具**：收件箱、笔记、自动化按当前项目呈现；右侧 Git 历史标签、差异审阅、文件暂存和丢弃操作沿用上游逻辑。MyCode 既有模型连接和会话数据不搬迁。
- **限额后账号接续**：融入上游多账号接续及原生转移逻辑；沿用 MyCode 的账号和模型路由选择，真实服务商限额场景尚未执行。
- **性能与资源**：合入延迟构建、搜索索引、差异窗口化和高亮工作线程、转录与动画修复；资源提示改为按会话分组并保持用户主动停止的安全边界。新增资源操作及错误提示已汉化，空状态显示 MyCode 品牌。
- **平台范围**：macOS 背景模糊和窗口按钮逻辑随上游合入，属于 macOS 专项；Windows 继续使用 MyCode 品牌、安装包与现有模型路由。平台能力以实际运行平台为准。

## Cindy 与 Synara 对照

| 来源 | 基线 → 本次 main | 本地适用性与处置 |
| --- | --- | --- |
| Cindy | `77e2c32d` → `e6c546633deb18ab3b2ebd94fa359258fdb8378e`，121 提交 | 核对本地任务中断续接、错误卡诊断入口、富文本答复与远端历史连续性；这些实现跨 Cindy 的桌面/移动/远程链路，本版没有复制云同步或云调度。旧群聊不复活，独立群任务仍隔离保存。 |
| Synara | `b8cf9382` → `299fd573b1d6520c323a87c78d30be74e87e53e1`，4 提交 | 核对空闲代理模拟器清理、SQLite 删除页回收、MCP 写入凭据恢复和非 Git 目录任务收尾；属于其服务器/Hub 架构。本版不把设计审查冒称代码移植。 |

上游本轮没有提供可替换 MyCode 已移除旧群聊、Freebuff 或额外 CLI 启动通知的同类成熟功能，因此不恢复这些运行入口。历史文件和凭据保留。独立群任务继续使用独立目录和记忆，自动闲聊默认关闭，由用户启用并设置 Token 上限。此次更新没有迁移、移动或删除现有项目、凭据、会话历史。

## 验证与交付边界

- TypeScript 类型检查、生产前端构建（3751 模块）、Rust `cargo check -p monocode --lib` 与 `cargo fmt --check` 通过。Tailwind 样式扫描限定到应用源码和入口页面，保留 Streamdown 显式来源，解决本机先前的构建耗时问题。
- 原有 14 个前端定向测试文件共 152 项通过；最终增量复跑 5 文件 73 项通过，覆盖新增中英文文案、设置、项目范围、限额和资源提示。Rust `provider_session_transfer` 定向 3 项通过。
- Chromium 浏览器初轮曾因 Vite 首次加载超过 90 秒超时；重启后复跑新版布局单项通过，随后布局、应用标签、资源面板及差异审阅整组 12 项通过。以上为浏览器模拟验证，不等于安装后的桌面验收。
- Windows NSIS 安装包、六平台 Host 独立分支及公开附件校验以最终发布记录补齐。安装后升级、真实账号、macOS 实机与异地 Host 仍需对应环境验收。
