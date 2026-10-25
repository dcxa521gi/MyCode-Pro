# MyCode 发布页与下载规则

2026-10-13 起，桌面发行页只介绍 MyCode，不列出上游产品介绍或其他产品安装包。源代码内的开源许可、归属和融合记录必须保留。

0.23.5 起，上传附件为 `MyCode_<版本>_x64-setup.exe`、`SHA256SUMS.txt`、同版本发行签名的 `MyCode_<版本>_Android.apk` 和 `SHA256SUMS-Android-<版本>.txt`，以及可选的 `verification-<版本>.json`。Android 文件是 MyCode 手机伴侣，旧 Android 控制器不作为新发布包；iOS 保留源码供用户自行签名，不上传 IPA。以后增加其他 MyCode 平台安装包或自动更新签名时，需要同时明确更新附件检查规则。

GitHub 自动生成的 Source code (zip/tar.gz) 是本仓库源码归档，不是额外上传的上游安装包，也无法按普通 release asset 删除。

## 发布流程

1. 核对上游并维护版本来源台账；软件升级遵守 AGENTS.md，发布页整理不能冒充功能升级。
2. 构建 MyCode Windows 安装包及同版本发行签名 Android 伴侣 APK；验证桌面版本、运行时和界面资源，并验证 APK 包名、versionCode、versionName、签名、安装启动及两份 SHA-256 校验文件。模拟器通过不代替真机验收。
3. 需要发布 SSH Host 时，运行 `node scripts/publish-host-downloads.mjs`，下载组件使用独立的 `mycode-host-v<版本>` 分支，不进入桌面 Releases。外部附件名统一为 MyCode；内部入口和既有用户数据目录保留兼容。
4. 完整下载并核验六种 Host 包。组件分支一经客户端引用，不删除、不挪动，不覆盖同版本的不同内容。
5. 发布 MyCode 标题、介绍、Windows 安装包、Android APK 与校验文件。用 GitHub API 获取 release JSON，执行 `node scripts/check-release-assets.mjs <release.json>`，检查附件白名单和描述。
6. 重新下载公开 Windows 安装包、Android APK 及校验文件，验证尺寸与哈希；交付本地安装包绝对路径与发行链接。

## 0.20.0 发布页修正

原发布页上传了六个平台的 Host 压缩包、六个校验文件和一个 Host 验证记录，附件名保留了上游技术前缀。这些属于 MyCode 的远程运行组件，不是其他桌面安装包。修正版将其从桌面发行页移出，更新 SSH 引导下载地址，并保持原 Host 数据、凭据和入口兼容。

已安装原 0.20.0 的客户端需要安装同版本修正版后再新建 SSH Host。已经配置成功的 Host 不因下载地址迁移被删除。

此次属于 0.20.0 发布维护，保留现有功能基线。2026-10-13 核对发现 MonoCode main 已到 `633730d70dd3e6cb8113af28c062dd1ea9228c0d`（v0.13.0），相对本版基线新增 26 个提交；它们不属于此次发布页清理，必须在下一次软件升级中逐项融合、汉化与验证，不能将本次核对当作已集成。Cindy 与 Synara 当前提交和本版记录一致。

### 下一次软件升级的上游提交清单

- [ ] `7c8badb` Move Mono mascot and color pickers into a popover — 待下一次软件升级融合、汉化与验证。
- [ ] `ebd0745` Rename Mono sessions panel and add settings dialog tests — 待下一次软件升级融合、汉化与验证。
- [ ] `35a4979` Merge Mono details and sessions into an overview panel — 待下一次软件升级融合、汉化与验证。
- [ ] `9a8fe62` Keep Mono session and habit lists from loading blank — 待下一次软件升级融合、汉化与验证。
- [ ] `fc03409` Move Mono name field under its mascot in settings — 待下一次软件升级融合、汉化与验证。
- [ ] `fcb56cd` Keep Mono session and artifact cards from overflowing their container — 待下一次软件升级融合、汉化与验证。
- [ ] `62de674` Show artifact cards as document icon with title — 待下一次软件升级融合、汉化与验证。
- [ ] `70eda81` Extract usage chips into UsageChips and show them in Mono composer — 待下一次软件升级融合、汉化与验证。
- [ ] `a3035df` Add session search, filters, and empty states to Mono overview — 待下一次软件升级融合、汉化与验证。
- [ ] `40c4246` Group Mono habits by day state and page session cards — 待下一次软件升级融合、汉化与验证。
- [ ] `8f8ceee` Make Mono overview open by default and sidebar sessions opt-in — 待下一次软件升级融合、汉化与验证。
- [ ] `90ded7a` Widen default Mono sidebar width to 400px — 待下一次软件升级融合、汉化与验证。
- [ ] `e43b380` Reopen the last open Mono on launch — 待下一次软件升级融合、汉化与验证。
- [ ] `564316b` Show Mono session model as provider mark in card footer — 待下一次软件升级融合、汉化与验证。
- [ ] `5948a14` Add per-repo commit tabs to the Mono changes view — 待下一次软件升级融合、汉化与验证。
- [ ] `8b70dc8` Move Mono session changes into the overview's Changes tab — 待下一次软件升级融合、汉化与验证。
- [ ] `8dec243` Show an empty context ring for new conversations — 待下一次软件升级融合、汉化与验证。
- [ ] `1088e0e` Dot the folded Changes tab icon when it has changes — 待下一次软件升级融合、汉化与验证。
- [ ] `c30dbe1` Hide handoff and second-opinion actions in Mono view — 待下一次软件升级融合、汉化与验证。
- [ ] `d8cb37e` Open Mono artifacts in the overview documents tab — 待下一次软件升级融合、汉化与验证。
- [ ] `95320d0` Synchronize session updates with React state — 待下一次软件升级融合、汉化与验证。
- [ ] `ab2a6af` Add HTML visual artifacts rendered in a sandboxed frame — 待下一次软件升级融合、汉化与验证。
- [ ] `70fb3ea` Show local images and videos linked in Mono replies — 待下一次软件升级融合、汉化与验证。
- [ ] `649cead` Reset Mono overview state when switching to another Mono — 待下一次软件升级融合、汉化与验证。
- [ ] `9a9df5e` Open changed files in inline diff viewer — 待下一次软件升级融合、汉化与验证。
- [ ] `633730d` Release v0.13.0 — 待下一次软件升级融合、汉化与验证。

## 本次完成记录

- 0.20.0 发布页现仅上传 MyCode 安装包、SHA256SUMS.txt 和 verification-0.20.0.json；13 个旧 Host 附件已移除，介绍仅显示 MyCode。
- 修正版安装包大小 39,119,614 字节，SHA-256：9c3450f248bce019c692841d51576a8c5014314dcf2ba4f71932a95a8030a4fc；正式公开下载与本地文件一致。
- SSH 引导目标测试通过；Windows Host 三项集成测试通过，Unix 三项因 Windows 环境跳过。Rust 格式检查通过，438 个内嵌前端资源校验通过，安装包内 Node/npm 与程序启动帮助检查通过。未进行真实异地 SSH 部署验收。
- Host 分发提交：c647a5770854e1edb2aff9efd1960d9eb222b8c8；六个平台的完整公开下载、尺寸、SHA-256 和校验文件全部验证通过。
- 程序构建源码 534ce79，发布源码 3c0593b81cba7a99b37764acde94da35741bd44e；其间程序改动仅 Rust 换行格式，其他变动为工作流和文档。
- 原 0.20.0 源码标签保留为 v0.20.0-original-20261012；v0.20.0 指向维护源码。原安装包与旧附件清单保留在本地 build 目录用于回退。
