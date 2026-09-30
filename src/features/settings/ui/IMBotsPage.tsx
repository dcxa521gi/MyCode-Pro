import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "../../../shared/i18n";
import {
  allModels,
  subscribeModels,
  getModelSnapshot,
  defaultSessionChoice,
} from "../../sessions/model/models";
const channels = [
  ["wechat", "WeChat"],
  ["feishu", "Feishu / Lark"],
  ["dingtalk", "DingTalk"],
  ["wecom", "WeCom"],
  ["telegram", "Telegram"],
  ["discord", "Discord"],
] as const;
type Route = { ownerId: string; cwd: string; harness: string; model: string };
type Bot = {
  channel: string;
  qrImage?: string;
  verificationRequired?: boolean;
  ownerId?: string;
  status: string;
  running: boolean;
  route: Route | null;
};
const inputClass =
  "w-full rounded-lg border border-content/15 bg-content/[0.025] px-3 py-2 text-sm outline-none focus:border-accent";
export function IMBotsPage({ cwd }: { cwd?: string }) {
  const { t } = useTranslation();
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  const models = allModels();
  const [bots, setBots] = useState<Bot[]>([]);
  const [channel, setChannel] = useState("feishu");
  const [route, setRoute] = useState<Route>(() => ({
    ownerId: "",
    cwd: cwd ?? "",
    ...defaultSessionChoice(cwd),
  }));
  const [credentials, setCredentials] = useState<Record<string, string>>({
    service: "feishu",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await invoke<Bot[]>("im_bridge_request", {
        request: { action, channel, route, credentials },
      });
      setBots(Array.isArray(result) ? result : []);
      if (action === "status") {
        const saved = result?.find((b) => b.channel === channel)?.route;
        if (saved) setRoute(saved);
      }
      if (action === "configure") setCredentials({ service: "feishu" });
    } catch {
      setError(
        t(
          "IM operation failed. Check credentials, platform permissions and network access.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void request("status");
    let disposed = false;
    let stop: (() => void) | undefined;
    let stopError: (() => void) | undefined;
    void listen("mycode-im-error", () =>
      setError(
        t(
          "Could not save IM credentials. Reconnect after checking disk access.",
        ),
      ),
    )
      .then((fn) => {
        if (disposed) fn();
        else stopError = fn;
      })
      .catch(() => {});
    void listen<Bot[]>("mycode-im-status", (e) => setBots(e.payload))
      .then((fn) => {
        if (disposed) fn();
        else stop = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stop?.();
      stopError?.();
    };
  }, []);
  const current = bots.find((b) => b.channel === channel);
  const fields =
    channel === "wechat"
      ? []
      : channel === "feishu"
        ? [
            ["appId", "App ID"],
            ["appSecret", "App secret"],
          ]
        : channel === "dingtalk"
          ? [
              ["appKey", "App key"],
              ["appSecret", "App secret"],
            ]
          : channel === "wecom"
            ? [
                ["botId", "Bot ID"],
                ["secret", "Bot secret"],
              ]
            : [["token", "Bot token"]];
  const channelForm = (
    <form
      className="space-y-4 px-5 pb-5 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        void request("configure");
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          {t(channels.find((c) => c[0] === channel)?.[1] ?? channel)}
        </h2>
        <span className="rounded-full bg-content/5 px-3 py-1 text-xs">
          {t(current?.status ?? "Disconnected")}
        </span>
      </div>
      {channel === "wechat" && (
        <div className="space-y-3">
          <p className="text-sm text-content/65">
            {t(
              "Scan with WeChat to authorize a local connection. The authorized account is the only allowed sender.",
            )}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void request("wechat-authorize")}
            className="rounded-lg border border-content/20 px-3 py-2"
          >
            {t("Show WeChat QR code")}
          </button>
          {current?.qrImage && (
            <img
              src={current.qrImage}
              alt={t("WeChat authorization QR code")}
              width={256}
              height={256}
              className="rounded-xl"
            />
          )}
          {current?.verificationRequired && (
            <div className="flex gap-2">
              <input
                aria-label={t("Verification code")}
                className={inputClass}
                value={credentials.code ?? ""}
                onChange={(e) => setCredentials({ code: e.target.value })}
              />
              <button
                type="button"
                onClick={() => void request("wechat-verify")}
              >
                {t("Confirm")}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={`${channel}-${key}`} className="grid gap-1 text-xs">
            {t(label)}
            <input
              aria-label={t(label)}
              className={inputClass}
              required
              type={/secret|token/i.test(key) ? "password" : "text"}
              autoComplete="off"
              value={credentials[key] ?? ""}
              onChange={(e) =>
                setCredentials({ ...credentials, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <label className="grid gap-1 text-xs">
          {t("Allowed user ID")}
          <input
            required
            className={inputClass}
            readOnly={channel === "wechat"}
            value={
              channel === "wechat" ? (current?.ownerId ?? "") : route.ownerId
            }
            onChange={(e) => setRoute({ ...route, ownerId: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs">
          {t("Working directory")}
          <input
            required
            className={inputClass}
            value={route.cwd}
            onChange={(e) => setRoute({ ...route, cwd: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs">
          {t("Agent and model")}
          <select
            required
            className={inputClass}
            value={route.model}
            onChange={(e) => {
              const model = models.find((m) => m.id === e.target.value);
              if (model)
                setRoute({
                  ...route,
                  model: model.id,
                  harness: model.harness,
                });
            }}
          >
            {!models.some((model) => model.id === route.model) && (
              <option value={route.model}>
                {route.harness} ·{" "}
                {t(
                  route.model.endsWith(":default")
                    ? "CLI default"
                    : "Saved model",
                )}
              </option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.harness} · {t(m.name)}
              </option>
            ))}
          </select>
        </label>
        {channel === "feishu" && (
          <label className="grid gap-1 text-xs">
            {t("Service region")}
            <select
              className={inputClass}
              value={credentials.service ?? "feishu"}
              onChange={(e) =>
                setCredentials({ ...credentials, service: e.target.value })
              }
            >
              <option value="feishu">飞书</option>
              <option value="lark">Lark</option>
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-3">
        <button
          disabled={busy}
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm text-black disabled:opacity-40"
        >
          {t(busy ? "Working…" : "Save and connect")}
        </button>
        <button
          disabled={busy || !current?.route}
          type="button"
          onClick={() => void request(current?.running ? "stop" : "start")}
        >
          {t(current?.running ? "Disconnect" : "Connect saved bot")}
        </button>
      </div>
    </form>
  );
  return (
    <section className="space-y-5">
      <p className="text-sm leading-relaxed text-content/55">
        {t(
          "Bots connect directly from MyCode. Only your allowed user can start tasks. Tool approvals remain in the desktop app; keep MyCode running.",
        )}
      </p>
      <div className="space-y-3" aria-label={t("IM bots")}>
        {channels.map(([id, label]) => {
          const bot = bots.find((b) => b.channel === id);
          return (
            <section
              key={id}
              className="overflow-hidden rounded-2xl bg-content/[0.035]"
            >
              <button
                aria-expanded={channel === id}
                disabled={busy}
                className={`flex w-full items-center gap-3 rounded-xl p-4 text-left text-sm ${channel === id ? "bg-accent/10 text-accent" : "bg-content/5 hover:bg-content/10"}`}
                onClick={() => {
                  setChannel(id);
                  setError("");
                  setCredentials({ service: "feishu" });
                  setRoute(
                    bot?.route ?? {
                      ownerId: "",
                      cwd: cwd ?? "",
                      ...defaultSessionChoice(cwd),
                    },
                  );
                }}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${bot?.running ? "bg-emerald-500" : "bg-content/20"}`}
                />
                <span className="min-w-0">
                  <strong className="block">{t(label)}</strong>
                  <span className="mt-1 block text-xs text-content/50">
                    {t(bot?.status || "Disconnected")}
                  </span>
                </span>
              </button>
              {channel === id ? channelForm : null}
            </section>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <p className="text-xs text-content/45">
        {t(
          "Text conversations are supported. Credentials stay on this computer. Protected messages are not imported; attachments and remote approval cards are not enabled.",
        )}
      </p>
    </section>
  );
}
