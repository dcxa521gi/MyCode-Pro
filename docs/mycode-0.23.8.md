# MyCode 0.23.8 更新记录（2026-10-21）

## 上游基线与完整处置

| 来源 | 旧基线 → 本轮 HEAD | 核对结果 |
| --- | --- | --- |
| MonoCode | `115f0e97c4f869188b5868cc4e9969d6f1a3f972` → `74b8139c41e7235e7535bdc8ba60e63705351d3c` | 2 提交，均已融合。`601b7e1383` 增量手机转录和 iOS 事件唤醒；`74b8139c41` 修复手机协议测试依赖隔离。 |
| Cindy | `5756110157501b2d46bdbd5838bd3a1532af1ed1` → `f77377724fa034399e20bc1fc15e257483bf1e5e` | 127 提交，完整 SHA/标题见附录。按本地适用性分类，不把候选写作已移植。 |
| Synara | `299fd573b1d6520c323a87c78d30be74e87e53e1` → 同一提交 | 无新增提交。 |

从 0.23.7 发行基线 `4acbce110f` 算起，Cindy 共新增 169 提交：此前 42 项已在 [当日首轮审计](upstream-audits/2026-10-21.md)逐项记录，本轮新增 127 项在本文附录。两段合起来覆盖完整区间，尚未移植的候选不计为 MyCode 功能。

### MonoCode 两项融合

- 桌面监听保留旧手机的完整变更回合协议；新手机显式启用增量协议，长文本只传后缀，嵌套字段用补丁更新。校验 UTF-16 偏移、目标路径和回合 ID；不一致时要求重新读取完整快照，防止会话错位。现有项目、会话、配对、凭据与聊天历史不迁移。
- Android/React Native 手机工作区启用增量监听，稳定回合引用可复用；Rust 手机转录内核解析字段编辑，iOS 原生布局工作线程改为事件唤醒，支持命令、前后台和网络帧到达。iOS 源码保留供自行签名；没有发布 IPA，也没有宣称 iOS 真机验收。
- 协议往返测试纳入手机 Vitest 配置，并同步 CI 测试依赖隔离修复。没有新增用户可见词条；现有中文和英文手机界面继续使用原有文案。

### Cindy 本地能力核对

| 候选范围 | 本轮结论 |
| --- | --- |
| 持续语音对话、语音供应商与朗读、提问卡语音输入 | Cindy 已形成成熟的桌面/手机交互，但使用 Cindy 伙伴、账户、语音服务适配器和任务协议。MyCode 已有本机语音入口；后续需独立适配 MyCode 模型路由、权限、双语和本机密钥边界。本轮未移植。 |
| iOS 分享到任务与伙伴、远程链路流量治理、Worker 独立 worktree、模型组限额续跑 | 属可本地运行的候选；需按 MyCode 手机协议、独立群任务目录与记忆、电脑权威状态和旧会话保留逐项实现验证。本轮未移植。 |
| 插件目标选择/授权/附件投递、伙伴 Thread 独立会话、自动跟随用户会话 | Cindy 插件与伙伴运行时专有。成熟群聊可作为新能力重新融合，但不能恢复用户已移除的旧群聊实现或合并独立群任务数据；自动闲聊默认关闭并受 Token 限制。本轮未开放。 |
| Cindy 云账号/云服务、供应商分享、伙伴市场 | 不接入；仅允许 Cindy 开源且本地可运行能力。 |
| MCP 窗口、文件浏览器、对话分组菜单、诊断日志等修复 | 按 MyCode 对应模块另行复现；不能因提交标题相似就宣称已同步。 |

用户移除决定保持有效：Freebuff、旧 CLI 重复通知、旧群聊实现均未恢复。未来若上游三端出现可验证的成熟替代功能，可按新能力融合，同时保留现有数据和默认行为。

## 验证与交付

- 桌面会话监听 4 项、手机协议往返 2 项、手机端完整 Vitest 28 文件/135 项、Rust 增量转录 2 项与网络监听唤醒 1 项通过。Rust 手机传输全套 22 项中 21 项通过；`direct_quic_round_trip_with_pinned_mutual_tls_over_ipv4_and_ipv6` 在本机连接 `::1` 失败，单独串行重跑仍失败。不能把全套 Rust 测试记为通过，IPv4 和本轮新增的监听测试已通过。
- 桌面 TypeScript、Rust `cargo check -p monocode --lib`、Rust 格式检查、手机 TypeScript 与中英文词条检查通过。手机 TypeScript 配置补入 DOM 可迭代类型，并修正测试工具 URL 类型，避免版本升级后类型检查失效。
- Windows NSIS 安装包已构建，`MyCode_0.23.8_x64-setup.exe` 为 41,412,877 字节，SHA-256 `c7679f42984a367164d5172cc5b061a665bdf62c29d12299721fce9a410c2645`；应用文件产品名为 MyCode，文件/产品版本均为 0.23.8。发行附件重新下载的安装包与校验文件和本地逐字节哈希一致；安装包未在当前主机覆盖安装。
- 六个平台的 0.23.8 MyCode Host 包已重新构建并按本地 SHA-256 校验后发布至独立 `mycode-host-v0.23.8` 下载分支；本地与远端分支提交均为 `c8605c60ca33633a59820cc1f569d57a2caad775`，桌面发行页不包含 Host 包。
- [Android CI 运行 39579064551](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/39579064551) 成功生成发行签名 APK：包名 `com.dcxa521gi.mycodemobile`、versionCode `238`、versionName `0.23.8`，v2 签名验证通过；证书 SHA-256 为 `6787e8f3283482fd6e860c38eeba47adb7e1606d272ce5730327865db1f1c69b`，与 0.23.7 一致。APK 含 ARM64 和 x86_64 原生传输库，为 103,464,107 字节，SHA-256 `e8dec6df74376a4da3f574a2680560f415634ff0cc3bc93645c0eec7578e1b79`，与 CI 校验文件一致。
- CI 将同一正式 APK 安装到 API 35 x86_64 模拟器并冷启动，25 秒后进程仍存活，UI 树出现连接电脑入口，截图展示配对页，crash log 为空。发行附件重新下载的 APK、Windows 安装包及两份校验文件均与本地哈希一致；发行附件白名单检查通过，仅有这四个 MyCode 文件。Android 实机配对/覆盖安装、iOS 真机行为属于独立验收，不由模拟器代替。

## Cindy 127 提交原始清单

以下是 GitHub compare API 中从旧基线到新 HEAD 的提交 SHA 与首行标题，用于下轮逐项追踪；合并提交保留，不重复算作独立产品能力。

- `9101ebff3fd1e05cfb8b397124b0e9c0f60e0e8b` feat(desktop): add continuous companion voice mode
- `f1268a2a7da6a1821de88efac270e035cf4ffe2f` Merge upstream/main into companion voice mode
- `01a984a611499217d994f93f148c3cedf4630074` feat(desktop): support BYOK companion speech and per-companion voices
- `45f16547a6bbea002049ca7e41b2cbd15abfd741` Merge commit '468a07111844a40665b249c296cc77e50e212eab' into codex/companion-voice-mode
- `da4c5b2192d5d13d521329ebb03948567dd29c8c` docs(desktop): document speech adapter and registry follow-ups
- `06ecd09981711067aca2dc1072845e8eaf0e2eaf` feat(desktop): add provider voice selection and TTS preview
- `80aeea0fdc5713f8f14f3a152fd57548507debb4` Merge upstream/main into companion voice mode
- `2eef1517dbd85e93c9a005f1e798e5916c240595` fix(voice): lock speech protocols for official endpoints
- `458d3bd13b0b717312f3e6c275e609b28c1365c7` feat(voice): move companion voice settings into settings drawer
- `3ce983eedf2c6596217dcabfe7a67aa41d8100a2` fix(desktop): simplify companion voice labels and reveal IDs on demand
- `db4b08e30e359ac7ef334063582c30e4652da9d9` fix(desktop): remove voice ID details and copy control
- `1835621055b224af3f1999d27cbd2ef8dab693cd` fix(desktop): retain companion voice labels while refreshing
- `1a37a2af87af17d4f8494a77ab0bc9ba5cea8f64` fix(desktop): hide automatically selected speech protocols
- `12d68e24a39f11712d35ad8ce0695c3ba4738fc2` fix(desktop): preserve voice replies across false speech onsets
- `5698cd2c7a21a3651ee7e6723d062c7a672f443d` fix(desktop): shorten voice auto-send pause to 1.5 seconds
- `eed074cea596d995b88cfce93f965ce84b16d87a` test(desktop): align companion voice entry contract
- `5a7fb9dd1ae23a1cfbd34f6c85b258039738f766` Merge upstream/main into codex/companion-voice-mode
- `f43e7c56ecc9a5fe09e0926f66c71fb0a2853543` test(desktop): await voice catalog before checking manual input
- `1724fca608eb326899ea028ae43527ceb064f599` feat(desktop): add sentence playback and reply read-aloud
- `a96e902feb5d6a971719e2904f1700b626c66bfb` Merge upstream/main into codex/companion-voice-mode
- `400fc878eb4702eef1b544d01d1d7406e4fd1ffd` fix(desktop): simplify empty companion voice settings
- `fcad4c7915e057768b886ab807475a1b8824a23a` Merge upstream/main into codex/companion-voice-mode
- `ade8374a3615e660bbc99111b2954d5f2f5cf882` Merge upstream/main after companion UX updates
- `098f3af0f90e41bf5087f0f1be2d57e0d30facb4` test(desktop): wait for remote host startup before calls
- `ee6481da661cede93c984a5e47e6f59ec248c850` merge: sync main into companion voice mode
- `48f239dd26594491a6d64c7dbd7416b0783dbddd` test(desktop): make download timeout resume coverage deterministic
- `bd8f7bafcbfe6ec43029a26bca9239783d94b980` feat(desktop): refine companion voice timing and call lifecycle
- `5d05509e4b13193573befb54ba406c6e76bacd98` feat(plugin): 开放目标选择、投递方式与图片消息接口
- `fa8ecb9adce2a3d03f6f85e1b3ebadd12faa4107` refactor(plugin): 解耦目标查询解析与投递并移除宿主选择器
- `b3e4b35d33bda6036683d5d16172b0dd54615299` feat(desktop): animate companion voice toolbar and sync main
- `ec97ea68643be29babbba82a6bb0dafe64a1dfc1` fix(plugin): 补齐目标授权与持久投递边界
- `ae9d33a556ac5d5bfed70a67cd53c217b20f3d80` chore(plugin): 同步主干并迁移目标接口手册
- `4b13cd91c43fee8013f3324da6e1fb21396eaed1` feat: 提问卡的自由回答支持语音输入
- `91c003ba0f15cc960420e03487c06c0bae9f8ce2` fix: 按 review 收紧提问卡语音的生命周期与并发
- `479f2e91c4ab06443011e1d3a3c400d427b468d4` fix: 补上复审指出的三处语音竞态
- `ca3c64328d03de61add87b5bc87af38f430586a3` fix: 恢复无阶段触发与长按松手的停止行为
- `5efc687bb57b13418d007f64add18850925c4766` fix(voice): preserve submitted input and reconcile ASR snapshots
- `4a01b43439bb0c53ba56c3716d3e8ee24ca4a178` Merge upstream/main into codex/companion-voice-mode
- `9c4a70deac243c71d9a4dd31016fd5da941b3756` fix(voice): preserve drafts and release failed reply waits
- `91441fab7887e45864865fa0d352deebd10a3634` fix(client): 保留请求失败的原始异常日志
- `8d5086317155cb6369dc3237790663a42cfd3326` fix(client): 不新增服务端错误正文日志
- `57b62cfa3056ed7a69ba588329182c05ce4c09a2` fix: 修复提问卡语音测试计时并同步设计台账
- `e689fef6ded698fe13b1d3f5bacbec060b8b9400` merge: 同步 main 并重新生成提问卡设计台账
- `a4ca1aedc0cb1f13e218a9add8bac45bc84d7717` fix(client): 避免解析异常日志夹带响应正文
- `9a200f89b22537db77b9a679bdd0be5c39e0e0cf` fix(client): 隐藏请求异常中的资源 URL 路径
- `c6ba2ad7d3f3682390ad422a8110c0b78eecc496` feat(mobile): route iOS shared content to tasks and companions
- `53d18e950b68021fc3a6266facec30803f8298ba` fix(mobile): register incoming share design surface
- `f72a3fba4088ddf187195ff6f96d527f76d6d00c` Merge remote-tracking branch 'upstream/main' into ios-share-destinations
- `d8f8191ad62d41c7aad60b3262d46eaa6880cc41` Merge remote-tracking branch 'upstream/main' into ios-share-destinations
- `c086ed6a526b25cfb3e674f821ca28621ca1a7d9` fix(mobile): preserve shared drafts and avoid competing share navigation
- `2ab611bfb907afcd6d1d5c55c560a86fcb7f8e0a` Merge remote-tracking branch 'upstream/main' into ios-share-destinations
- `656588d6768181489405b4678c4859c7aa52efd1` test(mobile): keep share regression assertions behavioral
- `410981ed5ed3b042a534e7efbead871984d262a5` Merge remote-tracking branch 'upstream/main' into ios-share-destinations
- `9403cf601967a0bdd0edf43c2e30f3c8e62d42ea` fix(mobile): reuse guarded back navigation for incoming shares
- `b48dbb9e4b44b8a77d1b066dd3c37d75d0a0b255` fix(mobile): dismiss share chooser and reuse destination drafts
- `b61a0344c6509c6c0d0be5e42d326283680f92ab` Merge remote-tracking branch 'upstream/main' into ios-share-destinations
- `744859be0c8c1668cd6fe265dae625d4e96f0b6f` fix(mobile): allow share retry after exit and virtualize destinations
- `77d9565b4b6ea3c52cae9d0431c6cd01e03bbb82` fix(mobile): scope incoming share draft protection to new tasks
- `8360a86654f3e04a8fd90c3c177bc439a4d3af66` fix(mobile): preserve shared attachment order and verified destinations
- `0fa963c7d200511b1b64ec814a0cd10dbfd9de44` Merge upstream/main into ios-share-destinations
- `febddedc5e765bac6567bac4d60a741c6029a859` test(mobile): inject share ordering into goal send harness
- `fab999e5284badd7dd82c45f3da912de3b499db5` Merge upstream/main into ios-share-destinations
- `fcb5e1ccd38af5102ce2e88970538636446339d4` fix(mobile): preserve concrete text file share exports
- `aab48b5454a83af00f0f6a050fa19b2a23789b58` fix(mobile): fence shared content and preserve original exports
- `4b5f9d8679f47c1dbe6e87733d03866fa6c3d44a` fix(mobile): retain shared URLs and track native share resources
- `fc76b0ba1fb6080ebf62db2897bdda291f2d8bb8` Merge upstream main into ios-share-destinations
- `85407a84c14059a4d18e22b4b906c2d7970b1ee3` fix(mobile): retry share rejection cleanup and preserve property lists
- `993df6e57672ed7c4438eafaa50ba21eeed974b7` fix(mobile): persist unreadable share fences and retain image exports
- `fe17e1968ac60bf46820761f6db6cc9c3d25cafe` Merge upstream/main into ios-share-destinations
- `22496429a058b250ded159782ff45840de2f6c40` fix(desktop): keep disposed MCP App frames from quitting the app
- `7c84880686398252042f9c069494e4ea52ead1ec` fix(provider-group): 统一组限额提示与自动继续体验
- `200c6e3ec1d30f45b6b96559a366d443dafd6231` fix(provider-group): 计入冷却时间并保留自动恢复记录
- `bf014352a554457598b0228f5b25f3662dcbc0a0` fix(provider-group): 防止崩溃恢复误报自动继续
- `07fb2b7f1e484598a3d3d1b0dac69cd0c399fc3c` fix(provider-group): 手动接手时重置限额续跑次数
- `2d16649e824392b64edec659aae1cabf73168a2d` fix(provider-group): 创建会话时保留限额等待信息
- `a0ccbd7f7c51ed7f9c8b6246958c1805dde43e6e` perf(device-link): 远程发送少走往返、记录发送耗时，打字时预热 Agent (#6610)
- `cc4df559c4a889f74eeabf36bb5bbbc42bdc6c43` merge: 同步 main 并解决设计台账冲突
- `69f2b4e7c77c779595a9f8dfdb82749142b2c6db` Merge upstream/main and retain incoming-share composer wiring
- `12328230f50b673e3c2bea3ec6957dfcc6920543` feat(orca): Agent 工具支持 Worker 独立 worktree 与实际目录回传
- `1ad76cd8457a3e5b25a3741ee7056fa51a02c956` test(orca): 验证 Pi 动态 Worker 工具透传
- `ee251c7ac39a52885e84d14468760573ac1154bf` feat(desktop): teammate DMs use the group-chat bubble and hover toolbar
- `e57257d3b873e726174293f8eb5635cc452bf472` docs(desktop): point the DM bubble width comment at bot-group-chat.md §5
- `3e1ffa0c0dfbb1e80ce3a909daa85bb1bb0655cc` fix(mobile): classify shared file URLs from original content
- `ec6b94e323d4ccf654d650fc828073725e0e4a95` docs(design): regenerate design inventory for the DM bubble radius
- `9f15f5bc9f713c0c3ba9279861efe6f1d9f56417` fix(desktop): skip unavailable optional chat subscriptions
- `ee95d622af1ad6740593f592968ecf2c481ae1e6` fix(desktop): keep attachment-only teammate DM bubbles in share images
- `72d5c7f098da71df6ad8ccb8129c25895ca11909` Merge pull request #6617 from kingwindang/fix/mcp-app-disposed-frame-crash
- `f5b407ed07d0bab917d496a169da9a5cc4cafe50` Merge pull request #6611 from makecindy/dash/provider-group-usage-limit
- `301291e695af49f215883db605b282f2b7d77b04` fix(orca): 校验新 worktree 最终目录与显式源引用
- `5b518de93a6ffa203577beacb170a234f91b5854` test(desktop): match the attachment condition in the share-source guard
- `c7bc1943312656823b5b26bbc5ba3ecee63576f2` Merge remote-tracking branch 'upstream/main' into teammate-dm-bubbles
- `64155643b5146cbd91e06f0c8d081c945d964370` fix(mobile): decode shared file URL data and raw image types
- `1ff2187bb7051802e15406cdb9162ba06b5545e5` test(desktop): align teammate projection tests with the finished-turn rule
- `1bc9ee9f33d23d0a03b856192d2e4a729b12ea7a` chore(plugin): 同步主干并解决目标接口冲突
- `4c2ed9667ab3c5aa35b5ab353be007b360ad06b6` fix(desktop): 保留设置页往返后的设备分组折叠状态
- `5fdcc4bd2ed622d1fcc345059e30b9168e0718bc` fix(plugin): 保留目标目录与运行配置校验
- `0b7075ae46c2a58d07359a5538bd7390f9b4587f` fix(plugin): 限制在途附件的解码内存
- `c7ff6f1037a4c2a8a67b05cde4c8338d517f82e1` Merge pull request #6624 from zqchris/teammate-dm-bubbles
- `3bc4ebc6bd2343e91719d4198d0939ae033e4529` Merge pull request #6623 from makecindy/feat/orca-create-worker-tool-parity
- `cc5e1a44bf28f9e1f8c40a84db46e2756f680f6e` Merge pull request #6582 from zqchris/ios-share-destinations
- `b32c7bd7cc72f47483c0b45fe0ad9ca3ef7ea794` Merge pull request #6627 from guyong-zapo/cindy/earnest-mendel
- `01d51d7532ee78829b21bbcd2bca7b489ac405f2` perf(device-link): 远程链路流量治理——交互优先名额、历史修复读去重、Subagent 变更推送与 PR 状态 SWR (#6613)
- `ad1703b39a265cac76086fcc662b612fc21dbdca` fix(plugin): 保留附件投递的公开错误码
- `9646d7c05faf92e87be4179fa234f408222abcb0` feat(bot-group): give each Thread its own teammate session
- `d22ccf48ea6c97d04e26d69fd781987e1eb67d01` fix(bots): require opt-in before following user sessions
- `6c2c11d55b6584d9ff276954de92b375711ce2ac` fix(bots): sync follow-up design inventory and clarify disable copy
- `3ccea2978dfcbd8f82cfc4ec453b8c82f1085edb` fix(bots): retain queued completions and remote chat opt-in
- `f4efbfdf483d55dc8feb65ba3bd2020f17a29ef6` Merge pull request #6456 from makecindy/feature/plugin-ping-targets
- `3482d51f4ead99f5463e7a82197276e50caa054f` Merge pull request #6567 from makecindy/feature/client-request-diagnostics
- `8aec46811e866307678d508d8f75f304ee0dfbc2` fix: 修复提问卡语音多语言与按钮圆角并同步主干
- `18c9d897bd5e845289f94da592be7d7a1633a8fe` fix(desktop): 为“对话”分组提供专属菜单 #6575
- `339770ea16ed96209c89c1e98cb3d0d9e7b5acd9` feat(voice): isolate calls and return delegated task results
- `7258c1f2a760de6ac6c2f3cde7dc5031d4db72e8` docs(design): refresh inventory for voice call components
- `dc7905733875cb0d17a8686088f8de039fbb6262` test(desktop): verify group archive worktree warnings
- `681210f90bf7c24fedee6885dfd828eee74711d8` fix(desktop): preserve complete dialogue actions and menu focus
- `4b7de0a1c59d661d018b9bdc7777853ab81d8823` fix(desktop): keep dialogue group actions independent of content filters
- `7687c0c1b9ceb6619d460484baaaa968d638f894` Merge pull request #6631 from makecindy/cindy/tranquil-lamarr
- `15177d33a00704de94fc3cc0ec7a9f2a2fd8b43d` Merge pull request #6636 from zqchris/bot-follow-up-opt-in
- `0681858a8b9fcdde5d1085bcf86694d78f484b00` Merge pull request #6635 from zqchris/group-thread-sessions
- `4522ba84bb0d3870b8b645a5f385e44a4311ae50` Merge main into codex/companion-voice-mode
- `66a30b68d0a5667651ec1142f6fe7b54188eff32` Merge pull request #5718 from horizon554/codex/companion-voice-mode
- `b9d646c343bf7060164fad7d3e415c26bc061ed6` fix: 等待伙伴导入完成后再断言并同步 main
- `e98fa44de2b4fe64c5ab25de202d8f8997acf3dc` Merge pull request #6641 from makecindy/cindy/humble-noether
- `1e359b1d1ad32ec76b67f71c75462e49803eb3dd` merge: 保留提问卡听写并兼容主干语音对话模式
- `48146185166f37b72dbd253e422793346c6353b6` fix(desktop): 修复独立窗口文件浏览器加载失败
- `f25a95f3b289d74b6aa4f18c78f8e2693b1ba4c6` Merge pull request #6306 from zcinta0514/ask-question-voice
- `f77377724fa034399e20bc1fc15e257483bf1e5e` Merge pull request #6657 from makecindy/cindy/proud-einstein
