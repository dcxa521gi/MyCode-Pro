# MyCode 0.22.0 上游逐提交核对

MonoCode 基线：`633730d` → `5c21f01`，共 41 个提交。此表保留上游原始标题便于追溯；“已合入”只表示源码合并，实际验证按下方记录，不代表真实设备或账户验收。合并提交 `226ec5b` 本身无单独用户能力。

| 提交 | 上游变更 | 融合状态 |
| --- | --- | --- |
| b9aa5d6 | Fix IconButton and tab sizing in title bar and Mono overview | 已合入；按相关模块测试与平台范围复核 |
| a26a528 | List sessions started by habit runs on their Mono report | 已合入；按相关模块测试与平台范围复核 |
| 61d11aa | Anchor branch and commit menus to Popover | 已合入；按相关模块测试与平台范围复核 |
| 7580b61 | Show the Mono intro as an inline rail card | 已合入；按相关模块测试与平台范围复核 |
| 834e5b9 | Show model settings for a saved Claude version on first open (#938) | 已合入；按相关模块测试与平台范围复核 |
| 23b4766 | Remember the last Preview or Source choice for previewable files (#929) | 已合入；按相关模块测试与平台范围复核 |
| 7a040c0 | fix(git): read quoted diff paths literally (#815) | 已合入；按相关模块测试与平台范围复核 |
| 86616d2 | List Escape stop in the keybindings settings (#897) | 已合入；按相关模块测试与平台范围复核 |
| 144ca20 | Highlight .env files in the editor (#915) | 已合入；按相关模块测试与平台范围复核 |
| 8f86a16 | fix(git): diff a remote session's linked worktree, not the main checkout (#887) | 已合入；按相关模块测试与平台范围复核 |
| 52a8221 | fix(sessions): shorten Claude model labels to expose versions (#937) | 已合入；按相关模块测试与平台范围复核 |
| 1d1fc81 | Let a session whose worktree was deleted outside the app pick a new checkout (#883) | 已合入；按相关模块测试与平台范围复核 |
| 7a7d64d | Use accent color for Mono rail unread badge | 已合入；按相关模块测试与平台范围复核 |
| a7e3b6d | Wait for asynchronously registered Pi provider models (#921) | 已合入；按相关模块测试与平台范围复核 |
| 1f72b09 | Play a sound when an agent asks a question or needs approval (#801) | 已合入；按相关模块测试与平台范围复核 |
| 2205080 | Make terminal hyperlinks clickable (#782) | 已合入；按相关模块测试与平台范围复核 |
| bbe707a | Remove messaging-style bubble tails from agent chat | 已合入；按相关模块测试与平台范围复核 |
| 5963802 | Group model picker by provider for omp, Pi, and Hermes (#765) | 已合入；按相关模块测试与平台范围复核 |
| 190902f | Drop punctuation-only assistant text from the transcript (#763) | 已合入；按相关模块测试与平台范围复核 |
| 2296c09 | Show token totals for the whole turn on Pi and Codex, not just the last request (#884) | 已合入；按相关模块测试与平台范围复核 |
| 113622c | Add Mono activity view with live and settled trail states | 已合入；按相关模块测试与平台范围复核 |
| d5ce6ec | Replace Mono activity panel with an Activity overview tab | 已合入；按相关模块测试与平台范围复核 |
| 88e9599 | Add drag-to-reorder for project groups (#787) | 已合入；按相关模块测试与平台范围复核 |
| abfef95 | Tighten artifact reader padding and reset first heading margin | 已合入；按相关模块测试与平台范围复核 |
| c74cd42 | Compact Mono composer and model pills in narrow chats | 已合入；按相关模块测试与平台范围复核 |
| a2a1259 | Replace Mono activity icon with a shared TabButton | 已合入；按相关模块测试与平台范围复核 |
| c6d3d38 | Fix footer Terminal button toggle and pressed state (#784) | 已合入；按相关模块测试与平台范围复核 |
| 73a7aa9 | Stop resending a consumed handoff recap on every later turn (#880) | 已合入；按相关模块测试与平台范围复核 |
| f5dd29c | Highlight Vue, Svelte, SCSS, Sass and Less files (#892) | 已合入；按相关模块测试与平台范围复核 |
| 41b7243 | Load extensions while probing omp's model catalog (#846) | 已合入；按相关模块测试与平台范围复核 |
| f8ec8fb | Add instant hover tooltips to compact project rail | 已合入；按相关模块测试与平台范围复核 |
| d1940fd | Show unseen-reply dot on Sessions tab in compact rail | 已合入；按相关模块测试与平台范围复核 |
| 226ec5b | Merge remote-tracking branch 'origin/main' | 已合入；按相关模块测试与平台范围复核 |
| 92708f0 | Stop the composer runner's frame loop while its tab is in the background (#975) | 已合入；按相关模块测试与平台范围复核 |
| 0abb2c8 | Don't treat a refused fast mode as the session's usage limit (#958) | 已合入；按相关模块测试与平台范围复核 |
| 2e0c5e4 | Stop a resumed session's replayed background-task notification from ending the turn early (#532) | 已合入；按相关模块测试与平台范围复核 |
| 33c23f4 | Show skills when the 16 KiB prefix cuts a UTF-8 character (#978) | 已合入；按相关模块测试与平台范围复核 |
| e5c7451 | Stop every composer keystroke from re-checking the whole page's styles on macOS (#985) | 已合入；按相关模块测试与平台范围复核 |
| 8e4da94 | Keep a blank session's account in the project that chose it (#967) | 已合入；按相关模块测试与平台范围复核 |
| 904289f | Fix macOS dev bundle version metadata (#983) | 已合入；按相关模块测试与平台范围复核 |
| 5c21f01 | Run the remote host on Linux without systemd (#990) | 已合入；按相关模块测试与平台范围复核 |

## 验证与平台边界

- 逐提交表中的源码融合由合并提交 `82923c9` 保留上游父提交 `5c21f01` 验证，非仅复制清单。对应验证覆盖：智能体/侧栏与分组（`SidebarRename` 71 项及智能体、项目分组测试）；服务商分组（`ModelPicker` 28 项）；文件与 Git（编辑器和 CRLF Git 4 项）；Host 与远程会话（Host 套件）；原生文件、工作树和会话（Rust 637 项通过、1 项忽略）。
- `tsc --noEmit`、`npm run build`、`cargo fmt --check`、`cargo clippy --workspace --all-targets -- -D warnings` 已通过。前端全量首次运行 5388 项通过、4 项 Windows Git 启动超时；这 4 项在 30 秒阈值下单独复测通过，测试文件已设置适当阈值。高并行负载下 Host 首轮有 4 项失败；Windows 凭据、OpenCode 桥接、Git 分支相关 4 个文件在单工作线程复测 9 项全部通过。公开 CI 独立运行结果另行核对，不将负载下失败抹去。
- 上游 omp 服务商分组适配到 MyCode 已启用的 Pi、Hermes；OpenCode 保留 MyCode 价格分类并按上游服务商排序。omp 在 MyCode 的 Windows 可用代理列表中未启用，不把仅存在于类型定义的代理写成可运行。
- Linux Host 无 systemd 运行逻辑来自上游，本版需以 Host 类型/单元验证；Windows 安装包不冒称 Linux 运行实测。
- 新增界面文案应有简体中文映射，英语原文保持可用；真实微信扫码、生产 IM 推送与公开安装包分别验证。

## 其他两家审阅

- Cindy：`3ea9099` → `0bbf5b3`，128 提交；只使用可本地运行的开源能力。MyCode 本版修补现有 Cindy 微信 iLink 适配中的连接状态、重试和上下文持久化；Cindy 云服务不接入。
- Synara：`b4bdc73` → `a21eb2b`，21 提交；审阅其本地浏览器标签与会话/用量修复。与 MyCode/MonoCode 已有实现重叠的项目以本地回归验证，不把审阅写成代码移植。
