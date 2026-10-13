# MyCode 0.21.0

日期：2026-10-13。此版升级以 MonoCode 为主基线，保留 MyCode 品牌、模型路由、Windows、移动连接、中文/英文及原有数据兼容。群聊、Freebuff、旧重复 CLI 更新提示继续移除。

## 功能与修复

- 常驻智能体新增总览，将项目、会话、习惯、文档与可视内容组织在同一页面；设置改为弹窗，吉祥物和颜色改为浮层选择。
- 会话列表支持搜索、筛选、空状态、分页，习惯按天分组；切换智能体重置总览，启动时恢复最近打开的智能体。
- 文件变更集中显示，按仓库组织提交页签；展开变更可查看内联差异。子会话的查询、接受变更使用其自己的工作目录和 checkpoint，避免将子 worktree 错认成主会话。
- HTML 可视产物在隔离 iframe 中显示，外部链接须通过父页面按钮确认；文档、图片、视频采用相应预览入口。
- 用量控件复用到输入区；未使用上下文时不绘制进度圆点。保留 MyCode 自动压缩和缓存细节。
- 修复模型供应商重复点击无法收起、刷新后自行展开；支持鼠标和键盘，编辑、测试等子控件不触发展开切换，词元跳动与既有授权继续保留。
- 模型能力区分客户端协议与原生接口，保留输入/输出模态；音频专用模型不误放入聊天路由，显式用户覆盖不被发现结果覆盖。
- 后台原生 Claude 补充回复可沿原 IM 渠道通知；仅具有实际回复且成功完成的结果发布，原点身份更换或取消会撤销推送资格。运行中的后台回复拒绝重叠发送，防止旧结果结束新任务。
- Codex 已结束轮次的迟到事件不影响新轮次；空闲清理同时检查应用和原生代理实际活跃状态。
- 新增页面、操作、工具提示与反馈支持简体中文和英文，已保存错误可随语言切换重新显示。

## 上游来源

MonoCode：`889579b61c2342cc27751092ff0effbe9ec8e162` → `633730d70dd3e6cb8113af28c062dd1ea9228c0d`，26 提交，完整融合并保留合并祖先关系。

Cindy：`28afb1e98a01e5e1abfc86d9ec20483bec2dcf15` → `3ea90999d01fb7071c3e83a717fcdf404547ee24`，121 提交；Synara：`9e01962e0b1e8fec9fb0e17f17a64017bc4eaf94` → `b4bdc7362df83025fe30fb45b9599153a5e014a7`，29 提交。完整分类审阅并选择本地适用能力，**不宣称全部参考架构已迁入**。详见 [完整补充审阅清单](mycode-0.21.0-complements.md) 与 [150 提交 JSON](mycode-0.21.0-complements.json)。不加入 Cindy 云服务。

## MonoCode 逐提交融合清单

| 提交 | 上游变更 | 处置 |
| --- | --- | --- |
| 7c8badb | Move Mono mascot and color pickers into a popover | 已融合；行为与验证边界见本版记录 |
| ebd0745 | Rename Mono sessions panel and add settings dialog tests | 已融合；行为与验证边界见本版记录 |
| 35a4979 | Merge Mono details and sessions into an overview panel | 已融合；行为与验证边界见本版记录 |
| 9a8fe62 | Keep Mono session and habit lists from loading blank | 已融合；行为与验证边界见本版记录 |
| fc03409 | Move Mono name field under its mascot in settings | 已融合；行为与验证边界见本版记录 |
| fcb56cd | Keep Mono session and artifact cards from overflowing their container | 已融合；行为与验证边界见本版记录 |
| 62de674 | Show artifact cards as document icon with title | 已融合；行为与验证边界见本版记录 |
| 70eda81 | Extract usage chips into UsageChips and show them in Mono composer | 已融合；行为与验证边界见本版记录 |
| a3035df | Add session search, filters, and empty states to Mono overview | 已融合；行为与验证边界见本版记录 |
| 40c4246 | Group Mono habits by day state and page session cards | 已融合；行为与验证边界见本版记录 |
| 8f8ceee | Make Mono overview open by default and sidebar sessions opt-in | 已融合；行为与验证边界见本版记录 |
| 90ded7a | Widen default Mono sidebar width to 400px | 已融合；行为与验证边界见本版记录 |
| e43b380 | Reopen the last open Mono on launch | 已融合；行为与验证边界见本版记录 |
| 564316b | Show Mono session model as provider mark in card footer | 已融合；行为与验证边界见本版记录 |
| 5948a14 | Add per-repo commit tabs to the Mono changes view | 已融合；行为与验证边界见本版记录 |
| 8b70dc8 | Move Mono session changes into the overview's Changes tab | 已融合；行为与验证边界见本版记录 |
| 8dec243 | Show an empty context ring for new conversations | 已融合；行为与验证边界见本版记录 |
| 1088e0e | Dot the folded Changes tab icon when it has changes | 已融合；行为与验证边界见本版记录 |
| c30dbe1 | Hide handoff and second-opinion actions in Mono view | 已融合；行为与验证边界见本版记录 |
| d8cb37e | Open Mono artifacts in the overview documents tab | 已融合；行为与验证边界见本版记录 |
| 95320d0 | Synchronize session updates with React state | 已融合；行为与验证边界见本版记录 |
| ab2a6af | Add HTML visual artifacts rendered in a sandboxed frame | 已融合；行为与验证边界见本版记录 |
| 70fb3ea | Show local images and videos linked in Mono replies | 已融合；行为与验证边界见本版记录 |
| 649cead | Reset Mono overview state when switching to another Mono | 已融合；行为与验证边界见本版记录 |
| 9a9df5e | Open changed files in inline diff viewer | 已融合；行为与验证边界见本版记录 |
| 633730d | Release v0.13.0 | 已融合；行为与验证边界见本版记录 |

## 验证与交付

行为回归覆盖供应商鼠标/键盘折叠、刷新保持、模型协议/模态、后台回复所有权/取消/轮次隔离、子会话变更 scope、中英文反馈、HTML 外链确认。具体构建、全量测试、浏览器、原生和安装包结果在完成后追加，当前不得将计划标为通过。

真实供应商付费请求、真实 IM 账号推送、异地网络、真实设备及签名安装未作为模拟测试通过项。浏览器 HTML 验证不等于原生 WebView IPC 实机验证。Unix FIFO 回归仅在 Unix 执行，Windows 编译不能代替。

桌面发行页仅 MyCode 介绍、Windows 安装包及必要校验文件；Host 由源码构建到独立版本下载分支，不临时上传到桌面发行页。用户项目、凭据、会话及存储位置不迁移、不删除。
