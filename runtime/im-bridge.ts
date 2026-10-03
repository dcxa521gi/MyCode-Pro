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
type ContinuedSession = {
  sessionId: string;
  cwd: string;
  harness: string;
  model: string;
  expires: number;
  ownerId: string;
  enabled: boolean;
  messages: string[];
  updated: number;
};
const continuations = new Map<string, ContinuedSession>();
let lastContinuationUpdate = 0;
function continuationTime() {
  lastContinuationUpdate = Math.max(Date.now(), lastContinuationUpdate + 1);
  return lastContinuationUpdate;
}
function persistContinuations() {
  secrets.mycode_continuations = JSON.stringify([...continuations]);
  save();
}
function quotedMessageId(event: IMMessageEvent): string | undefined {
  const raw = event.raw as Record<string, any> | undefined;
  const value =
    raw?.reply_to_message?.message_id ??
    raw?.reference?.messageId ??
    raw?.message?.parent_id ??
    event.replyThread?.rootMessageId;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}
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
  continuations.clear();
  try {
    const stored = JSON.parse(secrets.mycode_continuations ?? "[]");
    if (Array.isArray(stored))
      for (const entry of stored.slice(-500)) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, value] = entry;
        const channel = typeof key === "string" ? key.split(":")[0] : "";
        if (
          !value ||
          !routes[channel] ||
          value.ownerId !== routes[channel].ownerId ||
          value.expires < Date.now() ||
          typeof value.sessionId !== "string" ||
          !value.cwd ||
          !value.harness ||
          !value.model ||
          typeof value.updated !== "number" ||
          !Array.isArray(value.messages)
        )
          continue;
        continuations.set(key, value);
        lastContinuationUpdate = Math.max(
          lastContinuationUpdate,
          value.updated,
        );
      }
  } catch {
    /* Ignore malformed or obsolete bindings, preserving other secrets. */
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
      const command = event.text
        .trim()
        .match(/^\/continue\s+(\S+)\s+([\s\S]+)$/);
      const quoted = quotedMessageId(event);
      const quotedSession =
        event.replyContext?.text.match(/\/continue\s+(\S+)/)?.[1];
      const hasQuote = !!quoted || !!event.replyContext;
      const available = [...continuations.entries()].filter(
        ([key, item]) =>
          key.startsWith(`${channel}:`) && item.ownerId === route.ownerId,
      );
      const continuation = command
        ? continuations.get(`${channel}:${command[1]}`)
        : quotedSession
          ? continuations.get(`${channel}:${quotedSession}`)
          : quoted
            ? available.find(([, item]) => item.messages.includes(quoted))?.[1]
            : available.sort((a, b) => b[1].updated - a[1].updated)[0]?.[1];
      // A notification reply must never fall back into the bot's default project.
      if (
        (command || hasQuote || continuation) &&
        (!continuation ||
          continuation.ownerId !== route.ownerId ||
          continuation.expires < Date.now() ||
          !continuation.enabled)
      ) {
        void transport
          .sendText(
            event.senderId,
            "MyCode: continuation unavailable / 此会话未授权远程继续或已过期，请在会话设置中启用远程继续，或用 /continue 指定已授权的会话。",
          )
          .catch(() => {});
        return;
      }
      if (continuation) {
        continuation.updated = continuationTime();
        persistContinuations();
      }
      pending.set(receipt, { channel, event, expires: Date.now() + 3600000 });
      emit({
        kind: "message",
        value: {
          receipt,
          channel,
          senderId: event.senderId,
          text: (command ? command[2] : event.text).slice(0, 64000),
          ...(continuation ? { sessionId: continuation.sessionId } : {}),
          route: continuation
            ? {
                ...route,
                cwd: continuation.cwd,
                harness: continuation.harness,
                model: continuation.model,
              }
            : route,
        },
      });
    });
  }
}
async function dispatch(input: any) {
  if (input.action === "bootstrap") {
    init(input);
    let saved: string[] = [];
    try {
      saved = JSON.parse(secrets.mycode_running ?? "[]");
    } catch {}
    if (Array.isArray(saved))
      for (const channel of saved)
        if (channels[channel] && routes[channel]) {
          running.add(channel);
          try {
            await channels[channel].init();
          } catch {
            running.delete(channel);
          }
        }
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
    for (const key of continuations.keys())
      if (key.startsWith(`${channel}:`)) continuations.delete(key);
    persistContinuations();
    await transport.dispose();
    secrets.mycode_running = JSON.stringify([...running]);
    save();
    return publicState();
  }
  if (input.action === "start") {
    if (!routes[channel]) throw Error("Configure a bot first");
    running.add(channel);
    try {
      await transport.init();
    } catch (error) {
      running.delete(channel);
      throw error;
    }
    secrets.mycode_running = JSON.stringify([...running]);
    save();
    return publicState();
  }
  if (input.action === "configure") {
    for (const key of continuations.keys())
      if (key.startsWith(`${channel}:`)) continuations.delete(key);
    persistContinuations();
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
      secrets.mycode_running = JSON.stringify([...running]);
      save();
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
    secrets.mycode_running = JSON.stringify([...running]);
    save();
    return publicState();
  }
  if (input.action === "reply") {
    const item = pending.get(input.receipt);
    if (
      !item ||
      item.expires < Date.now() ||
      item.channel !== channel ||
      !running.has(channel)
    )
      throw Error("Reply is no longer available");
    await transport.sendText(
      item.event.senderId,
      String(input.text ?? "").slice(0, 30000),
    );
    pending.delete(input.receipt);
    return true;
  }
  if (input.action === "notify") {
    const route = routes[channel];
    if (!route || !running.has(channel))
      throw Error("Connect this bot before sending notifications");
    const session = input.session;
    if (
      !session ||
      typeof session.id !== "string" ||
      !session.id ||
      typeof session.cwd !== "string" ||
      typeof session.harness !== "string" ||
      typeof session.model !== "string"
    )
      throw Error("Invalid notified session");
    for (const [key, item] of continuations)
      if (item.expires < Date.now()) continuations.delete(key);
    const sent = await transport.sendText(
      route.ownerId,
      String(input.text ?? "").slice(0, 30000),
    );
    if (
      continuations.has(`${channel}:${session.id}`) ||
      continuations.size < 500
    ) {
      const previous = continuations.get(`${channel}:${session.id}`);
      continuations.set(`${channel}:${session.id}`, {
        sessionId: session.id,
        cwd: session.cwd,
        harness: session.harness,
        model: session.model,
        ownerId: route.ownerId,
        enabled: input.remoteContinue === true,
        messages: [
          ...(previous?.messages ?? []),
          ...(sent?.messageId ? [String(sent.messageId)] : []),
        ].slice(-32),
        updated: continuationTime(),
        expires: Date.now() + 7 * 24 * 3600000,
      });
      persistContinuations();
    }
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
