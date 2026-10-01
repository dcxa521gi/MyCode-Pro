# MyCode 0.14.0

## 范围与上游核对

- 2026-10-02 核对 MonoCode 最新 Release v0.6.0；main 为 `1e97594ddf6f40aa24671f7fa09f2048deb1d5eb`，与 0.13.0 已记录基线一致，无新增提交需要移植。
- 移除输入控件新增的橘色焦点轮廓，保留中性色键盘焦点反馈。
- 用量历史统一缓存计数口径、跨日日期归属、自动刷新和未上报数据提示，不用上下文占用伪造消费量。
- 服务商添加改为可搜索的分类卡片，补充有官方兼容接口的模板；保留手动模型、批量选择、TokenDance 和已有连接。
- 不改动已有凭据、数据库历史及数据位置。不恢复之前移除的 Windows 不兼容 CLI。

## 验收计划

- 用量聚合、跨天轮次、缓存去重和缺失数据回归；服务商选择与搜索验证。
- TypeScript、前端构建、Rust 检查及 Windows NSIS 安装包验证。
- 将源码、安装包与校验文件交付至 dcxa521gi/MyCode-Pro，提供本地绝对路径。

## 边界

- 旧记录中未上报的 Token 无法精确补造；失败或中断的请求可能没有统计。旧跨天轮次只能按完成日期归档，无法重建每天的消费明细。
- 新增模板不代表提供订阅额度；各服务使用各自账户密钥，实际权限与模型由账户决定。

## 新模板的官方来源

- Kimi 国际区：https://platform.kimi.ai/docs/guide/migrating-from-openai-to-kimi
- Qwen 国际区：https://help.aliyun.com/en/model-studio/base-url
- MiniMax 国际/中国：https://platform.minimax.io/docs/api-reference/text-openai-api ，https://platform.minimax.cn/docs/api-reference/text-openai-api
- StepFun：https://platform.stepfun.com/
- Z.ai：https://docs.z.ai/guides/capabilities/mcp-call
- Mistral：https://docs.mistral.ai/api/endpoint/models
- Together AI：https://docs.together.ai/docs/inference/openai-compatibility
- Fireworks：https://docs.fireworks.ai/tools-sdks/openai-compatibility
- AiHubMix：https://docs.aihubmix.com/en/clients/在%20avante.nvim%20中使用

共新增 10 个 API 模板，合计 27 个。截图中的专有 OAuth 订阅、AWS 签名认证以及未核实接口的第三方网关不伪装成普通 API Key 模板；可用 CLI 订阅从专门入口管理，其余可用兼容服务仍可通过自定义地址接入。

## 实现

- 输入控件使用中性灰边界，去除浅色/全局橘色 outline。
- 用量历史和侧边栏/服务商累计统一包含独立上报的缓存 Token；Codex 已含缓存的输入不重复相加。
- 用量附着到已发送轮次，跳过未发送草稿，防止草稿被统计排除时丢失真实用量。
- 用量上报时间随用户轮次保存；旧数据按 startedAt + durationMs 归档，无日期的仍留在全部时间。
- Pi 工具循环按助手消息累计，流式快照覆盖同一消息；OpenCode 增加 step-finish 用量来源，并与 message.updated 去重。
- 增加昨天筛选、自动刷新、未上报轮次数及缺失占比显示。

## 本地验证记录

- TypeScript 检查与相关前端回归通过；Rust 跨天统计和轮次归属回归通过，clippy 零警告。
- 浏览器自动化验证服务商搜索、分类、端点回填、中性焦点、浅色/深色弹窗以及用量刷新动效（原生请求使用模拟响应）。
- 未使用用户密钥进行付费调用；新模板的实际账号权限、余额和模型可用性需由对应账户验证。
- 安装包验证与全量 CI 结果以本版本 GitHub Release 记录为准。

- CI 附带修复：本地 HTML 预览读取完整 HTTP 请求头后再解析，兼容 TCP 分段，保留 8 KiB 大小与超时限制；增加分段/缺失/超长请求回归。
