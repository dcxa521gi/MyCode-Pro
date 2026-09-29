import { useEffect, useState } from "react";
import { BrowserSettings } from "./BrowserSettings";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "../../../shared/i18n";
type Config = { enabled: boolean; binary: string; generation: string };
export function ComputerControlStop() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    void invoke<Config>("computer_config")
      .then((value) => {
        if (live) setConfig(value);
      })
      .catch(() => {});
    void listen<Config>("mycode-computer-status", (event) =>
      setConfig(event.payload),
    )
      .then((unlisten) => {
        if (live) stop = unlisten;
        else unlisten();
      })
      .catch(() => {});
    return () => {
      live = false;
      stop?.();
    };
  }, []);
  if (!config?.enabled) return null;
  return (
    <div className="px-2 pb-2">
      <button
        className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400"
        onClick={() =>
          void invoke<Config>("computer_save", {
            enabled: false,
            binary: config.binary,
          })
            .then((value) => {
              if (value) setConfig(value);
            })
            .catch(() => setError("Could not stop computer control."))
        }
      >
        {t("Stop computer control")}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {t(error)}
        </p>
      )}
    </div>
  );
}
export function ComputerSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Config>({
    enabled: false,
    binary: "",
    generation: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    void invoke<Config>("computer_config")
      .then((value) => {
        if (value) setConfig(value);
      })
      .catch(() => setStatus("Could not load computer settings."));
  }, []);
  const run = async (operation: () => Promise<Config>) => {
    setBusy(true);
    setStatus("");
    try {
      setConfig(await operation());
      setStatus("Saved");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5">
      <BrowserSettings />
      <p className="text-sm text-content/60">
        {t(
          "Let compatible agents observe windows, click, type and operate local apps with the open-source Cua Driver. Runs locally with MyCode.",
        )}
      </p>
      <p className="text-sm text-content/60">
        {t(
          "Supported agents: Claude, Codex, OpenCode and MiMo Code. Enable first, then start a new task. The selected agent and model perform the work.",
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-content/10 px-4 py-2 text-sm disabled:opacity-40"
          onClick={() => void run(() => invoke<Config>("computer_install"))}
        >
          {t(busy ? "Working…" : "Install local driver")}
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void open({
              multiple: false,
              directory: false,
              title: t("Select Cua Driver"),
            })
              .then((path) => {
                if (typeof path === "string")
                  void run(() =>
                    invoke<Config>("computer_save", {
                      enabled: false,
                      binary: path,
                    }),
                  );
              })
              .catch((error) => setStatus(String(error)))
          }
        >
          {t("Select installed driver")}
        </button>
      </div>
      <p className="break-all text-xs text-content/50">
        {config.binary || t("Not installed")}
      </p>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={busy || !config.binary}
          onChange={(event) =>
            void run(() =>
              invoke<Config>("computer_save", {
                enabled: event.target.checked,
                binary: config.binary,
              }),
            )
          }
        />
        {t("Enable computer control")}
      </label>
      <p className="text-xs text-content/50">
        {t(
          "Screenshots and window content may be sent to your selected model. Turning this off stops MyCode driver processes and blocks further actions; completed actions are not undone.",
        )}
      </p>
      <button
        disabled={busy || !config.enabled}
        className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400 disabled:opacity-40"
        onClick={() =>
          void run(() =>
            invoke<Config>("computer_save", {
              enabled: false,
              binary: config.binary,
            }),
          )
        }
      >
        {t("Stop computer control")}
      </button>
      {status && (
        <p role="status" className="text-sm">
          {t(status)}
        </p>
      )}
    </section>
  );
}
