# MyCode 0.24.0 更新记录（2026-11-23）

## 上游核对范围

以 2026-10-20 的 0.23.7 记录为起点，并以最后已发行的 0.23.11（2026-10-28）为代码合并基线。三方提交范围、逐提交 CSV 和能力处置见 [核对记录](upstream-audits/2026-11-23-since-2026-10-20.md)。MonoCode 主线共增加 460 次提交，其中 0.23.11 之后的 457 次是本轮实际新增核对范围；Cindy 13,422 次、Synara 873 次提交均列入索引，不能把提交总数等同于 MyCode 已上线的功能数。

## 本轮适配

- 融合 MonoCode 手机端的图片粘贴、截图无损处理、发送失败恢复、代码块复制与语言标记、会话恢复、离线编辑、智能体列表和布局切换等增量。配对入口、手机会话缓存、项目选择与 MyCode 品牌保持兼容；新增入口补充简体中文。
- 合入 MonoCode 新 core 与 GPUI 原生预览源码供后续验证。原生预览版的分屏、终端拖拽、标签、改动审阅等界面目前没有成为正式 Tauri 客户端功能；英文 UI 也未达到 MyCode 双语交付门槛，不能宣称这些界面已经上线。
- 采用 MonoCode Host 的带校验重试式 Node 运行时下载，并保留 MyCode 独立 Host 归档发布方式。
- 参考 Cindy `283afddc65`，仅对已知 DeepSeek Flash 和 V4.1 Flash 型号在服务商未提供输入模态时补充图片输入能力；服务商明确给出的元数据继续优先。旧 V4 Flash 与文字专用变体不会被标为视觉模型。
- 参考 Synara `9d7b556057`，会话 Markdown 块按正文主导文字确定从左到右或从右到左的阅读方向；链接、内联代码和围栏代码不参与判定。

## 验证状态

- 桌面前端生产构建通过；MyCode Host 运行时下载的 30 项单元测试通过。
- 手机 TypeScript 和中文词条检查通过；安卓权限聚焦 5 项测试通过；完整手机测试首轮有 34 个文件通过、1 个权限用例因本机资源并发导致 25 秒子进程超时，放宽超时后单独重跑通过。
- Rust 格式检查及 DeepSeek 图片输入回归用例通过。
- Windows NSIS 安装包已按最终产品代码在本机 MSVC 环境重建并核对产品名和版本号。`MyCode_0.24.0_x64-setup.exe` 为 41,438,705 字节，SHA-256 为 `2b2b2f6de6091d16fa2b298f305588204699cb9ec31950638ac803cab750b9ba`。
- 桌面全量 Vitest 本机首轮 554 个文件通过、1 个文件中的 2 项等待超时；该文件单独重跑 4/4 通过。[主线干净 CI](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/45165712584) 的 Windows、macOS、Ubuntu、手机、浏览器与发行隔离检查均通过，Fedora/AlmaLinux RPM 构建及安装检查通过。
- Host 六个平台归档已打包，逐一校验 SHA-256，并独立上传至 `mycode-host-v0.24.0` 分支；它们不属于桌面发布页附件。
- [正式标签的安卓签名构建 CI](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/45168559655) 成功，核对了签名、包名 `com.dcxa521gi.mycodemobile`、版本号 0.24.0、versionCode 2400，并在 API 35 模拟器安装启动。最终本地 APK 为 103,922,155 字节，SHA-256 为 `678435a3e8e3b386900f6083b53b656339d139bc3cc788723d9c5dd67384a04e`，与 CI 校验文件一致。实机配对与图片发送尚未验收。

正式源码标签为 [`v0.24.0`](https://github.com/dcxa521gi/MyCode-Pro/releases/tag/v0.24.0)，提交 `f57b6b1d629b08bf182d1650ba120aa8c26fb0c4`。发布页仅含 MyCode Windows 安装包、安卓 APK 和必要的两份校验文件，公开下载后逐个核对字节数和 SHA-256，均与本地交付目录一致。源码验证分支为 `codex/0.24.0-upstream-unification`；测试用预发布标签只用于签名 APK 构建。当前凭据不能通过 GitHub API 创建 PR 或手动触发 Windows 工作流，Windows 在本机 MSVC 环境构建。
