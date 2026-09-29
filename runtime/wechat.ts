import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { TencentIlinkTransport } from "../vendor/cindy-wechat-ilink/src/transport";
import type { WechatCredentials } from "../vendor/cindy-wechat-ilink/src/types";

// Host-owned lifecycle and encrypted storage; all network calls go to Tencent.
export function createWechat(host: any) {
  let controller: AbortController | null = null;
  let status = "Disconnected";
  let qrImage: string | null = null;
  let verification: ((code: string) => void) | null = null;
  let client: TencentIlinkTransport | null = null;
  const contexts = new Map<string, string>();
  const seen = new Set<string>();
  const messages = new Set<(event: any) => void>();
  const changes = new Set<() => void>();
  const changed = (value: string) => {
    status = value;
    changes.forEach((fn) => fn());
  };
  const read = (): WechatCredentials | null => {
    try {
      return JSON.parse(host.secrets.read("wechat-credentials") || "null");
    } catch {
      return null;
    }
  };
  const make = (credentials?: WechatCredentials) =>
    new TencentIlinkTransport({
      baseUrl: credentials?.baseUrl ?? "https://ilinkai.weixin.qq.com",
      token: credentials?.token,
      botAgent: "MyCode/0.7.0",
      clientVersion: "0.7.0",
      fetch,
      localTokens: async () => {
        const saved = read();
        return saved ? [saved.token] : [];
      },
      authorizationObserver: {
        onEvent: async (event) => {
          if (event.status === "qr-refreshed")
            qrImage = await QRCode.toDataURL(event.challenge.qrCodeUrl, {
              width: 256,
              margin: 2,
            });
          changed(event.status);
        },
        requestVerificationCode: (_retry, signal) =>
          new Promise((resolve, reject) => {
            const aborted = () => {
              verification = null;
              reject(Error("Authorization cancelled"));
            };
            verification = (code) => {
              signal.removeEventListener("abort", aborted);
              verification = null;
              resolve(code);
            };
            signal.addEventListener("abort", aborted, { once: true });
            if (signal.aborted) aborted();
          }),
      },
    });
  const dispose = async () => {
    controller?.abort();
    controller = null;
    client = null;
    qrImage = null;
    verification = null;
    contexts.clear();
    changed("Disconnected");
  };
  const start = async () => {
    await dispose();
    const credentials = read();
    if (!credentials) throw Error("Scan the WeChat QR code first");
    const active = new AbortController();
    controller = active;
    client = make(credentials);
    const transport = client;
    changed("Connecting");
    // Never hold the JSON request queue while long-polling.
    void (async () => {
      try {
        await transport.notifyStart(active.signal);
        changed("Connected");
        let cursor = host.secrets.read("wechat-cursor") || "";
        while (!active.signal.aborted) {
          const batch = await transport.poll(cursor, active.signal);
          if (active.signal.aborted) return;
          for (const event of batch.messages) {
            if (
              event.senderId !== credentials.userId ||
              !event.text.trim() ||
              seen.has(event.messageId)
            )
              continue;
            if (seen.size >= 2000) seen.delete(seen.values().next().value!);
            seen.add(event.messageId);
            contexts.set(event.senderId, event.contextToken);
            messages.forEach((fn) =>
              fn({
                senderId: event.senderId,
                text: event.text,
                protectedContent: false,
              }),
            );
          }
          if (batch.cursor !== cursor) {
            cursor = batch.cursor;
            host.secrets.write("wechat-cursor", cursor);
          }
        }
      } catch {
        if (!active.signal.aborted) changed("Connection failed");
      }
    })();
  };
  const authorize = async () => {
    await dispose();
    const active = new AbortController();
    controller = active;
    const auth = make();
    const challenge = await auth.beginAuthorization(active.signal);
    if (active.signal.aborted) return;
    qrImage = await QRCode.toDataURL(challenge.qrCodeUrl, {
      width: 256,
      margin: 2,
    });
    changed("waiting");
    void auth
      .waitAuthorization(challenge, active.signal)
      .then((credentials) => {
        if (active.signal.aborted) return;
        host.secrets.write("wechat-credentials", JSON.stringify(credentials));
        host.secrets.remove("wechat-cursor");
        qrImage = null;
        changed("Authorized");
      })
      .catch(() => {
        if (!active.signal.aborted) {
          qrImage = null;
          changed("Authorization failed");
        }
      });
  };
  return {
    registerIpc() {},
    init: start,
    dispose,
    getStatus: () => ({ kind: status }),
    publicState: () => ({
      qrImage,
      verificationRequired: status === "verification-required",
      ownerId: read()?.userId ?? "",
    }),
    onStatusChange(fn: () => void) {
      changes.add(fn);
    },
    onMessage(fn: (event: any) => void) {
      messages.add(fn);
    },
    authorize,
    verify(code: string) {
      if (!verification || !/^\d{1,12}$/.test(code))
        throw Error("Invalid verification code");
      verification(code);
    },
    async sendText(peerId: string, text: string) {
      const contextToken = contexts.get(peerId);
      if (!client || !controller || !contextToken || peerId !== read()?.userId)
        throw Error("WeChat reply is no longer available");
      await client.sendMessage(
        { peerId, text, contextToken, clientId: randomUUID() },
        controller.signal,
      );
    },
  };
}
