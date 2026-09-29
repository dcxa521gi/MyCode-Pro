import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "../../../shared/i18n";
import {
  allModels,
  subscribeModels,
  getModelSnapshot,
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
  const [route, setRoute] = useState<Route>({
    ownerId: "",
    cwd: cwd ?? "",
    harness: models[0]?.harness ?? "pi",
    model: models[0]?.id ?? "",
  });
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
  return (
    <section className="space-y-5">
      <p className="text-sm leading-relaxed text-content/55">
        {t(
          "Bots connect directly from MyCode. Only your allowed user can start tasks. Tool approvals remain in the desktop app; keep MyCode running.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {channels.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setChannel(id);
              setCredentials({ service: "feishu" });
              setRoute(
                bots.find((b) => b.channel === id)?.route ?? {
                  ...route,
                  ownerId: "",
                },
              );
            }}
            className={`rounded-xl border px-4 py-3 text-sm ${channel === id ? "border-accent/40 bg-accent/10 text-accent" : "border-content/10 text-content/60"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <form
        className="space-y-4 rounded-2xl border border-content/10 bg-content/[0.02] p-5"
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
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.harness} · {m.name}
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
