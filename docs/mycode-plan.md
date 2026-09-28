# MyCode 本地能力整合计划

## 产品边界

- 以 MonoCode 的 Tauri / React / Rust 架构和视觉风格为基础，兼顾编程和通用办公。
- 仅研究、整合 Cindy 已开源且可以本地运行的能力；不接入 Cindy 云服务、账号系统、远程目录或未开源后端。
- 用户自己配置的大模型 API 与本地模型属于可选连接，不依赖 Cindy。
- 保留已有项目、会话和偏好；不覆盖正在运行的官方 MonoCode 安装。

## 实施与验收

1. 完整梳理界面标签、提示、动态状态和原生对话框的中英文切换；技术标识、用户内容和模型专名不翻译。
2. 将模型厂商连接与执行引擎区分，提供国内外厂商和本地端点配置，验证配置确实进入执行链路。
3. 整合本地记忆、MCP、技能和自动化入口与配置；复用现有执行机制，避免只有展示的功能。
4. 关于页面从自有 GitHub Releases 获取版本和更新内容，处理网络错误与版本比较。
5. 完成 MyCode 名称、图标、仓库和发布地址迁移；保留数据兼容键。
6. 执行前端、Rust、语言切换、连接配置及 Windows 安装包检查，再发布源码和安装包。

## Cindy 参考边界

参考仓库：https://github.com/makecindy/cindy （Apache-2.0）。

本地可参考模块包括 model-providers（离线预设）、project-context（项目知识）、maker-scheduler（本地调度）、lizi-mcps（MCP 集成）、browser-control-runtime（本地浏览器执行）。

排除 auth-client、device-link 的云端发现与账号关联、heartbeat-client，以及在线下发目录和云端服务。若移植源代码，保留相应许可证和署名；架构不兼容部分在现有 Tauri 边界内实现。

0.5.0 已完成的功能及实际边界见 [本地能力说明](mycode-local-features.md)。浏览器交互检查使用模拟原生接口；真实服务商账号、完整安装流程及用户设备上的运行仍需分别验收，不能由构建成功替代。
