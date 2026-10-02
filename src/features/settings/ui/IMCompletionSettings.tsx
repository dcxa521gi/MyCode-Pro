import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import {
  IM_CHANNELS,
  loadIMCompletion,
  saveIMCompletion,
} from "../model/imCompletion";
export function IMCompletionSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadIMCompletion);
  const [connected, setConnected] = useState<string[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    void invoke<{ channel: string; route: unknown }[]>("im_bridge_request", {
      request: { action: "status" },
    })
      .then((b) => setConnected(b.filter((c) => c.route).map((c) => c.channel)))
      .catch(() => setError(true));
  }, []);
  const save = (next: typeof settings) => {
    setSettings(next);
    saveIMCompletion(next);
  };
  return (
    <section className="rounded-xl border border-content/10 bg-content/[0.025] p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">{t("Task completion channels")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-content/55">
          {t(
            "Choose configured IM bots to receive project names and completed turn summaries. MyCode must remain running. No notification is sent until enabled.",
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {IM_CHANNELS.map((c) => (
          <label
            key={c}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${settings.channels.includes(c) ? "border-content/25 bg-selection" : "border-content/10"}`}
          >
            <input
              type="checkbox"
              disabled={!connected.includes(c) && !settings.channels.includes(c)}
              checked={settings.channels.includes(c)}
              onChange={(e) =>
                save({
                  ...settings,
                  channels: e.target.checked
                    ? [...settings.channels, c]
                    : settings.channels.filter((id) => id !== c),
                })
              }
            />
            {t(
              (
                {
                  wechat: "WeChat",
                  feishu: "Feishu / Lark",
                  dingtalk: "DingTalk",
                  wecom: "WeCom",
                  telegram: "Telegram",
                  discord: "Discord",
                } as Record<string, string>
              )[c],
            )}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={settings.remoteContinue}
          onChange={(e) =>
            save({ ...settings, remoteContinue: e.target.checked })
          }
        />
        {t("Allow remote continuation of notified sessions")}
      </label>
      <p className="text-xs leading-relaxed text-content/45">
        {t(
          "Only the configured allowed user can continue a notified session using /continue and its session ID. Tool approvals still require the desktop app.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {t("Could not load IM channels. Configure a bot in IM bots first.")}
        </p>
      )}
    </section>
  );
}
