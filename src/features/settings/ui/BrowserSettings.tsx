import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
type Config = { enabled: boolean; installed: boolean };
export function BrowserSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Config>({
    enabled: false,
    installed: false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void invoke<Config>("browser_config")
      .then((c) => {
        if (c) setConfig(c);
      })
      .catch((e) => setError(String(e)));
  }, []);
  const run = async (install: boolean, enabled = false) => {
    setBusy(true);
    setError("");
    try {
      setConfig(
        await invoke<Config>(
          install ? "browser_install" : "browser_save",
          install ? {} : { enabled },
        ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 py-5">
      <h3 className="font-semibold">{t("Headless browser")}</h3>
      <p className="text-sm text-content/60">
        {t(
          "Local Playwright and Chromium let compatible agents browse pages, click, fill forms and take screenshots. Each session uses an isolated browser without your personal browser cookies.",
        )}
      </p>
      <button
        disabled={busy}
        className="rounded-lg bg-content/10 px-4 py-2 text-sm"
        onClick={() => void run(true)}
      >
        {t(config.installed ? "Update browser" : "Install headless browser")}
      </button>
      {busy && <progress className="w-full" aria-label={t("Installing…")} />}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={busy || !config.installed}
          onChange={(e) => void run(false, e.target.checked)}
        />
        {t("Enable headless browser")}
      </label>
      <p className="text-xs text-content/50">
        {t(
          "Available through MCP in new Claude, Codex, OpenCode and MiMo Code tasks. Agent tool approval settings still apply. Disabling closes the browser connection.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {t(error)}
        </p>
      )}
    </section>
  );
}
