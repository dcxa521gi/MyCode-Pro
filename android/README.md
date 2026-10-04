# MyCode 安卓控制端

版本 0.17.0。连接电脑执行任务，不在手机安装代理 CLI，也不向手机传递模型密钥。

电脑打开「设置 → 手机连接」，选择直连或远程中继，开启后在安卓端扫描二维码或粘贴配对信息。扫码需要摄像头权限，拒绝权限后仍可粘贴。配对码单次使用、十分钟有效，可在电脑刷新；可撤销单个设备或关闭全部连接。

直连使用可达的电脑地址，支持局域网或 VPN，防火墙需允许显示的端口；TLS 固定证书校验。远程连接通过自部署 HTTPS 中继跨网络使用，电脑主动连出，无需开放电脑端口；请求和响应使用 AES-256-GCM 端到端加密。部署方法见 [远程连接说明](../docs/remote-connection.md)。交付中继源代码不表示已部署公网服务。

已实现：按项目查看和搜索会话、加载较早消息、展开长消息、查看工具活动及任务计划、继续原会话、暂停任务、审批操作、回答有选项的澄清问题、搜索和切换电脑可用模型。空闲时才能切换模型，沿用原项目和权限规则。手机不保存供应商 API 密钥；Android Keystore 加密保存设备授权，禁用应用备份。前台自动刷新并保留会话草稿，历史仅在内存显示。

电脑需开机并运行 MyCode；手动休眠、关机和断网无法继续执行。关闭桌面连接或重启会撤销设备授权。尚不支持手机创建项目、文件编辑、群聊、无选项的自定义问答、计划审阅编辑及系统后台推送。真实手机摄像头和公网弱网行为需单独实机验收。

构建需要 JDK 17、Gradle 8.9、Android SDK 35。开发测试：`gradle -p android assembleDebug testDebugUnitTest lintDebug --no-daemon`。签名交付设置 `MYCODE_ANDROID_KEYSTORE_FILE` 和 `MYCODE_ANDROID_STORE_PASSWORD` 后运行 `assembleRelease testDebugUnitTest lintRelease`，输出 `android/app/build/outputs/apk/release/app-release.apk`。GitHub Actions 使用仓库加密凭据进行稳定 Release 签名；签名文件和密码不得提交源码。

0.16.0 为临时 Debug 签名，不能直接覆盖安装本次 Release 签名包；首次切换需要卸载旧安卓应用、安装新版并重新配对。不会修改电脑项目、会话、凭据或存储位置。此后使用相同 Release 签名升级。该签名不表示已通过应用商店审核。

二维码扫描使用 ZXing Android Embedded 4.3.0（Apache 2.0）。
