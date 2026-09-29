# MyCode 0.8.1

侧边栏“新建任务”与“项目 +”使用同一项目选择入口；工作区加号直接新建当前项目会话，继承代理、模型和账号，不再弹出向导。首次点击 LOGO 返回首页，继续点击依次进入运行中的会话。用量历史移除缓存命中率，输入框上下文圆环保留。

## 模型与 CLI 排障

- 修复缺少远程密钥时发送 `local` 占位符的问题。旧连接若显示“未保存 API 密钥”，请编辑并重新保存；不会读取或复用其他服务商的密钥。
- Pi、OpenCode、MiMo Code 支持模型连接；Claude 支持 Anthropic Messages；Codex 支持 OpenAI Responses。小米 API 和 Token Plan 在 Claude 下自动使用同一主机的 `/anthropic` 路径，保留原账户及计费方案。
- OpenCode 和 MiMo Code 的主模型、辅助模型绑定所选服务商，避免辅助请求走全局配置中的其他账户。Claude 自定义连接移除冲突的 OAuth / 云平台选择，并配置辅助模型。
- 官方模型仍需对应 CLI 的有效登录或 API 密钥及额度。OpenRouter `Insufficient credits` 是上游余额问题；Claude `Not logged in` 需要对应账户登录。Codex 订阅不能共享给其他 CLI。MyCode 会显示对应处理建议并保留原始错误。
- 不支持自定义接口的 CLI 使用其自身的官方模型目录，不把 OpenAI Chat Completions 冒充 Responses 或 Anthropic 协议。

## 语音

小米语音在设置 → 语音输入选择 **xiaomimimo API**，填写普通 API 密钥，模型 `mimo-v2.5-asr`，完整地址 `https://api.xiaomimimo.com/v1/chat/completions`。Token Plan 地址不能直接用于语音识别；不会把已有 Token Plan 密钥自动发送到其他主机。旧普通 API 配置自动补齐语音协议及路径。

也可使用已运行的本地 OpenAI 兼容语音服务，完整接口路径通常为 `/v1/audio/transcriptions`。错误信息完整展示，区分认证、地址、请求格式、额度和服务不可用。

## 图标来源

- 小米 MiMo：[官方网站 favicon](https://mimo.mi.com/favicon.png)。
- ZCode：[官方仓库桌面图标](https://github.com/zai-org/ZCode/blob/main/packages/desktop/build/icon.png)。

参考协议：[小米 Token Plan](https://mimo.mi.com/docs/tokenplan/subscription)、[小米语音识别](https://mimo.mi.com/docs/zh-CN/api/audio/Speech-Recognition)。图标归各自权利人所有，仅用于标识对应代理。
