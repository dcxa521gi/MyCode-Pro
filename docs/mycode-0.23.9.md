# MyCode 0.23.9 更新记录（2026-10-25）

## 上游核对与融合

本版以 MyCode 0.23.8 及 2026-10-25 10:05 的[上游审计](upstream-audits/2026-10-25.md)为起点。历史移除决定按[功能来源台账](mycode-feature-provenance.md)执行；下表中的“核对”不代表代码移植。

| 来源 | 审计基线 → 本轮 HEAD | 新增提交 | 处置 |
| --- | --- | ---: | --- |
| [MonoCode](https://github.com/hardbeat920/monocode) | `26465c620977f3951d0a532a0f7db32c3c179007` → 同一提交 | 0 | 最新公开版本仍为 v0.16.0；没有新的产品代码需要融合。MyCode 继续保留已融合的上游功能、品牌、模型路由和 Windows 支持。 |
| [Cindy](https://github.com/makecindy/cindy) | `08d178868cdf2803e7618f18d8f882265492d065` → `4ad25a97fb92e90f72c80c91f409a39b4a46fa76` | 10 | 参考 `1192f2ae9`，在 MyCode 手机 Markdown 渲染路径独立实现有界的分词结果复用。其余新增改动的范围及下次动作如下。 |
| [Synara](https://github.com/Emanuele-web04/synara) | `3f55b77ef186764050ecf4edd6ae0879eec948a8` → 同一提交 | 0 | 无新提交；此前的编辑器和任务可靠性候选未计作已融合。 |

### 本次产品变化

- 手机端流式回复中的稳定文本段会复用已分好的词，缓存最多 256 条、约 1 MiB 估算载荷；过大的单段不进入缓存，逐出最久未使用的条目。此优化参考 Cindy 的有界缓存思路，按 MyCode 自有 Markdown 解析器实现，没有复制 Cindy 的解析器或服务。
- 分词输出、Markdown、链接、渐显及中文和英文界面行为保持原样；旧配对、会话、凭据和用户文件没有迁移或删除。
- 核实 10 月 25 日审计所列“文件按数字自然排序”：MyCode 文件列表自 2026-09-23 的 `d55a0f16b99` 起已有目录优先、数字自然排序及回归测试。本版将其改记为**已存在的等价能力**，不重复计为 Cindy 移植。

### Cindy 其余新增提交的具体处置

| 变化 | 判定与下一步 |
| --- | --- |
| `b49fb85f2`、`93fca8f75` 手机列表性能扫描生命周期 | Cindy 的调试扫描页面是其专用测试工具；MyCode 手机会话列表没有该扫描任务。若 MyCode 后续添加性能扫描，先规定离开页面与切换历史视图时的取消和所有权规则。 |
| `4105eaeeb` 项目拖动长按时间 | Cindy 的首页项目拖动手势与 MyCode 手机项目选择路径不同。需在 MyCode 真机上复现误触后确定阈值，不能仅照搬时长数字。 |
| `3e2c47015`、`bfde64aaf` Pi Agent 进程优先级与 Windows CIM 查询 | Cindy 使用专有 Pi 会话进程树；MyCode 的 CLI/Host 生命周期不同。后续先按 MyCode 子进程树和 Windows 权限设计可回退的优先级策略，验证前不改变用户正在运行的进程。 |
| `c01d7491f`、`b35766564`、`e7616b58f`、`4ad25a97f` 合并提交 | 对应上述四组实质改动，不重复算作额外产品功能。 |

旧 `GROUP-CHAT` 运行入口、Freebuff、额外 CLI 更新通知及顶部开发/办公切换不恢复；Cindy 云服务不接入。独立群任务继续使用自己的目录、记忆和默认关闭的自动闲聊设置。

### 上次审计遗留候选的复核

这些候选来自[10 月 25 日审计](upstream-audits/2026-10-25.md)，不能因为本版做了分词缓存就视为全部已融合。

| 候选 | 现有能力、具体差异和下一步 |
| --- | --- |
| 文件自然排序 | 已存在等价功能，代码与测试见 `src-tauri/src/fs.rs`；审计标为未融合有误，本版更正。 |
| 工作树手动对齐远端、远端主分支选择 | MyCode 已有 Git 工作树切换但没有 Cindy 的整套手动对齐事务。下一步先加入脏文件、被忽略文件和其他检出目录的只读预检，再设计确认与回退；未经该验证不接入可能覆盖用户工作的操作。 |
| 任务级上下文档位、价格多单位、模型分类、空闲 Pi 回收 | MyCode 使用多 CLI/Host 模型路由，Cindy 的 Pi 存储键和进程模型不能直接套用。下一步按各服务商可验证的上下文/价格字段建立映射，再验证会话持久化；Pi 专用回收只在有对应 MyCode 进程所有权时适配。 |
| 手机伙伴/任务合并、责任人、项目别名、语音长按和附件回复 | Cindy 方案依赖其伙伴与部分云协议；MyCode 手机伴侣使用独立配对。下一步先复核本机配对协议中的责任人与附件字段，再做离线 UI 适配，不导入 Cindy 云服务。 |
| 群回复附件/图片、跨渠道历史、表格与归档 | 新 `GROUP-TASK` 必须保留每群独立目录、记忆、默认关闭的自动闲聊和 Token 上限。下一步先在独立群任务格式中定义附件授权、历史引用和退出行为；旧 `GROUP-CHAT` 写入入口仍禁止恢复。 |
| 审核命令参数、路径及风险；回复文件符号链接校验 | MyCode 与 Cindy 的授权接口不同。下一步以本机授权弹窗的工作目录、目标路径和真实路径解析为测试入口，确认不会放宽现有权限后再补 UI。 |
| 本地免登录 `--mock` 视觉数据 | 仅适用于隔离的开发配置。下一步先为模拟目录和真实用户目录设置互斥检查，避免演示数据污染配对、凭据和会话。 |
| Synara `/goal` 可见消息、条件 Stop 和持久进度 | MyCode 会话/任务模型与 Synara Hub 不同。下一步先在 MyCode 会话中重现目标启动和 Stop 恢复场景，再分别适配，不把命令同名视作功能等价；Synara Bun 更新不适用于当前 Rust/Node 构建。 |

### Cindy 10 项完整提交清单

- `b49fb85f2ecb75f476648791185f2cc9aea40050` fix(mobile): keep list performance sweep in history mode
- `4105eaeebafcd52dd919d9cd3164b788c831c309` fix(mobile): 延长项目拖动的长按激活时间
- `93fca8f7575a8904b4b5e235c28414439951c71d` fix(mobile): cancel stale list performance sweeps
- `1192f2ae9d42006d9fb9b1a83b6b3acb23dfc48e` perf(clients): reuse inline parse work and bound word cache payload
- `3e2c4701558bbb930e845b5da34a68501b19ffaf` fix(desktop): Agent 进程优先级治理覆盖 pi 会话
- `bfde64aafb090f5766effc7e438cc040a3ec78c0` test(desktop): 断言 Windows CIM 查询脚本由名单常量拼出
- `c01d7491fd93675a46d751e32232b928c5376711` Merge pull request #7087 from makecindy/dash/mobile-project-drag-delay
- `b357665645823fce43a49ee833ef2864da0aa0ca` Merge pull request #7086 from elfcv/fix/mobile-listperf-scroll-ownership
- `e7616b58f19e1c3432bcee303e7c1cacbcb584cb` Merge pull request #7089 from zyjisdog/pi-process-priority
- `4ad25a97fb92e90f72c80c91f409a39b4a46fa76` Merge pull request #7088 from elfcv/perf/client-render-followup

## 验证与发行

- 手机 Vitest 28 文件、135 项通过；手机与桌面 TypeScript 检查、手机中英文词条检查通过。手机 lint 0 错误，保留 `dictation.ts` 中两条既有警告。完整 [MyCode-Pro CI](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40160227478) 的 10 个任务全部成功，包含 Windows/macOS/Ubuntu、浏览器、手机检查、AppImage、两种 RPM 构建和干净安装。
- Windows NSIS 构建成功：`MyCode_0.23.9_x64-setup.exe` 为 41,419,881 字节，产品名 MyCode，产品/文件版本均为 0.23.9，SHA-256 为 `0a6e8c9835496c1deca75fe7226f9452f67063aed1c1d62935236f26d02a572c`。本机没有覆盖安装；构建和文件版本校验不代替已安装升级验收。
- 六个平台的 0.23.9 MyCode Host 包已重新生成并发布到独立 `mycode-host-v0.23.9` 分支，远端提交 `a746d59fc246b605246dacd51745572fc2c45364`。本地各包先按 SHA-256 校验；远端 14 个文件（六包、六校验文件、清单和 README）的 Git blob 哈希逐一匹配本地。桌面发布页不包含 Host 包。
- [Android 发行构建与模拟器运行 40160237573](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40160237573) 成功：APK 包名 `com.dcxa521gi.mycodemobile`、versionCode `239`、versionName `0.23.9`；apksigner 确认 v2 签名，证书 SHA-256 `6787e8f3283482fd6e860c38eeba47adb7e1606d272ce5730327865db1f1c69b`，与 0.23.8 一致。下载的 `MyCode_0.23.9_Android.apk` 为 103,464,295 字节，SHA-256 `8572b03ef052224c02c835fec5b13528a7aec7dfa551c856fcb55a591a4bb9d4`，与 CI 附带校验文件一致。
- CI 将此 APK 安装到 API 35 x86_64 模拟器并启动 `com.dcxa521gi.mycodemobile/.MainActivity`；进程保持运行，配对页截图和 UI 树可见，crash log 为 0 字节。模拟器结果不代替 Android 真机配对、覆盖安装或 iOS 真机验收；iOS 源码供用户自行签名，不发布 IPA。
- 公开发行附件的重新下载、尺寸和 SHA-256 验证待完成；完成之前不把 0.23.9 视作已公开交付。
