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
- Cindy 云伙伴/群聊、Freebuff、重复 CLI 更新提示、顶部模式切换均维持现行移除决定。Cindy 截图、录屏与 GIF 属完整桌面采集和编码链，当前 MyCode 缺少与其权限/录制生命周期等价的本地适配；下一步先限定 Windows 区域截图到当前任务附件并验证权限、回收和双语，再评估滚动截图与录屏。Synara 的附件重放保护仍需 MyCode 移动协议事件映射测试，不能直接移入其 Hub。

## 验证与发行

待本轮检查完成后记录产品源码提交、Windows 安装包、同版发布签名 Android APK、CI 与公开下载校验。两端门槛未全部通过前，不创建正式 0.23.11 发行。
