# MyCode 0.21.0 本地补充能力对照

对照日期：2026-10-13。Cindy 28afb1e → 3ea9099（121 提交）；Synara 9e01962 → b4bdc73（29 提交）。全部提交的完整哈希、主题、变更路径、适用性、处置和证据见同名 JSON。本文件如实区分已适配、等价部分能力、排除项和未集成候选，不把上游参考写成复制或完整同步。

## 本次实现与验证

- Synara 迟到终止事件：MyCode Codex原生通知只允许所属turnId结束当前轮次。completed/aborted/error回归先失败，再修复。
- Synara 活跃ownership：取消请求完成后provider仍在draining，3分钟闲置计时器不得停止其子进程；实际send settle后才重新计时。先失败，再修复。
- Cindy 原IM后台结果：MyCode Claude正常后台任务仍由原send等到完成；原send已结束后自发成功终稿通过原channel/session/cwd/harness绑定回传。子代理、失败、空终稿和重复result不回传，不含工具记录或系统提示。已核对App接受IM轮次后的实际workCwd/owner绑定、原session通知与桥接owner/connected校验；真实IM平台未执行。
- Cindy 显式模型元数据：mode/nativeApi/model_id保留，语音专用模型不得用聊天协议；modelsFor真实选择链按connection隔离。普通发现缓存更新，只有manualOverrides明确字段优先。TypeScript协议/选择/合并51测试通过；Rust原生local_ai全13测试通过。

运行验证：初次定向基线208测试通过；随后后台结果所有权/取消/空回复强化为6文件125测试通过，模型协议与来源缓存3套56测试通过，原生发现15测试通过。完整测试与发行检查另见0.21.0交付记录。真实IM账号、云供应商、跨设备和Windows安装验收未执行，不以fixture等同真实平台。

## 处置边界

Cindy只使用开源本地设计和行为，不接账号分享、设备目录或Cindy云。已移除的群聊、Freebuff和旧CLI重复提示不恢复；不更改凭据/历史/用户数据路径。Cindy插件namespace、媒体Images/video来源等仍列为未集成候选，不能以架构差异称为已集成。Synara Hubs独立权限及UI同样未复制。HTML融合MonoCode隔离组件，主代理报告Chromium/WebKit的实际CSP、opaque origin与消息来源校验通过，源代码已核对。FIFO使用MyCode既有普通文件guard，目录/Unix真FIFO回归已补；Unix执行仍等待Linux CI。

状态计数：reviewed-not-integrated 58；reviewed-reference 11；excluded-target 12；merge-record 25；adapted-partial 6；excluded-cloud 22；excluded-runtime 8；excluded-user-removal 1；existing-equivalent-partial 2；adapted-local 2；architecture-not-affected 1；equivalent-browser-validated 1；existing-equivalent-pending-unix-ci 1。

## 全提交处置

| 来源 | 提交 | 主题 | 状态 |
| --- | --- | --- | --- |
| cindy | e49f565 | feat(media): 支持自定义 OpenAI Images 来源 | reviewed-not-integrated |
| cindy | e4b0b77 | fix(media): 补齐自定义图片来源配置与响应边界 | reviewed-not-integrated |
| cindy | c6d83ad | feat(media): 接入自定义视频生成与图片转视频 | reviewed-not-integrated |
| cindy | 5d40f17 | fix(media): 修复旧插件选型和视频提交边界 | reviewed-not-integrated |
| cindy | 9f27cf9 | chore(docs): 重新生成设计台账消除合并冲突 | reviewed-reference |
| cindy | 60c981c | fix(media): 修复视频下载预算和连接变化恢复 | reviewed-not-integrated |
| cindy | e2a2ee4 | feat(mobile): 新增「我的消息气泡颜色」设置 | excluded-target |
| cindy | a4142f2 | Merge remote-tracking branch 'origin/main' into feat/mobile-user-bubble-color | merge-record |
| cindy | 649f152 | fix(mobile): 气泡颜色只染自己的消息，并保证气泡内文字可读 | excluded-target |
| cindy | ebded17 | fix(voice): 长段语音润色不再因返回数据超限而失败 (#5827) | reviewed-not-integrated |
| cindy | 6bfb53a | fix(model-providers): preserve BYOK speech catalog metadata | adapted-partial |
| cindy | 0c3b65e | fix(model-providers): normalize ElevenLabs TTS capabilities | adapted-partial |
| cindy | 2ef84d5 | fix(auth): Skills 路径非目录时不再阻断登录 | reviewed-not-integrated |
| cindy | 47da2a9 | Merge pull request #5818 from kirozeng/feat/mobile-user-bubble-color | merge-record |
| cindy | 9a29b3c | fix(model-providers): sync public BYOK speech identities | adapted-partial |
| cindy | 114d135 | fix(mobile): keep version update action compact below details | excluded-target |
| cindy | 30e61d1 | chore(docs): 更新设计台账日期消除主干冲突 | reviewed-reference |
| cindy | df51a8b | fix(desktop): 修复分享模型收藏并按区域清理撤权记录 | excluded-cloud |
| cindy | 37f012c | Merge pull request #5837 from makecindy/mobile-settings-version-layout | merge-record |
| cindy | 63bcd41 | fix(desktop): 修复 macOS 更新包定位兼容性 | excluded-runtime |
| cindy | aa61b32 | test(desktop): 补齐分享同步 mock 并兼容 Windows 链接夹具 | excluded-cloud |
| cindy | f4709d4 | fix(desktop): retry shared favorite cleanup across restarts | excluded-cloud |
| cindy | 53c8606 | Merge pull request #5784 from nanaco666/feat-custom-provider-images | merge-record |
| cindy | 73ba9a0 | chore(model-providers): resolve BYOK speech catalog merge conflict | adapted-partial |
| cindy | 33bf700 | fix(desktop): gate favorite recovery and resync owner generations | reviewed-not-integrated |
| cindy | 37945df | fix(remote-agent): 让托管 Claude 请求命中指定供应商 (#5829) | excluded-cloud |
| cindy | fa3fc88 | fix(bots): 模型失效时允许就地换模并继续创建伙伴 (#5773) | reviewed-not-integrated |
| cindy | 1c647df | fix(model-providers): honor active media metadata in BYOK settings | adapted-partial |
| cindy | 34c6e05 | feat(provider-groups): 展示匿名电脑状态和版本兼容提示 | excluded-cloud |
| cindy | 8050d43 | fix(provider-groups): 精简电脑行并收起未知信息 | excluded-cloud |
| cindy | 79b9fc5 | fix(provider-groups): 从查看端设备目录补充电脑版本 | excluded-cloud |
| cindy | 0a95a4f | test(desktop): await import creation instead of polling disk timing | reviewed-reference |
| cindy | 487fa52 | feat(provider-sharing): 支持当前任务内持续允许凭证操作 | excluded-cloud |
| cindy | af8975d | test(media): 兼容 Windows 图片路径越界测试的链接夹具 | reviewed-reference |
| cindy | dbb2377 | feat(desktop): 没有组的供应商用量按只有本机一台的组显示 (#5806) | reviewed-not-integrated |
| cindy | 04ce8f7 | fix(desktop): restore revoked favorites without cross-region access | excluded-cloud |
| cindy | d53b31e | test(desktop): 覆盖 macOS 更新包缺少应用包 | excluded-runtime |
| cindy | 6e0605f | Merge pull request #5831 from horizon554/codex/byok-speech-catalog | merge-record |
| cindy | d04975d | test: isolate directory pagination from filesystem latency | reviewed-reference |
| cindy | bfcd51b | fix(provider-sharing): 补齐 IM 凭证授权并清理切档后的临时批准 | excluded-cloud |
| cindy | 468a071 | fix(mobile): 同步抽屉退场与设置页默认转场 (#5843) | excluded-target |
| cindy | ec988bf | feat(provider-group): add quota-aware usage balancing | excluded-cloud |
| cindy | 2ebd1ee | fix(desktop): serialize share markers and reject stale membership | excluded-cloud |
| cindy | a835496 | Merge pull request #5835 from makecindy/feature/login-cleanup-nonblocking | merge-record |
| cindy | 4b401b3 | fix(desktop): 记住伙伴工作台的关闭选择 (#5852) | reviewed-not-integrated |
| cindy | 06eefbc | Merge pull request #5863 from makecindy/cindy/earnest-thompson | merge-record |
| cindy | c6682dc | fix(mobile): 发送时因模型已关闭打开模型列表，也显示重选提示 (#5850) | excluded-target |
| cindy | 8a7a274 | fix(desktop): support long shared favorite sources | excluded-cloud |
| cindy | a0324ee | Merge origin/main into cindy/trusty-mendeleev | merge-record |
| cindy | 71d49e0 | Merge pull request #5842 from makecindy/cindy/amazing-galileo | merge-record |
| cindy | 3052e77 | Merge pull request #5844 from makecindy/cindy/trusty-mendeleev | merge-record |
| cindy | d826f05 | feat(headless): 新增容器化 Benchmark CLI 与 Linux 打包流程 (#4750) | excluded-runtime |
| cindy | e462fcc | fix(pi): avoid inherited model rebuild loops (#5387) (#5532) | reviewed-not-integrated |
| cindy | 37385a2 | fix(browser): keep agent-read pages in background (#5834) | reviewed-not-integrated |
| cindy | ff778d2 | fix(mobile): 修复 iOS 群设置滚动到底 (#5785) | excluded-target |
| cindy | 73b0ccb | fix(chat): 为桌面和手机消息图片增加加载占位与转圈 | reviewed-not-integrated |
| cindy | e2306db | fix(chat): 对齐图片淡入档位并补充换图回归与设计清单 | reviewed-not-integrated |
| cindy | fb2e104 | feat(desktop): 设置页支持 Esc 逐层返回 (#5851) | reviewed-not-integrated |
| cindy | a60a1ec | chore(desktop): upgrade Electron to 42.11.12 (#5846) | excluded-runtime |
| cindy | 66a99e5 | feat(im): 渠道进度头部显示当前 tok/s (#5856) | reviewed-not-integrated |
| cindy | e06d058 | feat(review): /review 向内联体验收敛并自动回流来源任务 (#5859) | reviewed-not-integrated |
| cindy | 62d0c54 | fix(device-link): sessions 订阅瞬时失败后由周期对账补订 (#5861) | excluded-cloud |
| cindy | 232169b | fix(remote): 编辑排队消息后保留仍在使用的图片附件 (#5862) | reviewed-not-integrated |
| cindy | 0470ace | fix(chat): wait for desktop image decoding before fading in | reviewed-not-integrated |
| cindy | 93f1393 | feat(plugins): 按 namespace 识别并隔离插件实例 (#5753) | reviewed-not-integrated |
| cindy | 74f6dd8 | fix(models): restore account-discovered models for Pi (#5865) | reviewed-not-integrated |
| cindy | 3621300 | fix(desktop): make the menu bar quota panel lighter and fit every language | reviewed-not-integrated |
| cindy | 6638fc2 | fix(desktop): redesign the menu bar usage page at panel width | reviewed-not-integrated |
| cindy | 0b91519 | fix(mobile): use existing translation for image loading label | excluded-target |
| cindy | d2e291c | fix(models): 统一启动默认模型并优先使用 Pi 运行 Grok (#5866) | reviewed-not-integrated |
| cindy | e853b5e | fix(provider-groups): bound shared status capability probes | excluded-cloud |
| cindy | 184684c | fix(bots): 按逐任务真实责任显示伙伴头像和工作台 (#5870) | reviewed-not-integrated |
| cindy | 74fbedf | Merge upstream main into menubar-compact | merge-record |
| cindy | cf36221 | fix(desktop): mark running usage tasks without motion and time preview snapshots from the page switch | reviewed-not-integrated |
| cindy | 81e0ad5 | fix(desktop): keep the usage page header fixed while its body scrolls | reviewed-not-integrated |
| cindy | 73d99b6 | fix(bots): recover companion context before native compaction stalls (#5877) | reviewed-not-integrated |
| cindy | 389423b | fix(desktop): pin the detail page's back and action, and make the status options a pill radio group | reviewed-not-integrated |
| cindy | c96ae90 | fix(provider-group): finish quota-aware routing fixes | excluded-cloud |
| cindy | 03f01d1 | fix(desktop): 分享链接复制改由主进程写入并读回核对 (#5886) | excluded-cloud |
| cindy | 002ca0a | fix(scheduler): 空终稿判据改为不变式，定时任务收尾不再重复或多写回复（#5220 后续） (#5282) | reviewed-not-integrated |
| cindy | 7d3dbc9 | test(bot-groups): 补强发送与真人署名安排卡回归覆盖 (#5613) | excluded-user-removal |
| cindy | 9d666e6 | fix(desktop): 隔离 Skill 目录扫描避免客户端卡死 (#5858) | reviewed-not-integrated |
| cindy | a4df240 | fix(provider-groups): reuse capability reader across detail refreshes | excluded-cloud |
| cindy | d46dd4b | fix(desktop): 供应商组本机自用优先且不受对外暂停影响 (#5864) | reviewed-not-integrated |
| cindy | 1d69977 | fix(desktop): 复制聊天图片时去掉插件标注行，气泡与普通消息一致 (#5885) | reviewed-not-integrated |
| cindy | 4342a19 | merge main to resolve provider group status conflicts | merge-record |
| cindy | ede750e | fix(chat): use registered image fade animation | reviewed-not-integrated |
| cindy | 7736710 | fix(models): 默认选择 GPT-6.1 Sol (#5895) | reviewed-not-integrated |
| cindy | 0bdda6e | fix(provider-group): preserve failover lease across session close (#5880) (#5894) | excluded-cloud |
| cindy | aebeaff | update claude bin | excluded-runtime |
| cindy | b09dc19 | Merge branch 'main' of github.com:makecindy/cindy | merge-record |
| cindy | 1e11ee9 | feat(mobile): 支持已有群的设置管理 (#5881) | excluded-target |
| cindy | f5f439c | chore: 同步主干并重新生成设计清单 | reviewed-reference |
| cindy | 41de219 | merge: sync main into provider-group usage balancing | merge-record |
| cindy | cc40ad9 | Merge pull request #5893 from zqchris/menubar-compact | merge-record |
| cindy | 4c1554e | fix(mobile): 合并 Windows 同路径工作区并统一选中状态 (#5897) | excluded-target |
| cindy | 0e98451 | fix(provider-group): retain usable members during slow quota reads | excluded-cloud |
| cindy | da33f0a | chore(headless): align example profile runtime pins | excluded-runtime |
| cindy | e588d25 | fix(headless): refreeze Claude profile after runtime pin update | excluded-runtime |
| cindy | 8d99c73 | Merge pull request #5871 from makecindy/feat/provider-group-usage-balancing | merge-record |
| cindy | 559f693 | fix(worktree): 修复孤儿会话与预创建 worktree 回收 (#5898) | existing-equivalent-partial |
| cindy | c7b7cba | test: stabilize cross-platform unit fixtures | reviewed-reference |
| cindy | 9203b4f | Merge remote-tracking branch 'origin/main' into HEAD | merge-record |
| cindy | 837060b | fix: prefer live provider group versions | reviewed-not-integrated |
| cindy | db637d5 | chore: 同步主干的 headless CI 修复 | excluded-runtime |
| cindy | c9a5571 | Merge pull request #5853 from makecindy/feat/shared-provider-group-status | merge-record |
| cindy | f14b2f0 | fix(im): 后台子任务唤醒的轮次也回传到原 IM 渠道 (#5907) | adapted-local |
| cindy | a39614e | Merge pull request #5887 from makecindy/dash/remote-message-image-placeholder | merge-record |
| cindy | c4a54cf | feat(desktop): 侧栏「更多」悬停即展开二级菜单 (#5884) | reviewed-not-integrated |
| cindy | 4101d19 | feat(models): 新增 Meta Muse Wonder 模型资料与 XD 路由 (#5908) | reviewed-not-integrated |
| cindy | c06695b | fix(maker-core): 同批发出的等待轮询不再误判循环，受邀者会话用分享的模型复核 | architecture-not-affected |
| cindy | fe6dff3 | feat(models): 支持收藏同账号其他电脑上的模型 (#5910) | excluded-cloud |
| cindy | 4d8949f | fix(mobile): 自动化组展开箭头移到标题后，子任务不再比分组更靠左 (#5909) | excluded-target |
| cindy | 1ba6436 | refactor(maker-core): 受邀者会话改交分享者电脑的辅助模型复核 | excluded-cloud |
| cindy | 9adfed2 | fix(mobile): 打开过的定时任务按普通任务驻留，切后台不再清空正文 | excluded-target |
| cindy | 48c93ae | fix(mobile): 删除、归档或移除设备时清掉任务的已打开标记 | excluded-target |
| cindy | a69ffb2 | chore: 重新触发 PR 检查 | reviewed-reference |
| cindy | b66eac1 | feat(plugins): 企业目录被拒时提示原因并保留公开插件 (#5896) | reviewed-not-integrated |
| cindy | 2196255 | Merge pull request #5911 from makecindy/dash/tool-loop-paced-batch-review | merge-record |
| cindy | 0a0ce51 | Merge pull request #5913 from makecindy/dash/mobile-schedule-viewed-retention | merge-record |
| cindy | 3ea9099 | fix(review): disable native project doc discovery (#5888) | reviewed-not-integrated |
| synara | fe9643d | docs: require explicit authorization for UI changes | reviewed-reference |
| synara | 1a9d709 | style: normalize 1.0.3 changelog spacing | reviewed-reference |
| synara | 9746069 | Merge shared changelog formatting prerequisite into UI authorization docs | merge-record |
| synara | 15daeff | fix(hubs): preserve coordinator access and worker approval modes | reviewed-not-integrated |
| synara | 811eba2 | style: normalize changelog spacing | reviewed-reference |
| synara | e6d5da7 | fix(hubs): retain verified Claude Auto capability in check-ins | reviewed-not-integrated |
| synara | d450964 | Merge pull request #1861 from Emanuele-web04/codex/fix-hub-access-modes | merge-record |
| synara | 102fe5e | Merge pull request #1853 from Emanuele-web04/cleanup/20261011/pr-1850-ui-authorization | merge-record |
| synara | 3b566df | Revert "fix(composer): join stacked panels to the input outline (#1798)" | reviewed-not-integrated |
| synara | 1af2e72 | fix(composer): restore the context meter progress ring | reviewed-not-integrated |
| synara | ab2c072 | Revert "fix(web): align stacked composer panels with input (#1651)" | reviewed-not-integrated |
| synara | 19c6136 | fix(grok): offer Extra High on Grok 4.7 Build Fast | reviewed-not-integrated |
| synara | a8f09db | Merge pull request #1879 from xFurti/fix/grok-4.7-build-fast-extra-high | merge-record |
| synara | 1b5d327 | fix(transcript): keep a turn whole when background work settles mid-turn | reviewed-not-integrated |
| synara | f348d67 | Recover interrupted chats safely without changing chat UI (#1873) | existing-equivalent-partial |
| synara | f7400f1 | fix: preserve sessions through event-loop stalls and round composer corn (#1877) | reviewed-not-integrated |
| synara | 17182ee | fix(onboarding): give Skip setup real padding and focus ring (#1882) | reviewed-not-integrated |
| synara | 72bdc45 | fix(pi): report Pi as not installed when neither the CLI nor credentials exist (#1883) | reviewed-not-integrated |
| synara | e2e3c03 | fix(hubs): render the empty Hubs page on the route card; subtle seam hover (#1885) | reviewed-not-integrated |
| synara | ea145fd | fix(sidebar): keep thread rows stable while pressing (#1881) | reviewed-not-integrated |
| synara | 60dc4e6 | fix(codex): preserve active turns on delayed terminal notifications (#1887) | adapted-local |
| synara | d50978b | Protect active provider sessions during idle cleanup (#1872) | adapted-partial |
| synara | 5c633be | perf(chat): open, switch and scroll long chats faster (#1862) | reviewed-not-integrated |
| synara | 5039083 | fix(sidebar): anchor rows after subagent navigation (#1886) | reviewed-not-integrated |
| synara | 5d5aa33 | Stabilize sidebar order for unread and working chats (#1876) | reviewed-not-integrated |
| synara | cea504e | feat(beta): add inline visual components with isolated desktop HTML (#1874) | equivalent-browser-validated |
| synara | c3446eb | fix(transcript): show the open book icon on file reads (#1896) | reviewed-not-integrated |
| synara | 1f0c8e6 | fix(server): reject workspace FIFOs without blocking native I/O (#1898) | existing-equivalent-pending-unix-ci |
| synara | b4bdc73 | fix(server): preserve first-turn naming during backlogged replay (#1897) | reviewed-not-integrated |

App原IM订阅/owner绑定、实际workCwd核对和原session通知已核实接入；供应商发现UI已真实调用mergeDiscoveredModelMetadata。原生发现主crate15测试通过，TypeScript检查通过。Unix FIFO结果待Linux CI，不把浏览器验证等同Tauri实机。

后台生命周期边界已修：实际补充回复期间显式新send被拒绝；原点lease绑定所接受轮次，取消终止旧transport并允许下次显式恢复。仅真实assistant开始或非空内容加已完成/成功终稿触发推送，init、尾事件、空信封、中断、取消及旧重复结果不会推送。三条伪造旧结果回归真实RED后GREEN；定向6文件125测试通过，独立spec通过。真实IM账号未执行。
