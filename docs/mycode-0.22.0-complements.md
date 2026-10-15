# MyCode 0.22.0 Cindy 与 Synara 补充核对

Cindy 128、Synara 21，共 149 个增量提交。主题分类是审阅索引，不代表全部代码移植；仅采纳本地可运行且适合 MyCode 的能力。Cindy 云服务、分享和团队账号能力不接入。

本版对 Synara 的浏览器页面状态保持思路做了本地适配：MyCode 内置预览被其他页面盖住时保持 iframe。Cindy 的本地微信 iLink 既有适配在 MyCode 桥接层修复连接状态、重试和回复上下文；本轮 Cindy 云端提交不作为新增代码来源。

| 来源 | 提交 | 分类 | 原始主题 | 处置 |
| --- | --- | --- | --- | --- |
| Cindy | c236982 | 模型/用量 | feat(provider-sharing): 分享任务里少弹凭证确认，命令里写着密钥时照样确认 | 已核对提交主题；本版未移植 |
| Cindy | c3e5ef4 | 模型/用量 | fix(provider-sharing): harden git credential exemptions | 已核对提交主题；本版未移植 |
| Cindy | 68d62d3 | 其他能力/修复 | fix(cindy-make): 隐藏并禁用所有用户入口 | 已核对提交主题；本版未移植 |
| Cindy | 0cb3954 | 其他能力/修复 | fix(cindy-make): close cold-link and app attention gaps | 已核对提交主题；本版未移植 |
| Cindy | a76ee8e | 交付/测试/维护 | Merge main into fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | 4070db1 | 权限/安全 | fix(remote-agent): tighten shared credential read checks | 已核对提交主题；本版未移植 |
| Cindy | 987c1af | 移动/设备 | fix(cindy-make): close mobile home and file entry gaps | 已核对提交主题；本版未移植 |
| Cindy | 8614175 | 模型/用量 | fix(provider-sharing): reject unverified Git probe runtimes | 已核对提交主题；本版未移植 |
| Cindy | 0fedc01 | 其他能力/修复 | fix(cindy-make): close failed lookups and hidden task notifications | 已核对提交主题；本版未移植 |
| Cindy | 24b20cc | 交付/测试/维护 | Merge main into fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | ff14764 | 模型/用量 | fix(provider-sharing): fail closed for Git objects and linked inputs | 已核对提交主题；本版未移植 |
| Cindy | 1cd6c4f | 模型/用量 | fix(cindy-make): filter hidden tasks from usage surfaces | 已核对提交主题；本版未移植 |
| Cindy | 520f62d | 桌面/界面 | fix(cindy-make): remove disabled entries from built-in help | 已核对提交主题；本版未移植 |
| Cindy | 0837b02 | 模型/用量 | fix(provider-sharing): bind credential exemptions to search and Git sources | 已核对提交主题；本版未移植 |
| Cindy | 8782cd8 | 模型/用量 | fix(provider-sharing): scan ambiguous config queries conservatively | 已核对提交主题；本版未移植 |
| Cindy | 8443aea | 其他能力/修复 | fix(cindy-make): suppress hidden pending failure alerts | 已核对提交主题；本版未移植 |
| Cindy | b406ba8 | 模型/用量 | fix(provider-sharing): fail closed on Git helpers and shell hooks | 已核对提交主题；本版未移植 |
| Cindy | 0986072 | 其他能力/修复 | fix(cindy-make): overread legacy remote search candidates | 已核对提交主题；本版未移植 |
| Cindy | 3cc7202 | 模型/用量 | fix(provider-sharing): require consent for Git remote queries | 已核对提交主题；本版未移植 |
| Cindy | 911298d | 模型/用量 | fix(provider-sharing): guard zsh startup before Git probes | 已核对提交主题；本版未移植 |
| Cindy | 1528ed6 | 模型/用量 | fix(provider-sharing): require consent for Git clean filters | 已核对提交主题；本版未移植 |
| Cindy | 86dc414 | 交付/测试/维护 | Merge main into fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | 7536a6f | 其他能力/修复 | fix(cindy-make): stop hidden task delivery and sharing | 已核对提交主题；本版未移植 |
| Cindy | 4e522c1 | 模型/用量 | fix(provider-sharing): account for inherited ripgrep config | 已核对提交主题；本版未移植 |
| Cindy | 3cee4f5 | 交付/测试/维护 | test(cindy-make): cover disabled outbox message leases | 已核对提交主题；本版未移植 |
| Cindy | 673f4be | 权限/安全 | fix(cindy-make): preserve unknown ordinary share records | 已核对提交主题；本版未移植 |
| Cindy | f25d40c | 交付/测试/维护 | Merge latest main into fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | 0d9fef5 | 模型/用量 | fix(provider-sharing): bound Git probes and block fsmonitor hooks | 已核对提交主题；本版未移植 |
| Cindy | dcc9797 | 权限/安全 | fix(cindy-make): confirm sources before shared task discovery | 已核对提交主题；本版未移植 |
| Cindy | a7b8265 | 模型/用量 | fix(provider-sharing): require consent for Git signature verifiers | 已核对提交主题；本版未移植 |
| Cindy | ed3c4fc | 交付/测试/维护 | test(cindy-make): confirm shared task button fixture sources | 已核对提交主题；本版未移植 |
| Cindy | c660aa1 | 模型/用量 | fix(provider-sharing): require consent for index change hooks | 已核对提交主题；本版未移植 |
| Cindy | 674708d | 其他能力/修复 | fix(hook): 继承默认模型时不再被残留的目录来源卡死任务 (#5912) | 已核对提交主题；本版未移植 |
| Cindy | 53e23b6 | 交付/测试/维护 | docs(hook): 设置页注释同步来源校验的现行规则 | 已核对提交主题；本版未移植 |
| Cindy | 1b9f00f | 模型/用量 | fix(provider-sharing): reject submodule reads and untrusted shells | 已核对提交主题；本版未移植 |
| Cindy | 63c0e48 | 权限/安全 | fix(cindy-make): prevent legacy version and share bypasses | 已核对提交主题；本版未移植 |
| Cindy | 47b4b61 | 其他能力/修复 | fix(hook): 来源清理覆盖重连镜像，残留判定只认来源未提供该模型 | 已核对提交主题；本版未移植 |
| Cindy | 60a93cb | 其他能力/修复 | fix(hook): 远端只换 Agent 也清配对来源；null-team 兜底来源不因单个 team 改路由被清 | 已核对提交主题；本版未移植 |
| Cindy | 28c0cf9 | 模型/用量 | fix(provider-sharing): keep consent for ripgrep preprocessors | 已核对提交主题；本版未移植 |
| Cindy | 31a1649 | 模型/用量 | fix(cindy-make): hide unconfirmed peer usage tasks | 已核对提交主题；本版未移植 |
| Cindy | 4ab149d | IM/消息 | fix(bots): preserve group replies across persistence and approval waits | 已核对提交主题；本版未移植 |
| Cindy | 8c2c3d1 | IM/消息 | fix(runtime): preserve Codex transport in automatic fallback | 已核对提交主题；本版未移植 |
| Cindy | 74238ad | 模型/用量 | fix(runtime): honor model wire protocols in fallback | 已核对提交主题；本版未移植 |
| Cindy | e04f9f0 | 交付/测试/维护 | docs(rules): 能力台账登记目录来源判定边界 (#5912) | 已核对提交主题；本版未移植 |
| Cindy | 09deecd | 交付/测试/维护 | Merge main into fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | 8a3dcbd | 其他能力/修复 | fix(cindy-make): reject forks of disabled sessions | 已核对提交主题；本版未移植 |
| Cindy | 944243f | 其他能力/修复 | fix(review): disable native project doc discovery (#5421) (#5533) | 已核对提交主题；本版未移植 |
| Cindy | 7bafb95 | 交付/测试/维护 | Merge pull request #5914 from makecindy/dash/fix-x-orphan-provider-source | 已核对提交主题；本版未移植 |
| Cindy | 2910a85 | 交付/测试/维护 | Merge pull request #5296 from Dante-dan/fix/5280-compatible-runtime-fallback | 已核对提交主题；本版未移植 |
| Cindy | 59099db | 权限/安全 | fix(cindy-make): isolate hidden share cleanup failures | 已核对提交主题；本版未移植 |
| Cindy | 5d82cc3 | 桌面/界面 | fix(desktop): 精简菜单栏用量管理文案 (#5927) | 已核对提交主题；本版未移植 |
| Cindy | 551e025 | 其他能力/修复 | fix(goal): 普通消息后继续目标并接通手机命令 (#5919) | 已核对提交主题；本版未移植 |
| Cindy | 540f5c9 | IM/消息 | fix(pi): scope inherited windows to runtime binary (#5890) | 已核对提交主题；本版未移植 |
| Cindy | ca33b93 | 模型/用量 | feat(model-access): 在模型详情展示可选复杂价目 | 已核对提交主题；本版未移植 |
| Cindy | 0531f6a | 桌面/界面 | perf(desktop): 普通插件读取凭证时跳过 Mivo 身份校验 | 已核对提交主题；本版未移植 |
| Cindy | 4aadca6 | 交付/测试/维护 | chore: 合并 main 并保留两组协议说明 | 已核对提交主题；本版未移植 |
| Cindy | 39cfa0e | 模型/用量 | fix(billing): 补充个人版开票盖章说明和多语言邮件模板 | 已核对提交主题；本版未移植 |
| Cindy | 888996c | 交付/测试/维护 | Merge pull request #5923 from makecindy/group-mention-reliability | 已核对提交主题；本版未移植 |
| Cindy | f2e61ff | 交付/测试/维护 | Merge pull request #5903 from makecindy/fix/disable-cindy-make | 已核对提交主题；本版未移植 |
| Cindy | bf8bddc | 移动/设备 | feat(mobile): 统一 iOS 首页与聊天顶栏，任务／伙伴左右滑动切换 | 已核对提交主题；本版未移植 |
| Cindy | 8b8f1ad | 交付/测试/维护 | docs(design): 决策记录按现行月份分节写 10-13 条目 | 已核对提交主题；本版未移植 |
| Cindy | 2f39ff7 | 交付/测试/维护 | Merge pull request #5932 from makecindy/cindy/sharp-knuth | 已核对提交主题；本版未移植 |
| Cindy | 37ab58d | 模型/用量 | fix(model-access): 修正零价文案并覆盖复杂价目渲染 | 已核对提交主题；本版未移植 |
| Cindy | ddc3767 | 模型/用量 | fix(model-access): 将价目区域排除出菜单悬浮选项 | 已核对提交主题；本版未移植 |
| Cindy | e0cbabf | 移动/设备 | fix(mobile): keep cached teammates accessible and recover remote reads (#5928) | 已核对提交主题；本版未移植 |
| Cindy | ddeaf5d | 其他能力/修复 | fix: 为旧任务闭流错误提供可读历史恢复入口 | 已核对提交主题；本版未移植 |
| Cindy | b68c89a | 交付/测试/维护 | Merge pull request #5934 from nanaco666/fix-invoice-company-stamp | 已核对提交主题；本版未移植 |
| Cindy | 73537b1 | 交付/测试/维护 | docs: 同步可读历史恢复入口的 UI 台账 | 已核对提交主题；本版未移植 |
| Cindy | 5b587c6 | 交付/测试/维护 | chore: 同步主干并合并恢复入口台账 | 已核对提交主题；本版未移植 |
| Cindy | 2fcee5b | 移动/设备 | fix(mobile): 对齐历史恢复与 Fork 的等待窗口 | 已核对提交主题；本版未移植 |
| Cindy | 6afee6c | 交付/测试/维护 | Merge remote-tracking branch 'origin/main' into feat/mobile-home-chat-chrome | 已核对提交主题；本版未移植 |
| Cindy | 7f6a801 | 交付/测试/维护 | test(mobile): 补齐 Goal 发送测试的页面依赖 | 已核对提交主题；本版未移植 |
| Cindy | 85a1c24 | 交付/测试/维护 | fix(scheduler): release recovery after automatic resume fails | 已核对提交主题；本版未移植 |
| Cindy | 9b449c4 | 交付/测试/维护 | test(desktop): 对齐恢复入口守卫并等待授权通知 | 已核对提交主题；本版未移植 |
| Cindy | 46edb4e | 交付/测试/维护 | test: fix goal command fixtures and isolate library archive helper IO | 已核对提交主题；本版未移植 |
| Cindy | ccbaf71 | 交付/测试/维护 | Merge pull request #5951 from makecindy/fix/scheduler-auto-resume-recovery | 已核对提交主题；本版未移植 |
| Cindy | 928e9d4 | 桌面/界面 | fix(desktop): 修复伙伴/群设置抽屉关闭按钮点击无效 | 已核对提交主题；本版未移植 |
| Cindy | 6966142 | 交付/测试/维护 | Merge pull request #5956 from makecindy/cindy/silly-ritchie | 已核对提交主题；本版未移植 |
| Cindy | d23e4fa | 交付/测试/维护 | Merge pull request #5971 from makecindy/cindy/dazzling-fermi | 已核对提交主题；本版未移植 |
| Cindy | c78b6a7 | 桌面/界面 | fix(desktop): 修复分享供应商「本任务总是允许」在并发与 Worker 重建后失效 | 已核对提交主题；本版未移植 |
| Cindy | 7085c77 | 移动/设备 | fix(mobile): 从 Play AAB 移除安装包权限 (#5187) | 已核对提交主题；本版未移植 |
| Cindy | ac7be9f | 桌面/界面 | fix(desktop): 在启动和登录异常时提供日志反馈入口 (#5970) | 已核对提交主题；本版未移植 |
| Cindy | 2d4c5d7 | 交付/测试/维护 | Merge latest main into provider-sharing credential improvements | 已核对提交主题；本版未移植 |
| Cindy | d5e2927 | 模型/用量 | fix(provider-sharing): keep nested credential checks sharing-only | 已核对提交主题；本版未移植 |
| Cindy | 601d8de | 模型/用量 | fix(provider-sharing): accept standard Git LFS read filters | 已核对提交主题；本版未移植 |
| Cindy | 16c14ee | 交付/测试/维护 | fix(provider-sharing): inspect implicit merge patches for credentials | 已核对提交主题；本版未移植 |
| Cindy | e1c2836 | 交付/测试/维护 | fix(provider-sharing): guard remerge drivers and isolate history probes | 已核对提交主题；本版未移植 |
| Cindy | 16fd77d | 模型/用量 | fix(provider-sharing): inspect Git logical variable output before exemption | 已核对提交主题；本版未移植 |
| Cindy | 9464163 | 模型/用量 | fix(provider-sharing): inspect source lines in Git whitespace diagnostics | 已核对提交主题；本版未移植 |
| Cindy | 6b9de39 | 模型/用量 | fix(provider-sharing): check Git mailmap credential sources | 已核对提交主题；本版未移植 |
| Cindy | 928cf51 | 交付/测试/维护 | Merge pull request #5879 from makecindy/feat/share-credential-fewer-prompts | 已核对提交主题；本版未移植 |
| Cindy | 3d2dc0d | 移动/设备 | fix(mobile): 伙伴页保存失败提示出现时滚回可见，滑动转场仅限 iOS | 已核对提交主题；本版未移植 |
| Cindy | 2c06c87 | 其他能力/修复 | fix(codex): 补齐 GPT-6.1 网关搜索历史的工具声明 (#5992) | 已核对提交主题；本版未移植 |
| Cindy | 5a3cfed | 桌面/界面 | fix(desktop): 权限档变化后作废分享供应商的任务级凭证授权 | 已核对提交主题；本版未移植 |
| Cindy | 118a919 | 移动/设备 | fix(mobile): 减少隐藏弹层键盘处理并修正性能诊断 (#5999) | 已核对提交主题；本版未移植 |
| Cindy | 935c855 | 桌面/界面 | fix(desktop): 思考档位投影跟随进程实测值，目录误判不再渲染成假「低」 (#5780) | 已核对提交主题；本版未移植 |
| Cindy | 2599c04 | 桌面/界面 | fix(desktop): Thread 内唤醒伙伴时送对话题上下文 (#5969) | 已核对提交主题；本版未移植 |
| Cindy | 6c87572 | 交付/测试/维护 | Merge origin/main and refresh mobile design inventory | 已核对提交主题；本版未移植 |
| Cindy | a796ec8 | 模型/用量 | fix(models): 统一分享与远程模型收藏视图 | 已核对提交主题；本版未移植 |
| Cindy | 0b28f45 | 交付/测试/维护 | test(models): 覆盖被控任务修改分享收藏配置 | 已核对提交主题；本版未移植 |
| Cindy | a3aa86a | 桌面/界面 | perf(bot-groups): 打开群聊立即显示群框架，并缩短 Chat Server 串行读取 (#6012) | 已核对提交主题；本版未移植 |
| Cindy | c950b50 | 其他能力/修复 | fix(plugins): 修复 0.1.105 作品库读写变慢与重装后作品库变空 (#5967) | 已核对提交主题；本版未移植 |
| Cindy | a129242 | 模型/用量 | fix(models): 按被控端收藏恢复跨区分享授权 | 已核对提交主题；本版未移植 |
| Cindy | ec61898 | 交付/测试/维护 | Merge pull request #5931 from makecindy/feature/model-display-pricing | 已核对提交主题；本版未移植 |
| Cindy | f3d07ef | 交付/测试/维护 | Merge origin/main into fix/shared-provider-concurrent-consent | 已核对提交主题；本版未移植 |
| Cindy | 13a1adf | 交付/测试/维护 | Merge pull request #5940 from kirozeng/feat/mobile-home-chat-chrome | 已核对提交主题；本版未移植 |
| Cindy | a243547 | 交付/测试/维护 | Merge pull request #5957 from makecindy/cindy/elegant-hodgkin | 已核对提交主题；本版未移植 |
| Cindy | 9acae25 | 桌面/界面 | feat(group-chat): 新增引用回复，原「回复」改名为「创建话题」 (#5976) | 已核对提交主题；本版未移植 |
| Cindy | 80cc9ec | 交付/测试/维护 | test(desktop): 为权限档源码切片测试注入 forgetCredentialGrants 并覆盖清除时机 | 已核对提交主题；本版未移植 |
| Cindy | 0118593 | 交付/测试/维护 | test(desktop): 去掉新增 mock 的未使用参数 | 已核对提交主题；本版未移植 |
| Cindy | 32c7a59 | 桌面/界面 | fix(desktop): 删除任务级凭证授权时收回已恢复到执行器的授权 | 已核对提交主题；本版未移植 |
| Cindy | 3f4ec18 | 桌面/界面 | feat(input-handoff): 代输入——把需要主人填写的输入步骤交给主人 (#6009) | 已核对提交主题；本版未移植 |
| Cindy | 46f75dd | 移动/设备 | feat(mobile): 输入框顶边与聊天记录都能拖动调高，拖到底即收起键盘 (#5946) | 已核对提交主题；本版未移植 |
| Cindy | 53a01b8 | 其他能力/修复 | fix(plugins): 修复旧组织插件同版本来源凭据未恢复 | 已核对提交主题；本版未移植 |
| Cindy | e935254 | 交付/测试/维护 | Merge pull request #6043 from makecindy/feature/legacy-broker-recovery | 已核对提交主题；本版未移植 |
| Cindy | 69043b6 | 桌面/界面 | fix(desktop): Git 核实期间被取消的凭证请求不再进入确认排队 | 已核对提交主题；本版未移植 |
| Cindy | 3f6f933 | 桌面/界面 | fix(desktop): 权限档变化时释放旧确认卡占用的排队位置，确认卡说明补充计划模式 | 已核对提交主题；本版未移植 |
| Cindy | 3312cc6 | 其他能力/修复 | feat(plugins): $ 指令不再显示企业 slug，同名时企业版标「团队共享」 (#5960) | 已核对提交主题；本版未移植 |
| Cindy | ff385ab | 其他能力/修复 | fix(bridge): detect headerless SSE in non-stream fallback (#5991) | 已核对提交主题；本版未移植 |
| Cindy | 78d4c0a | 交付/测试/维护 | Merge origin/main into fix/shared-provider-concurrent-consent | 已核对提交主题；本版未移植 |
| Cindy | 3459eb6 | 交付/测试/维护 | Merge pull request #5988 from makecindy/fix/shared-provider-concurrent-consent | 已核对提交主题；本版未移植 |
| Cindy | 0b779c8 | 其他能力/修复 | feat(agent): Agent 可跨电脑管理定时任务、给其它电脑的任务发消息，工具索引写明作用范围 (#6008) | 已核对提交主题；本版未移植 |
| Cindy | 9f1ef57 | 其他能力/修复 | fix(mcps): call_tool 入口 args 改为可选，无参工具省略 args 不再被 -32602 拒收 (#6025) | 已核对提交主题；本版未移植 |
| Cindy | 133d532 | 桌面/界面 | fix(desktop): 暂停 Codex Micro 全局注入并清理遗留环境 (#5990) | 已核对提交主题；本版未移植 |
| Cindy | 779b523 | 桌面/界面 | feat(desktop): 供应商组先用快重置的配额，本机任务与外部任务同一套策略 (#6066) | 已核对提交主题；本版未移植 |
| Cindy | f2d51c6 | IM/消息 | feat(bots): 云端伙伴：同一个伙伴、主力电脑与换电脑继续 (#5899) | 已核对提交主题；本版未移植 |
| Cindy | d1fc07e | 交付/测试/维护 | ci: run client-ci for merge queue groups (#6089) | 已核对提交主题；本版未移植 |
| Cindy | 0bbf5b3 | 移动/设备 | fix(mobile): 修复新建任务失败后空白且无法恢复 (#6055) | 已核对提交主题；本版未移植 |
| Synara | 6098250 | 桌面/界面 | fix(browser): retain inactive tabs across switches (#1790) | 本地交互参考：隐藏预览时保留页面状态 |
| Synara | fa24045 | 桌面/界面 | fix(desktop): restore browser tabs after window replacement (#1904) | 本地交互参考：隐藏预览时保留页面状态 |
| Synara | f1ffd5d | 桌面/界面 | fix(web): count automations, not unresolved runs, in sidebar badge (#1026) | 已核对提交主题；本版未移植 |
| Synara | d36a31a | 其他能力/修复 | fix(computer): repair native targeting, delivery evidence and recovery (#1915) | 已核对提交主题；本版未移植 |
| Synara | 775b335 | 交付/测试/维护 | release: prepare Synara 1.0.4 Stable | 已核对提交主题；本版未移植 |
| Synara | f6ffa14 | 交付/测试/维护 | fix(release): retry interrupted Apple ticket checks | 已核对提交主题；本版未移植 |
| Synara | fb2e308 | 交付/测试/维护 | test: synchronize release regression checks with completed work | 已核对提交主题；本版未移植 |
| Synara | a62d7c7 | 交付/测试/维护 | test(web): await rendered transcript before final follow assertion | 已核对提交主题；本版未移植 |
| Synara | 9bba1d3 | 其他能力/修复 | fix(server): preserve Claude sessions across behavior-only option change (#1923) | 已核对提交主题；本版未移植 |
| Synara | 587083d | 模型/用量 | fix(web): offer to stop tasks when provider handoff is blocked (#1922) | 已核对提交主题；本版未移植 |
| Synara | 23662c8 | 其他能力/修复 | feat(connectors): connect remote MCP servers in Beta (#1921) | 已核对提交主题；本版未移植 |
| Synara | a3b1c85 | IM/消息 | fix(web): ignore stale timeline row size reports (#1927) | 已核对提交主题；本版未移植 |
| Synara | 76a9dac | 桌面/界面 | fix(web): remove subagent chats from the sidebar (#1926) | 已核对提交主题；本版未移植 |
| Synara | 427a420 | 桌面/界面 | feat(web): prioritize chats needing attention in Activity (#1929) | 已核对提交主题；本版未移植 |
| Synara | 74e0b36 | 移动/设备 | fix(device): iOS simulator input on Xcode 27, E2E agent tools, and all #1905 stability fixes (#1924) | 已核对提交主题；本版未移植 |
| Synara | 84a219b | 桌面/界面 | fix(browser): preserve composer focus during native hover (#1928) | 已核对提交主题；本版未移植 |
| Synara | b7f503f | 桌面/界面 | fix(browser): stop agent input from taking native focus (#1925) | 已核对提交主题；本版未移植 |
| Synara | 42fe8a7 | 桌面/界面 | Enable React and HTML chat visualizations in Stable (#1932) | 已核对提交主题；本版未移植 |
| Synara | dd18bd9 | IM/消息 | feat(web): animated ASCII background on the empty chat landing (#1930) | 已核对提交主题；本版未移植 |
| Synara | e571029 | 桌面/界面 | fix(server): resolve thread detail task state in one pass (#1917) | 已核对提交主题；本版未移植 |
| Synara | a21eb2b | 模型/用量 | fix(stats): stop double-counting Claude usage and split cache reads (#1931) | 已核对提交主题；本版未移植 |

真实微信账号、外部服务和跨设备验证以版本发行记录为准。
