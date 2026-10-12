# MyCode 0.20.0（2026-10-12）

## 基线与交付要求

完整合并 MonoCode main，由上一版 `fe5c10e33e71e04130d52ab33912c33ec13e0458` 更新至 `889579b61c2342cc27751092ff0effbe9ec8e162`（发行版 v0.12.0）。保留 MyCode 品牌、Windows、自定义模型和已有用户数据。新能力包括英文和简体中文，逐项验证后交付 Windows 安装包及源码。

Cindy 从 `a152497ac24d155dd46142b73dda4fa10ad08ad0` 比较至 `28afb1e98a01e5e1abfc86d9ec20483bec2dcf15`；Synara 从 `6f54f53c66348a9a19c65779daaabd96113773eb` 比较至 `9e01962e0b1e8fec9fb0e17f17a64017bc4eaf94`。仅采用可在本地运行且适合当前架构的补充能力。

## 必须融合的 MonoCode 能力清单

1. Devin CLI：ACP 对话、权限审批、模型目录、推理控制、子智能体、登录与额度；Windows 按官方清单进行应用内安装/版本检测和校验。
2. 选中文件的 Git 提交与上下文：独立索引、保护其他已暂存内容、远程 Host 对应接口。
3. 常驻智能体：折叠栏固定显示、未读回复计数、emoji-only 表情反应、启动项目任务状态卡、侧栏显示启动的任务、单行产物卡与悬停操作。
4. 常驻智能体主会话输入框：模型及推理控件、上下文用量计、内置 Emoji 搜索/分类/肤色/最近使用；保留 MyCode 引用块、发送快捷键、自动编号。
5. 视频预览：元数据、原生控件、隐藏工作区时暂停、StrictMode 安全释放媒体资源；格式支持以系统 WebView 为准。
6. 资源与性能：空闲代理保留上限、输出批处理、流式期间稳定对象、终端标题轮询和网格重绘优化、实时文字渐显与节奏。
7. 任务审阅：后续编辑/继续会话/提交后的检查点、成功编辑归属与共享工作区保护、缓存及恢复。
8. Windows 多窗口与单实例、新会话归属当前项目、跨窗口主题同步、文件揭示后台执行；macOS 文件 URL 粘贴修复按平台保留。
9. 滚动/拖动：手动滚动脱离跟随、丢失/快速 pointerup 的排序与分屏拖放、隐去原生滚动条、浮窗大小与滑动恢复、复用会话的回复恢复。
10. 官方文档重组与所有增量修复、回归测试完整合入；不因与 MyCode 重叠而跳过。

## MyCode 修复与补充

- Freebuff 从启动探测、更新事件、安装、原生解析和界面中退出；旧配置忽略、旧事件不再引起重新探测。既有安装文件与凭据不删除。
- CLI 更新统一沿用 MonoCode 的更新提示，取消 MyCode 额外提示及已安装 CLI 的新会话版本弹窗。应用内安装和其他现有代理融入同一链路；未安装时保留安装准备。
- 每轮常驻请求明确 MyCode 产品身份与当前昵称，提高身份版本让已有原生会话重新接收规则；旧 SOUL/记忆/历史原文不改。真实 CLI 命令不改其语法，且不将未交付上下文记作已交付。
- 读取其他会话时的系统完成摘要改为 MyCode，内部事件、协议标签、兼容 ID 保持原样。
- Emoji 中英文目录内置于程序，不依赖在线数据；原有最近使用和肤色偏好保留。原地切换语言同步刷新检索目录；“打开”操作与“待处理”状态使用不同翻译上下文。
- 参考 Cindy `28afb1e98` 增加自动化“跟随新建会话默认”：运行时解析当前项目默认，不写死模型；明确模型或连接的任务维持原路由和权限。
- 对照 Synara `370b42c0` 验证 HTTP/SSH 的原命令 ID 持久化、用户明确重试和回执去重；参考 `fc6fd90c` 修复 Host 启动绑定不可用旧代理而崩溃的问题，保留历史、标记中断、禁止自动重放。未声称移植其 WebSocket 分类/断路器或完整 Hub 架构。

## 完整上游增量提交清单

- `416396c` Fix trackpad zoom subscription failures and cleanup
- `735f2db` Fix Windows checkpoint overlap path comparisons
- `4fdc371` Pin Monos to the collapsed project rail
- `dadac56` Merge remote-tracking branch 'origin/main'
- `fd9d4f7` Add Devin CLI as a harness over ACP (#748)
- `9341c08` Support safe selected-file Git commits and context
- `7d099eb` Fix Windows path normalization and temp directory permissions
- `fed7e71` Release 0.11.0
- `7fdd048` Fix new sessions opening in a different project (#896)
- `aa5b0d9` Include new-session project fix in 0.11.0 release notes
- `794a594` Fix macOS Explorer paste of file reference URLs (#635)
- `db1c5d6` Include Finder paste fix in 0.11.0 release notes
- `1ef5357` Fix file-navigation fixture on slower CI runners
- `3c34984` Restructure documentation into focused setup guides
- `7f3bf9b` Hide native scrollbars across the app
- `844fefd` Shrink Mono chat window to 440pt wide and 560pt tall
- `fb1aa9b` Sync theme changes across windows (#909)
- `6793b0e` Fix blank window from New Window on Windows (#908)
- `1a28c17` Reopen the running instance instead of starting another on Windows (#905)
- `127f279` Show a Mono's changes button on the turn that edited files
- `624e603` Run reveal_path off the main thread (#902)
- `7ac102c` Show a Mono's emoji-only reply as a reaction on the message
- `214283c` Pause transcript following on manual scroll input
- `f5ba0a5` Make session reviews resilient to edits and continuations
- `e631dac` Show Mono reaction badges on user messages
- `6809533` Shrink subagent mascot sprite inside fixed icon slot
- `29350f3` Fix checkpoint turn test filename handling on Windows
- `79b3642` Add video file previews
- `3c3e895` Speed up terminal title polling and trim grid background redraws
- `3b2943d` Batch harness output and skip re-renders while sessions stream
- `8f5652b` Pause video previews when their workspace tab is hidden
- `e7e19fe` Cap idle warm agent CLIs with a Keep idle agents setting
- `9d9f858` Show unread reply counts on Mono rail badges
- `76c7a42` Restore video loading and harden browser test diagnostics
- `e6aaa2c` Release v0.12.0
- `278daa0` Fix tab drag pane drops and fast-release reordering
- `08c1fdc` Stabilize Linux title tab reorder test
- `642d330` Stream chat replies as they arrive with cadence-timed fades
- `49b4e52` Defer video source release to survive StrictMode replay
- `6a5b8d1` Avoid Cursor login flow during model discovery
- `efecfc9` Show Mono-launched sessions in the sessions sidebar
- `b67db22` Add model controls beneath the Mono composer input
- `50ef2ce` Add emoji picker button to the Mono composer
- `256a570` Show context usage meter beside Mono model controls
- `6bf1920` Restyle Mono composer tool buttons as icon-only with hover backdrop
- `8782ef6` Remove unused Tauri emoji picker platform module
- `ac35b78` Add emoji picker to the Mono composer
- `0b102cb` Redesign artifact card as compact status chip
- `42c058e` Show Mono's launched sessions as status cards in chat
- `ab5dee1` Reveal Mono turn actions on hover in a fixed gap
- `4e3664f` Smooth Mono reply reveals and recover reused sessions
- `d2cbf76` Prevent Mono completion layout shifts
- `629ac20` Hide ready Mono completion prompts during delivery
- `558f238` Stack messages after a Mono reaction and restyle reaction badges
- `889579b` Wait for the wheel to settle before measuring Mono glide interruption

## 验证与边界

程序源码 `83fa29f153d14b00e87567204a6ffc52f8bc9dd3` 的 [CI 8 项任务全部通过](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/38204063194)。发行验证文档的补充不修改已验证程序。

| 检查 | 实际结果 |
| --- | --- |
| 前端完整回归 | Windows、macOS、Linux 各 505 文件、5,217 项通过 |
| 原生完整回归 | Windows 627、Linux 652、macOS 698 项通过；各 1 项明确忽略 |
| Host 完整回归 | Windows 100 通过/14 平台跳过；Linux、macOS 各 109 通过/5 平台跳过 |
| 浏览器 | Chromium、WebKit 共 48 项通过，含中英文 Emoji 原地切换、真实视频解码/播放/拖动/隐藏暂停及任务卡/滚动 |
| 静态与打包 | TypeScript、Rust 格式、Clippy、AppImage 主机库、Fedora/EL10 RPM 构建及干净 RPM 安装通过 |
| Windows 安装包 | 0.20.0，39,110,763 字节；解包与编译文件比较通过，438 个正式 JS/CSS 资源均嵌入，含懒加载 Emoji 目录；程序 app --help 与内置 Node/npm 执行通过 |
| Host 运行包 | 六个平台包及 SHA-256 文件完整；包内容、Node 许可、Unix 执行位通过，Windows x64 实际执行版本 0.20.0；其他架构未在本机执行 |
| CLI 补充验证 | Devin 官方 Windows ZIP 校验及隔离 --version 通过；六个额外 CLI 的官方版本源实际 GET 通过；统一更新/安装准备相关 38 项聚焦测试通过 |

安装包 SHA-256：`469fdd312e96cac9173c60b7ac1859e41ecde945b376f0f1eb18cae9933f3b86`。公开下载的校验记录随发行版提供，见 verification-0.20.0.json 与 host-verification-0.20.0.json。

本机 Vite 冷加载曾导航超时，额外使用预编译真实组件与正式 CSS 复核 9 项；最终标准 CI 的 Chromium/WebKit 全部通过。真实账号登录、付费模型请求、真实跨系统 SSH 主机安装及 macOS 实机界面操作未以模拟测试代替。

常驻模型完整控件位于主会话，紧凑浮窗跳转主窗口修改。Git 文案生成仍沿用上游 Claude/Cursor/Codex/Grok/OpenCode 范围；选中文件安全提交可用，不宣称 Devin 或所有自定义连接均支持自动生成文案。
