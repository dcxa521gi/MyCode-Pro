# MyCode 0.23.10 更新记录（2026-10-26）

## 上游基线和范围

本次以 MyCode 0.23.9 为产品基线，并读取功能来源 Markdown/JSON 台账的当前处置。MonoCode 正式产品主线 `26465c620977f3951d0a532a0f7db32c3c179007` 至相同提交，新增 0 项，最新正式 Release 仍为 v0.16.0，因此无主线产品功能待融合。上游另于 10 月 25 日发布 `native-v0.16.0-preview.7` 实验性 Rust/GPUI 客户端，明确生产应用仍为 React/Tauri；预览版会写入 MonoCode 自己的数据库，Windows 与 Linux 下载包尚未通过运行测试，且媒体和 HTML 能力有限。MyCode 的现有用户数据、模型路由与 Windows 支持不应被该独立预览客户端替换。下一步按其 `docs/native/parity.md` 建立功能差异清单，在隔离数据副本上测试 Windows，再逐项适配达到成熟状态的交互，不在本版宣传 GPUI 已融合。

| 来源 | 上次基线 → 本轮 main HEAD | 提交数 | 本轮实际处理 |
| --- | --- | ---: | --- |
| MonoCode | `26465c620977f3951d0a532a0f7db32c3c179007` → 同一提交 | 0 | 正式 v0.16.0 产品代码无增量。独立 Native 预览如上，未计入已融合。 |
| Cindy | `4ad25a97fb92e90f72c80c91f409a39b4a46fa76` → `7c5bd270c956417127e12a74934d0ecdb97ba55d` | 152 | 参考 `656036b80d` 的用量语义，按 MyCode 历史逐轮用量结构适配任务汇总。其余提交按下文和完整清单核对。 |
| Synara | `3f55b77ef186764050ecf4edd6ae0879eec948a8` → `257b4de84410571a16ef5bd562debf4c1aa3c9fb` | 22 | v1.0.9 Stable 及后续 Stop 修复逐项核对；未声称移植其 Hub/Code OSS/Effect 架构。 |

## 产品改动与验证边界

- 桌面“设置 → 用量历史 → 按任务”现在列出**所选时段实际记录过的模型**，多个模型按名称去重排序。用量总计仍使用各轮真实上报值；不会把当前任务模型标为所有历史用量的模型。该 UI 参考 Cindy `656036b80d` 对当前模型与累计用量的区分，由 MyCode 独立实现，没有复制其用量数据库或代码。
- 英文原文为 “Models used in selected period”，简体中文为“所选时段使用过的模型”。无模型记录时不显示这一行。未改变旧会话、凭据、模型路由、群任务目录/记忆或 Android 配对数据。
- 回归测试模拟同一任务在所选时段使用两个模型、按代理筛选后不混入其他代理。桌面 TypeScript、测试和构建，以及同版 Android 伴侣、Windows 安装包的发行结果在完成校验后补记；未验证前不得称作已发布。

## 其他候选的处置与下一步

| 候选 | 差异与下一步 |
| --- | --- |
| Cindy 手机群图片预览、重试、后台取消、跨渠道附件 | 使用 Cindy 伙伴云/群消息媒体授权协议，MyCode 手机伴侣当前无同构的群附件服务器对象。下一步先在 MyCode 独立群任务中设计附件 ID、授权与预览生命周期，并在无云服务的本机配对路径验证，再实现；旧群聊入口不恢复。 |
| Cindy 聊天失败续跑、伙伴权限、跨设备任务链接与云接管 | 多数基于其伙伴/云账户及 Pi 任务所有权。下一步先以 MyCode 本机 CLI/Host 所有权和现有继续/停止操作写出状态表，挑一个可复现的本机故障修复；不接入 Cindy 云。 |
| Cindy 桌面任务级上下文档位、报价和本机进程优先级 | MyCode 模型路由可跨 CLI/服务商，不能将 Pi 专有档位或价格直接写入用户配置。下一步基于可验证的服务商元数据建立只读档位说明，并在 Windows 上确认子进程所有权后再考虑优先级。 |
| Synara v1.0.9 原生 Code OSS 编辑器及 MCP Connectors | MyCode 已有 CodeMirror 编辑器和本机 MCP 管理，但没有 Synara 的 Code OSS 调试/远程 Connectors 契约。下一步先列出编辑缓冲、保存冲突、调试及连接审批的差异矩阵，选择可独立适配的本地能力；不能把现有编辑器冒充完整等价。 |
| Synara 压缩 SQLite 迁移备份、可见 `/goal` 与多轮 Stop 所有权修复 | MyCode Rust 数据迁移和 CLI/Host 任务边界不同。下一步定位 MyCode 实际迁移备份入口与磁盘空间检查，先增加旧备份读取兼容测试；Stop 需重现迟到完成事件与替换会话的所有权场景后才改运行时。 |
| Synara 项目图标、OpenCode 冷启动发现、macOS 最低版及 Bun 安全更新 | 项目图标必须限定本机可信路径和现有自定义图标优先级；OpenCode 发现需按 MyCode 模型路由核对。macOS/Bun 构建规则不适用于 MyCode 当前 Windows/Rust/Node 链路。 |

当前明确移除的 Freebuff 检测/安装、重复 CLI 更新通知、旧群聊运行入口和顶部开发/办公切换不恢复。独立群任务继续保持每群独立目录/记忆、自动闲聊默认关闭和可配置 Token 上限。旧用户数据原位保留。以下逐提交清单记录上游事实，未单独注明适配的提交均**未集成**。

## Cindy 完整增量提交清单

- `48e6f7841ef4cad88552fe1322900c7d0b014db9` fix(scripts): 读进程表不再撞 1 MiB 上限，失败不再伪装成空表
- `f1de6f14dd0db97f90a275014a1429bf4b793298` fix(bots): 使用最新群版本重复保存设置
- `4a05b87b5e2d7f44c949f457e08a105e50018b75` fix(bots): 保持群设置字段与版本快照一致
- `16d0e8d631e54b8102537112f87770c4dc900318` fix(auth): 冷启动超时兜底不再作废自己已成功的登录刷新
- `e18f9ba7940877596473c699c61f3082c75466af` fix(auth): 兜底代际改为绑定到具体那次推进,并修正登录后同步用的代际
- `c3a61133992c5d74a061a9ba3703efd90ac0508c` fix(auth): preserve consecutive cold-start timeout fallbacks
- `6078b6671a8395f40a72bdb009c35ba0f2c00554` fix(auth): 接受注册器确认的冷启动刷新代际
- `07c6b84a679ab853dc8bbf2d8b839b9dbcd26ed7` fix(auth): 启动超时不等待无界 owner transition
- `6f09d8ae7a78a520074b0bcc579171943858423b` test(auth): 用行为断言替代冷启动兜底链的源码字面量扫描
- `a9eeecfea310d0d6c987ddb2250387cfd5fe2d0f` fix(auth): preserve login from sibling startup timeout
- `515c352bc01f7713f65e9fc436d9f718e7f87d1f` fix(auth): preserve login across startup timeout recovery
- `dd59631c8b26400ebc913f72462f5d65256f9e27` fix(auth): retain consecutive sibling timeout fallbacks
- `31f0ee8a4416bc79580a68f75a072419556db2f5` fix(auth): preserve login during timeout recovery
- `a84beda248cd06afdf0221eb8b8a7a24707500e8` fix(auth): do not recover signed-out over a login that settled during sibling startup
- `a9d9fd2ae5cd60890ccabe4c70552b505278f7cc` fix(desktop): route local rich audio through the audio protocol
- `e5909a67b83db9175e1ee1610ac8e58e246825cb` docs: add CDP screenshot privacy guide and browser snippet
- `e74e8f7f8703a1bc10f4dc43e5a0d5acb6514e63` fix(dev): blur cached and remote media in screenshot snippet
- `0135e1ef92836a1a203356b114f683473546b24c` docs: clarify manual checks for local screenshot attachments
- `f906bee0e25501205600d1db11b0ffcc3143a966` docs: state the manual check boundary for remaining screenshot content
- `ef4537e2f332e7a89ee7897fe4f6640b4c8c24a8` docs: require reinjection after full page reloads
- `e17e841054f4ce3ccead439830a6452f176a1cf4` docs: keep only public screenshot privacy principles
- `05c6018cb2b8660a74044c59db829abee4049fb1` Merge remote-tracking branch 'origin/main' into docs/cdp-screenshot-guide
- `1c4c60f36349898577390da3b23f9d8764ad6eaa` fix(chat): stabilize message arrival and delivery layout
- `9d047441ee090e158fcd2753082c54e7b72443b4` test(auth): fix the rebase fallout in the auth test harnesses
- `b060383198ebc37a7f97e33136e66ce3a486c347` fix(bots): retry failed group sidebar refreshes
- `771f9968e05968c6780b1401d824c90a27f30379` feat(desktop): 任务级上下文窗口档位 UI：ContextWindowBudgetChip 与挂载
- `8b0f6c56c7e36eb39422c17a81ac8e2dbf2c28a7` fix(desktop): Greptile #7011 三条 P2（#7011）
- `721497aa80623c7a94a86aef2a17a73a247750c6` fix(desktop): 旧设备的迟到错误不再锁住新任务 + 远程不显示本机价格（#7011）
- `6fdf9a73b7bb97986891e88c8b7ca06996198d85` fix(desktop): 档位行高亮圆角改用 8px inner 档（#7011）
- `26e273e6880cec75345dfe4bed11511fdac359ee` fix(media): retain and play chat videos inline
- `c616b1799e9acfd9a8b4a050a92a637cd9eb625a` Merge remote-tracking branch 'upstream/main' into cindy/gentle-curie
- `416570c36a30e3ef637950ffbf720221c4d86009` fix(desktop): include domino in packaged runtime dependencies
- `9edce9edce95d08b3ab21d070d61595ba6bc0dce` fix(mobile): 恢复伙伴聊天直接选字并精简消息菜单
- `b84e71e6e19600e7196071557a4ef47989372f2f` fix(remote-agent): preserve executable argv path
- `b1702aacd3a9302815946a2adc657a5791139426` fix(mobile): 保留伙伴长消息展开后的部分选字
- `d8a37c53766addfd21d2091abd115785119cbd11` fix(mobile): 保留未分块长内容的稳定文本回退
- `354f314d46514fd3f06720a9c7e831a4cf401b00` fix(scheduler): reject deletion of a missing schedule
- `fe383485cedd152ccbe23db52745269ae6b565fe` fix(mobile): 代码着色直接复用原生文本组件判据
- `e4ef28941b5bc2448b1b444681d0a0507d829838` fix(companion): let a cloud take-over replace a copy whose first meeting never finished
- `04a31a8ca0e0dda5ad9b009e459f3fbfd7bff795` docs(companion): document take-over stalling on an empty default model chain
- `26f44fe94ee48de1935d633b64911aa3b81282b2` fix(desktop): 群聊刷新失败后自动补读
- `14f71cb6980c3804ba61073ec04e31bd16b415bf` fix(browser): 修复后台新开网页的尺寸和截图
- `e344af865a2f227202601462ddf68c513d576528` fix: 重试和继续任务时保留排序时间
- `111a70ee84db0139989c687c01941a901f096858` test(desktop): 从首读开始验证不自动重试
- `e41aa7677ee878ffb2002f243172fba6a71f477f` fix(mobile): release passive gestures for inline video controls
- `c96dd346cb25690ce6ce90f7d95e2eebd8604509` Merge pull request #7094 from makecindy/dash/companion-direct-text-selection
- `c33d0e0da22f7d1c8e4a12f463498aa3e790d932` fix(sessions): open companion tasks in standard session UI on all clients
- `6dcb8911c28401de6ea62976da0b2822804a8aaa` test(browser): 校验后台截图包含测试页内容
- `143f8420b6daf7b497ec3e650f9146127683d092` Merge upstream main for current mobile task navigation baseline
- `197db1a415f5be7da2dce2d303a8c20e0015def6` Merge remote-tracking branch 'upstream/main' into cindy/gentle-curie
- `569fd698e86d6777308f4705bb78d26df66dc533` test(mobile): isolate native video in message render fixtures
- `f4813ffd36cff69bebb8200556256490990faea5` Merge pull request #7096 from nothingyuancando/codex/fix-6743-exec-argv0
- `cb0fd2b96834bb99ef5f496ffd03a9ceced39411` fix(mobile): show host upgrade hint for rejected settings capability
- `445c2d65a615fa0435894e1bd2b31819b2c1e5fa` fix: 重试保留排序时维持定时任务活跃礼让
- `436dd37647f0ef1b4cd99769843a8aaae57a5c4c` fix(mobile): recover failed bot group refreshes
- `5fdca83b24ca213deeacf03799fc835b06e5c36c` test: 补齐调度启动的人工操作时间依赖
- `80ae8774f134ea8004e512bd4ff93a1515359b49` fix(media): coordinate inline playback and reclaim idle video copies
- `40f799eb55d2498276138d6a3acf86e104bc16d7` test(mobile): verify current-task search through the layout consumer
- `092fc93b4570b11ddfef66b0b69a65460841c221` test(media): align keyboard coverage with inline native controls
- `cf789a51a4ad20103677ea2fd105833d9f2b637c` Merge pull request #7011 from zyjisdog/feat/session-context-window-ui
- `f93ac76b86668504c61971ee035a9fe06f6c73f6` Merge pull request #7102 from zcinta0514/fix-browser-background-viewport-20261025
- `6e6a40fd2b9374420dbe14009b8ebf0644cfc4cc` Merge pull request #7101 from zcinta0514/group-detail-read-recovery
- `a3f6e47a2355f918d65a71f1843417a40a64f2b6` fix(companion): drop the welcome an unfinished meeting queued when a take-over replaces the copy
- `b708a158085022a59bcd461c5b258a85fbd5f6a1` fix(companion): make clearing a queued invitation welcome best effort
- `f697c9568715940d7b7d632b190d6239e6b091e2` Merge upstream/main into fix-6806-group-settings-save
- `dfe8ac3272a9759b40c4b9272171c08af16bc446` fix(bots): 等待新快照后再清理已保存草稿
- `0cd0449e7d2365a1a6aacd81428398fc15d012a7` fix(scripts): 补齐 Windows 扫描缓冲与 Make 诊断码
- `74f1bedd9ccbb15f2f62e25b3394497d27d936c9` Merge pull request #7104 from makecindy/cindy/steady-lamarr
- `18a1f8d905895dd572a6903bbd8f45fefe2adf82` Merge pull request #7107 from zcinta0514/mobile-group-read-recovery
- `768214bbf0bbc43251cb33c2a66505bb174c9d4a` Merge pull request #7106 from zqchris/cindy/gentle-curie
- `5697229252a4be9d07827827ebb6b4d821c85e4c` fix(computer): negotiate optional cursor setup
- `62564c72116b951ccb00c3963500906dacf69283` fix(helper): 为任务查询返回可直接引用的跨设备链接
- `e5fe54893503db041702a7684106e6570feae097` test(computer): cover negotiated cursor dispatch
- `93deda053aeb06008a15a084d465932dd82ae10a` Merge pull request #7109 from Ethereal49/fix/scheduler-delete-missing-id
- `c8126f9a57d4c8cf8f164e1812f7ac1d6f0465fc` fix(deeplink): 外部打开任务时保留设备归属
- `08a9789b6164e87bd477a0c2ebff637b7afd684b` Merge pull request #6814 from zcinta0514/fix-6806-group-settings-save
- `345e2aa8cb9cf8c9094e1749a5ebea276d8a96fc` fix(ci): sync generated UI inventory and standard task route expectations
- `48ca9a6e516372513d6cad9ef25550ebc4ebee28` Merge upstream main and regenerate UI inventory for current CI baseline
- `f32002f8b0fd068a7173439dab4d6cb2e6ad3637` feat(pi,orca): 协同 token 卫生——提示词规则 + 压缩后一次性重申已披露工具 (#7110)
- `a6188342d10142af1e80854769ee9e98428205e6` test(desktop): align companion lifecycle with owner task access
- `9f2d4a823c704ddfead9d0b7b4ea127cf7791391` fix(deeplink): 统一设备身份并保持显式任务归属
- `65288cb160a63da69f177a50f30c03d3560f19f4` Merge pull request #6542 from zcinta0514/dev-ps-maxbuffer
- `b72d315890c93f6f43ef400d4490914d7ae90c92` fix(chat): 保留自动任务失败后的手动重试入口
- `ea58829e7eb605c9f576373d062b9a409750ab81` fix(device-link): validate new task directories on the SSH host
- `956b984c5ae4939268a70e738438165a764ca5bd` Merge pull request #7114 from nothingyuancando/codex/fix-6979-cursor-contract
- `f50c074496ed2487c8fa56784996de16b9b10718` fix(chat): 根据失败输入确定续跑资格并保留配置恢复门禁
- `5d30638f985602396fb26b0b998952c2cd301bf4` Merge pull request #7105 from zqchris/cindy/lively-kalam
- `a9b0fa45a1137870b9054b20922c5677f1293d97` Merge pull request #7116 from nanaco666/fix/companion-takeover-fresh-install
- `fb6d63aeaa23f594a27bfa811c4b4206734861a3` merge: sync upstream baseline for message motion
- `47201f0c33501688b6a175b0f3c775dd93b55da1` merge: preserve current message actions alongside motion changes
- `be03b4527b3a4f2e6007704382dc1c212c0b7510` fix(chat): 统一失败续跑资格的落库与清理边界
- `b3c1e1f13c17f087b037206a709aba0ec9db207a` fix(chat): coordinate continuous message layout and keyboard scrolling
- `59439d4db720c82f5114b68f506597b5b2ea149e` Merge pull request #7115 from makecindy/dash/task-result-links
- `8d1838aeb89529f0ef14da4b68fe04bc10213aa0` fix(bots): bound canonical reply tool scans to the next input
- `5b50300ce1633048f635f23864868fc08723afab` fix(chat): 合并已落库调度失败的续跑资格决策
- `351a55db66e57e76852767e93664e53b32673880` fix(chat): preserve group follow range and keyboard unread actions
- `ed1da855869ec68ccc65c8294c82f3af98d558a9` fix(im): project rich answers to readable outbound text
- `9a0793706d14eb6e451fb0cba1a38882716e4e03` test(plugins): stabilize library identity recovery on Windows
- `32876e227d56f9e8ef9134df94e20380d390bd38` merge: 同步主分支并保留双方协议兼容说明
- `0881fbbd78b0706b11b17d78e0e8cbc11bc2fe09` fix(bots): stop visibility checks at the nearest tool
- `b36e12e7f7152dc73ef6c226cb3695eea94377bb` fix(i18n): 用直白文案替换深度链接用词
- `5b08b17f53da0748698acabe4f25b897cc496821` fix(im): collect rich answer images before text delivery
- `d45f258f68e830d6aeb784c5eb5e541b6d8644ba` fix(mobile): 续跑复用历史错误的不可重试判定
- `3ffa0e459f64db95ed1aac7a47e685cb692b24f6` test(chat): align motion lifecycle fixtures and native boundaries
- `037dfb975dab829d114c0767bcaada437f8e6003` fix(bots): 移除发现伙伴的新标记与提示点
- `9418d48a891c23ab9f4a26518cf1eaa84e317ddd` Merge pull request #7128 from makecindy/dash/project-copy-link-label
- `180a4307374c5d56d62dec78990e45b1926d6255` Merge pull request #7119 from makecindy/dash/fix-terminal-error-retry
- `59200e6d21d2682a501b2fab7c6938668b72388c` Merge pull request #7120 from makecindy/cindy/sturdy-fermi
- `2197e0051f4e5264dcfece18577165a9dff8f68e` Merge pull request #7061 from makecindy/docs/cdp-screenshot-guide
- `b7e46bcbbe41eeee2f16381fef00df61a31a3b8b` Merge pull request #7131 from makecindy/dash/remove-companion-discovery-badges
- `d491621f1c5d946a3e2a132f33b8a3516c5a737a` merge: sync main and regenerate chat design inventory
- `4978e4f7bb1f8c1167a7903c29e081f6ab8937a3` fix(bots): keep sidebar retry PR focused on list recovery
- `54519fc41170798c081422b6f49b4c9e1493bf70` feat(menubar): 恢复伙伴未读并显示远控设备与设置入口
- `6868a50cf3fee8e6aec79ca046072ccca3e32d27` Merge main into cindy/vibrant-panini and resolve media CSP overlap
- `3e7d664e722a6cc5dd98a0025623bbbf1e0b3926` fix(island): 保留伙伴运行活动与完成声音并同步设计台账
- `190c9ba775471399c60384fa6816aea59ad9d34d` fix(desktop): stack primary pricing quotes by role
- `37770f250a37f291fe114a090928720be03e6294` perf(mobile): 避免伙伴列表重复渲染和预览解析
- `19bdc72fbb5c1e069c2af7fb23c4d9dde3cabbf2` perf(mobile): 缩小伙伴头像条的刷新范围
- `018564fd93884246fff16216a499ebbeee51c546` docs(auth): align startup fallback comments with registry
- `3ae8a913d3f85a05c28a475b5d450dbb2bc88fbf` fix(mobile): show authorized chat server image previews
- `2c2ae844b81951d4e4bc94c175a237f4b0572b83` fix(desktop): 修复损坏数据库维护锁导致的启动阻塞 #7135
- `9f42d1298f942af30ee6a954627ba2992bd39058` fix(mobile): load group previews only for visible history
- `465a7bc16a2e1a50050a5a2a5c80f482ff8c8bd9` test(mobile): cover multi-image history and thread preview visibility
- `0b861b3496833083151744653b9d1b8ccde05b16` fix(desktop): 按启动代次回收残留 schema transition gate
- `d4337a11e01beed0ab17364a28719aba0bf4d4c9` fix(desktop): 直接在侧栏打开并继续追问
- `1ca5ff0615b5b5e771c6d32c93d7cd5e09a9122f` fix(mobile): recover failed group image previews
- `809018534e6a8f1c2d3e6e528f7005dd755ee3e6` Merge pull request #7121 from xuzini-xzn/fix-group-sidebar-refresh-retry
- `12641d47092e43f8836e8fa8debfbfa1f9cfb94f` fix(codex): use bundled CLI inside task shells
- `b283268713a42ba9336e598b86e9ebb073139797` Merge pull request #7129 from nanaco666/fix-6958-canonical-query
- `b59b31d7856de59e65bf758e3b59211eb554758d` fix(codex): 多图会话重连后不再因请求超限反复中断
- `8aa095b4b0cc9e18fc0f37dfd233bf2dcbe3e4d7` docs(codex): 记录 HTTPS 回退与 WebSocket 超限外置规则
- `8a53f7d003df916aa69d554f44aabc0217c0b02a` test(codex): 修正 WebSocket 外置测试的 Buffer 类型标注
- `e8dc39cc4257d637e403c7b652b8ea6d9314264e` docs(media): 为 Codex WebSocket 超限外置补充附件恢复规则例外
- `d8f5aa9defffd100185c69d5fe129d25bb54d39d` Merge pull request #7139 from makecindy/feat/pricing-summary-layout
- `634095c311edb54dd0d354fbff4061900b30e3aa` Merge pull request #7134 from makecindy/dash/island-companion-unread
- `169c9f0bc3b9ba228dbed1a52ee49dd9f46eff66` merge: sync main and refresh generated design facts
- `656036b80dd557b28688b911b5b097363270a700` fix(settings): 明确任务用量榜单的当前模型与供应商
- `cf7339e2684df6d14d40b130dc915b3a92ac3964` Merge pull request #7052 from Crazy-Raven/cindy/vibrant-panini
- `a1c1de023141f63bb2ae64af0b84620801b1065b` Merge pull request #7125 from nanaco666/fix-6884-im-rich-answer-text
- `6341a4b32c5a3ac86b5a1d256f6b163c08cd891f` Merge pull request #7153 from makecindy/fix/codex-shell-bundled-cli
- `e601e40a204e330f9564e1c5bc415007901c557a` Merge pull request #7150 from makecindy/cindy/sincere-leakey
- `ae8b39fefa0ab249fda3419eb62eeb7ae15d8424` fix(mobile): cancel inactive group preview requests
- `2cc154073b14e5081b1fbbb89d3246064af6ce66` fix(desktop): 补齐数据库维护锁的 renderer 错误码契约
- `1480fe6cd2095e91c0686450cfbc5a547d1626d7` fix(mobile): preserve tapped images during initial preview
- `be6710f2368e2e924928d10dcdefeb72c7fe2f15` Merge pull request #7137 from elfcv/perf/mobile-teammate-list
- `744d48db3fbbe04160a2399cfb041928e52a05bd` Merge pull request #7130 from makecindy/dash/codex-ws-oversized-images
- `c7a31af6494278b236e5e2b6c96a12c719201b1f` Merge pull request #7155 from zcinta0514/fix-7152-usage-current-model
- `f261a46f8281b075bdd57623add78d1fdeef6fb8` Merge pull request #7146 from makecindy/cindy/amazing-mirzakhani
- `206b24ccc88ec6fab473f84040c7b23321c28e75` Merge pull request #7145 from xuzini-xzn/mobile-group-image-load
- `e3989810d84b0f4f5d8e18ef32ff144db6dacb34` merge: preserve viewport-gated previews with smooth group scrolling
- `56e2fdf2aa95a260efdde9b3fd160888cb806ffb` Merge pull request #7123 from zqchris/cindy/merry-leakey
- `7c5bd270c956417127e12a74934d0ecdb97ba55d` Merge pull request #6273 from iamcheyan/fix/cold-start-auth-timeout-race-upstream

## Synara 完整增量提交清单

- `487735e16d7776649bc1d6a0510944fe1f95c456` fix(opencode): isolate native sign-in and cold model discovery (#1998)
- `3eb1e30c4bb2793680d6fc6f05701ac12b71c22a` fix(projects): load project logos and use them as the project glyph (#1995)
- `9bf75d37e4b07c24e6e2dc52ca1048238d219ebe` fix(desktop): declare the bundled macOS 13 minimum (#1839)
- `34a7edbfb416a55d2911386b837f37cc689bfb90` fix(hubs): withhold Snooze and Hub actions from Hub workers (#1865)
- `40e96743cebdacd935d40119919113edc07e5eca` fix(persistence): compress pre-migration SQLite backups (#1765)
- `0f8e340283adf961d7b5af6b21c5cb62655e756d` fix(release): gate macOS13 updates by Darwin version
- `d176d51dbed04415edd7522ba0c60f98927e9b89` Merge pull request #2001 from Emanuele-web04/codex/macos13-update-feed
- `8e21e29c2a3d47205a0a9e834c8c44745efd0cf1` feat: enable native editor and MCP Connectors in Stable (#2002)
- `ebd0d22b39ce3a0f7c6051dddc6090e9b85dc7c3` release: prepare Synara 1.0.9 Stable
- `ac736ccf4df532afbdb5b058fd327c85caed0834` docs: publish verified Synara 1.0.9 release references
- `6300b86fc5d861102062b24dbf5b2fe46bbe4216` fix(server): fence ambiguous Claude recovery to runtime ownership
- `ddab94e3170b9fcb8187893236575bfb58f9c76e` fix(server): preserve recovery lease callback error types
- `13a6333b77c343a4e2895bba68b1b20e640d49a6` fix(claude): invalidate VCS metadata on publication notice
- `e5303d7b1ef69ae8984476a5c71edc53c6c77799` fix(server): allow explicit Stop after failed local recovery
- `7ff3f26acb24422939acd89f212540a5b659a6a1` fix(claude): fence rejected steer preparation to its original turn
- `555a741120547205301b785b6e03b1c63635836d` fix(web): keep explicit Stop reachable for quarantined threads
- `dfb6416d5fc621f854f06169ee12e34531b85262` fix: retire blocked idle Claude runtimes through explicit Stop
- `908ba50650e3bd87f605b222b9c6adf4bcaf518f` fix: fail Claude results carrying the SDK error flag
- `92a3b771a44233b3d8c03e4d82cb5dbfdd311c42` fix: admit Claude steers atomically with turn ownership
- `3868e0e9b71127f9b6713a6a5db1ec3828e59352` Merge pull request #2004 from Emanuele-web04/codex/claude-goal-freeze-recovery
- `b1dca5b251b567c3bc5fd8411370bea29a98bdc1` fix: report Claude Stop from verified runtime retirement
- `257b4de84410571a16ef5bd562debf4c1aa3c9fb` Merge pull request #2006 from Emanuele-web04/codex/claude-goal-freeze-recovery

## 发行验证

- 产品实现提交为 `08d731fcf9967b2cd94547cca06af14014d69022`（10 月 26 日）；本轮模拟器验收与浏览器检查修复后，正式 `v0.23.10` 标签指向 `8c7b7f2110707c8fd34da369a4ba84639be7580b`。今天的 `a40dc1fb66`、`8c7b7f2110` 是审计和验证修复，不计为新的产品功能。
- [主分支 CI 40438978643](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40438978643) 的 10 项任务全部成功，含 Windows/macOS/Ubuntu、手机、浏览器、RPM 构建与干净安装。桌面用量定向测试 1 项、桌面和手机 TypeScript、手机中英文词条检查通过；手机 lint 无错误，保留 `dictation.ts` 两条既有警告。Playwright Chromium 的视频实际解码、跳转、暂停测试通过；WebKit 的 Playwright 媒体运行环境无法可靠解码测试素材，明确跳过该视频用例，不能据此宣称 WebKit 视频播放已验收。
- 本地 Windows NSIS 安装包 `build/release-verify-0.23.10/MyCode_0.23.10_x64-setup.exe` 为 41,414,233 字节；产品名 MyCode，产品版本和文件版本均为 0.23.10，SHA-256 `2d822aae951c6ca4eb90561591b8500d20af54e6a0d9dd430542e99752a1d03b`，与 `SHA256SUMS.txt` 一致。未在已有用户安装上执行覆盖升级。
- [正式标签 Android CI 40438998862](https://github.com/dcxa521gi/MyCode-Pro/actions/runs/40438998862) 成功。APK `MyCode_0.23.10_Android.apk` 为 103,464,291 字节，SHA-256 `2e03086ae168b998335f0e9df16204214a2b240969c9c24fe87d7c7f7ce45eb8`，与 CI 校验文件一致。`aapt` 核对包名 `com.dcxa521gi.mycodemobile`、versionCode `2310`、versionName `0.23.10`；`apksigner` 确认 v2 发布签名，证书 SHA-256 `6787e8f3283482fd6e860c38eeba47adb7e1606d272ce5730327865db1f1c69b`，与上一版一致。API 35 x86_64 模拟器的配对页可见，无 Quickstep 弹窗，崩溃日志为 0 字节。Android 真机配对/覆盖安装和 iOS 真机未验收；不发布 IPA。
- 六个平台 MyCode Host 归档均先与 CI SHA-256 文件核对，再发布到独立 [mycode-host-v0.23.10](https://github.com/dcxa521gi/MyCode-Pro/tree/mycode-host-v0.23.10) 分支；本地和远端提交同为 `b5dfe0e31384d469ebf4d9bc8a49cda1759292c8`，共有六包、六校验文件、清单和 README 共 14 个文件。桌面发布页不包含 Host 包。
- [MyCode 0.23.10 公开发行](https://github.com/dcxa521gi/MyCode-Pro/releases/tag/v0.23.10)于 2026-10-27 11:37:11 +08:00 发布，恰含 Windows 安装包、Android 伴侣 APK 和各自的 SHA-256 文件四个允许附件，没有上游品牌安装包或 Host 包。发行白名单检查通过；四个附件均从公开地址匿名重新下载，字节数和 SHA-256 与本地原件一致，两份公开校验文件也与对应包一致。发行页中的安装包和 APK 的 GitHub SHA-256 digest 同样匹配本地文件。

