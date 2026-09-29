import { createWechat } from "./wechat";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import {
  createFeishuIM,
  createDingTalkIM,
  createWecomIM,
  createTelegramIM,
  createDiscordIM,
  type IMHost,
  type IMMessageEvent,
} from "../vendor/cindy-im/src/index";

// Only this host protocol reaches stdout. SDK logs must never expose credentials.
const emit = (message: unknown) =>
  process.stdout.write(JSON.stringify(message) + "\n");
for (const method of ["log", "info", "warn", "error", "debug"] as const)
  console[method] = () => {};
const handlers = new Map<string, (payload?: unknown) => unknown>();
let secrets: Record<string, string> = {};
let channels: Record<
  string,
  | ReturnType<typeof createWechat>
  | ReturnType<typeof createTelegramIM>
  | ReturnType<typeof createFeishuIM>
  | ReturnType<typeof createDingTalkIM>
  | ReturnType<typeof createWecomIM>
  | ReturnType<typeof createDiscordIM>
> = {};
type Route = { cwd: string; harness: string; model: string; ownerId: string };
let routes: Record<string, Route> = {};
const running = new Set<string>();
const pending = new Map<
  string,
  { channel: string; event: IMMessageEvent; expires: number }
>();
const save = () => emit({ kind: "secrets", value: secrets });
const ownerKeys: Record<string, string> = {
  wechat: "wechat-owner-id",
  feishu: "feishu_bot_owner_open_id",
  dingtalk: "dingtalk-bot-owner-user-id",
  wecom: "wecom-owner-user-id",
  telegram: "telegram-owner-user-id",
  discord: "discord-owner-user-id",
};
function publicState() {
  return Object.keys(channels).map((channel) => ({
    channel,
    status: channels[channel].getStatus().kind,
    running: running.has(channel),
    route: routes[channel] ?? null,
    ...(channel === "wechat"
      ? (channels.wechat as ReturnType<typeof createWechat>).publicState()
      : {}),
  }));
}
function init(data: { secrets: Record<string, string>; directory: string }) {
  secrets = data.secrets;
  try {
    routes = JSON.parse(secrets.mycode_routes ?? "{}");
  } catch {
    routes = {};
  }
  const media = path.join(data.directory, "im-media");
  fs.mkdirSync(media, { recursive: true });
  const host: IMHost = {
    secrets: {
      read: (name) => secrets[name] ?? null,
      readResult: (name) =>
        name in secrets
          ? { kind: "value", value: secrets[name] }
          : { kind: "missing" },
      write: (name, value) => {
        secrets[name] = value;
        save();
        return true;
      },
      remove: (name) => {
        delete secrets[name];
        save();
      },
      isAvailable: () => true,
    },
    ipc: {
      handle: (name, handler) => {
        handlers.set(name, handler);
      },
      broadcast: () => emit({ kind: "status", value: publicState() }),
      throwIpcError: () => {
        throw Error("Invalid IM configuration");
      },
    },
    paths: {
      feishuMediaDir: media,
      discordMediaDir: media,
      telegramMediaDir: media,
      wecomMediaDir: media,
    },
    createLogger: () => ({
      trace() {},
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
    }),
    httpPostForm: async (url, body) => {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        ![
          "open.feishu.cn",
          "open.larksuite.com",
          "oapi.dingtalk.com",
          "api.dingtalk.com",
        ].includes(parsed.hostname)
      )
        throw Error("Unsupported IM endpoint");
      const response = await fetch(url, {
        method: "POST",
        body,
        redirect: "error",
      });
      return { status: response.status, body: await response.json() };
    },
  };
  channels = {
    wechat: createWechat(host),
    feishu: createFeishuIM(host),
    dingtalk: createDingTalkIM(host),
    wecom: createWecomIM(host),
    telegram: createTelegramIM(host, {
      ownerNoticeText: { online: "MyCode 已连接", offline: "MyCode 已断开" },
    }),
    discord: createDiscordIM(host, {
      ownerNoticeText: { online: "MyCode 已连接", offline: "MyCode 已断开" },
    }),
  };
  for (const [channel, transport] of Object.entries(channels)) {
    transport.registerIpc();
    transport.onStatusChange(() =>
      emit({ kind: "status", value: publicState() }),
    );
    transport.onMessage((event) => {
      const route = routes[channel];
      if (
        !route ||
        !running.has(channel) ||
        event.protectedContent ||
        !event.text.trim()
      )
        return;
      if (
        event.senderId !== route.ownerId &&
        event.speaker?.id !== route.ownerId
      )
        return;
      for (const [key, item] of pending)
        if (item.expires < Date.now()) pending.delete(key);
      if (pending.size >= 100) return;
      const receipt = randomUUID();
      pending.set(receipt, { channel, event, expires: Date.now() + 3600000 });
      emit({
        kind: "message",
        value: {
          receipt,
          channel,
          senderId: event.senderId,
          text: event.text.slice(0, 64000),
          route,
        },
      });
    });
  }
}
async function dispatch(input: any) {
  if (input.action === "bootstrap") {
    init(input);
    return publicState();
  }
  if (input.action === "status") return publicState();
  const channel = String(input.channel ?? "");
  const transport = channels[channel];
  if (!transport) throw Error("Unknown IM channel");
  if (channel === "wechat" && input.action === "wechat-authorize") {
    await (transport as ReturnType<typeof createWechat>).authorize();
    return publicState();
  }
  if (channel === "wechat" && input.action === "wechat-verify") {
    (transport as ReturnType<typeof createWechat>).verify(
      String(input.credentials?.code ?? ""),
    );
    return publicState();
  }
  if (input.action === "stop") {
    running.delete(channel);
    await transport.dispose();
    return publicState();
  }
  if (input.action === "start") {
    if (!routes[channel]) throw Error("Configure a bot first");
    running.add(channel);
    await transport.init();
    return publicState();
  }
  if (input.action === "configure") {
    const route = { ...input.route } as Route;
    if (channel === "wechat")
      route.ownerId = (
        transport as ReturnType<typeof createWechat>
      ).publicState().ownerId;
    if (!route?.ownerId?.trim() || !route.cwd || !route.harness || !route.model)
      throw Error("Owner, directory and model are required");
    routes[channel] = {
      ownerId: route.ownerId.trim(),
      cwd: route.cwd,
      harness: route.harness,
      model: route.model,
    };
    secrets.mycode_routes = JSON.stringify(routes);
    secrets[ownerKeys[channel]] = route.ownerId.trim();
    save();
    if (channel === "wechat") {
      running.add(channel);
      await transport.init();
      return publicState();
    }
    const commands: Record<string, string> = {
      feishu: "feishuBot:save",
      dingtalk: "dingtalkBot:save",
      wecom: "wecomBot:set-config",
      telegram: "telegramBot:set-config",
      discord: "discordBot:set-config",
    };
    const handler = handlers.get(commands[channel]);
    if (!handler) throw Error("IM setup is unavailable");
    running.add(channel);
    await handler({ ...input.credentials, ownerUserId: route.ownerId });
    // Some SDKs clear claimed owners when changing credentials. Restore the explicit allowlist.
    secrets[ownerKeys[channel]] = route.ownerId.trim();
    save();
    // These transports cache the owner in memory; reload the explicit allowlist after credential changes.
    if (channel === "wecom" || channel === "dingtalk") {
      await transport.dispose();
      await transport.init();
    }
    return publicState();
  }
  if (input.action === "reply") {
    const item = pending.get(input.receipt);
    if (!item || item.channel !== channel || !running.has(channel))
      throw Error("Reply is no longer available");
    await transport.sendText(
      item.event.senderId,
      String(input.text ?? "").slice(0, 30000),
    );
    pending.delete(input.receipt);
    return true;
  }
  throw Error("Unsupported IM action");
}
const lines = readline.createInterface({ input: process.stdin });
let queue = Promise.resolve();
lines.on("line", (line) => {
  queue = queue.then(async () => {
    let input: any;
    try {
      input = JSON.parse(line);
      const value = await dispatch(input);
      emit({ kind: "response", id: input.id, value });
    } catch {
      emit({
        kind: "response",
        id: input?.id,
        error:
          "IM operation failed. Check credentials, platform permissions and network access.",
      });
    }
  });
});
lines.on("close", () => {
  void Promise.allSettled(
    Object.values(channels).map((c) => c.dispose()),
  ).finally(() => process.exit(0));
});
