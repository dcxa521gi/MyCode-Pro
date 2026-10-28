# MyCode 0.23.11 更新记录（2026-10-28）

## 上游核对

计划运行：北京时间 10:00；本轮实际开始：10:01。以 0.23.10 已发布代码及 10 月 27 日审计作为基线。

| 来源 | 上次基线 → 本轮主线 | 增量 | 处理 |
| --- | --- | ---: | --- |
| MonoCode | `26465c620977f3951d0a532a0f7db32c3c179007` → 同一提交 | 0 | 最新正式版仍为 v0.16.0；无新增 MonoCode 功能、能力、修复或改进待融合。独立 Native 预览维持隔离评估。 |
| Cindy | `abe4d6574b07af6c1e3b0abfa29c6d66051814c4` → `cdfec9aa5b8cd1bcd6018477b14b20cb0d7168d5` | 426 | 正式版仍为 v0.1.115；本轮适配本地 Android composer 点击恢复，详见下文。 |
| Synara | `ea912dcf14a38c12f30ebc3bfdf80af6ca446bea` → 同一提交 | 0 | 最新正式版仍为 v1.0.9；无新提交。 |

[Cindy 完整提交差异](https://github.com/makecindy/cindy/compare/abe4d6574b07af6c1e3b0abfa29c6d66051814c4...cdfec9aa5b8cd1bcd6018477b14b20cb0d7168d5) 包含云账户、伙伴、群聊、浏览器配方、桌面截图/录屏、模型目录、手机交互与任务修复。不能把整个 Cindy 后端替换到 MyCode 的本地 CLI/Host 架构。此次取其中可独立运行的手机输入操作修复；其余不宣称已集成。

## 本版适配与边界

- 参考 Cindy [`bb52c26d2c`](https://github.com/makecindy/cindy/commit/bb52c26d2c958af7c67ef126eaab848d8ec408c8) 的 Android 输入法中断手势处理，MyCode 手机伴侣为发送、停止与模型按钮实现 300 毫秒补发、12 点漂移取消与单次执行保护。沿用 React Native Pressable 和本项目既有会话/草稿，不接入 Cindy 云服务或其 WebView composer。
- 正常松手立即执行；只有 Android 输入法取消手势导致 `onPress` 未抵达时才在宽限后补发。iOS 保持正常点击语义；语音按钮与原生附件菜单保持原有触摸逻辑。按钮禁用、组件卸载时撤销待执行操作。
- 本轮没有新增操作文案；补齐原有模型按钮默认值与辅助提示的简体中文，并核对英文。用户项目、会话、凭据和配对数据不迁移。
- Cindy 云服务、Freebuff、重复 CLI 更新提示、顶部模式切换均维持现行移除决定；旧群聊入口不直接恢复。若上游形成成熟且可本地运行的三端同类能力，可按最新用户要求重新适配，仍须每群独立目录/记忆、闲聊默认关闭及 Token 上限，并验证旧数据兼容。Cindy 截图、录屏与 GIF 属完整桌面采集和编码链，当前 MyCode 缺少与其权限/录制生命周期等价的本地适配；下一步先限定 Windows 区域截图到当前任务附件并验证权限、回收和双语，再评估滚动截图与录屏。Synara 的附件重放保护仍需 MyCode 移动协议事件映射测试，不能直接移入其 Hub。

## 验证与发行

产品实现提交 `dbc6cc31f84940f4850784d0024d057680af67cf`。手机聚焦 10 项、手机完整 137 项、跨端协议 2 项通过；手机 TypeScript、双语检查及 lint 通过（lint 仍有两条既有的 dictation 导入警告）。Windows 前端生产构建、Rust 格式检查与原生程序 `app --help` 加载检查通过。

桌面完整 Vitest 为 552 个测试文件、5,668 项通过，TypeScript 通过。既有的部分 React `act(...)` 控制台警告未作为通过断言。

产品代码及浏览器检查修复已推送到 MyCode-Pro 主分支，源码标签 `v0.23.11` 指向 `cccf5f6a390ca58dcec67e8b4cba19f4a3d531b4`；[主分支 CI 40621718246](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40621718246) 全部 10 个作业通过，包括 Windows、Linux、macOS、手机、浏览器和 Host 检查。

Windows NSIS 安装包 `build/release-verify-0.23.11/MyCode_0.23.11_x64-setup.exe` 为 41,406,784 字节，MyCode 产品名、产品/文件版本均为 0.23.11；SHA-256 为 `ee9e4a8b875ca0aa35dd115bb872d94ed43949d99748f899e339d481ac176c33`，同目录的 `SHA256SUMS.txt` 与其一致。没有在现有用户安装上执行覆盖升级。

上一轮主分支 CI 的浏览器失败来自一条未标 URL 的 403 资源控制台消息；本轮改为单独拒绝同源 403，继续拒绝应用脚本异常。Windows 本地 WebKit 的字符锚点 API 无法稳定取得可见文字，该环境的用例已明确跳过，Linux CI 仍执行；本地 Chromium 的完整拖拽、跟随和读者锚点用例通过（1/1）。

[Android 签名预检 CI](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40619524672) 成功：工作流用 `apksigner` 和 `aapt` 核对 APK v2 签名、包名 `com.dcxa521gi.mycodemobile`、versionCode `2311`、versionName `0.23.11`，并在 API 35 x86_64 模拟器安装启动。下载的本地 `build/release-verify-0.23.11/MyCode_0.23.11_Android.apk` 为 103,467,671 字节，SHA-256 `ac3f1ecfa9162c25d7882787667a3d268564b427fb98d1c872d19ecea35a7993`，与 CI 校验文件相同。模拟器通过不代替实体设备上的输入法/配对验收；iOS 不发布 IPA。

六种版本匹配的 MyCode Host 归档及 SHA-256 文件已发布到独立 [mycode-host-v0.23.11](https://github.com/dcxa521gi/MyCode-Pro/tree/mycode-host-v0.23.11) 分支，远端与本地提交均为 `e2847f67e4cc11605b475bcf05d06452891a38c2`；清单和 README 一并构成 14 个远端文件，逐一与本地 Git blob 核对，六包也逐一与 CI SHA-256 文件核对。桌面发行页不上传 Host 归档。

[MyCode 0.23.11 公开发行](https://github.com/dcxa521gi/MyCode-Pro/releases/tag/v0.23.11)于北京时间 2026-10-28 10:56:31 发布。发行 JSON 白名单检查通过，恰有 Windows 安装包、签名 Android 伴侣 APK 与各自的 SHA-256 文件四个附件；公开资源的 digest 与本地原件相同。四个附件从无需登录的公开 URL 重新下载，下载字节数与 SHA-256 均逐一匹配本地原件及两份校验文件。没有移除旧发行附件，未发布 Host 包、上游品牌安装包或 iOS IPA。

没有执行 Windows 既有用户覆盖安装、Android 实体设备输入法/配对及 iOS 实机验收。正式标签触发的重复 APK CI 可另行核对；本版签名、包身份、模拟器安装启动及公开下载验收基于成功的 0.23.11 预检 CI 和相同产品代码。
