import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
export type VoiceConfig = {
  endpoint: string;
  model: string;
  protocol?: string;
  commands: boolean;
  hasKey: boolean;
};
export function VoiceSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VoiceConfig>({
    endpoint: "http://127.0.0.1:8000/v1/audio/transcriptions",
    model: "whisper-1",
    commands: false,
    hasKey: false,
  });
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void invoke<VoiceConfig>("voice_config")
      .then((value) => {
        if (value.endpoint) setConfig(value);
      })
      .catch(() => setStatus("Could not load voice settings."));
  }, []);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void invoke("voice_save", { config, apiKey: key || null })
          .then(() => {
            setKey("");
            setStatus("Saved");
          })
          .catch((error) => setStatus(String(error)))
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-sm text-content/60">
        {t(
          "Record locally and transcribe with Xiaomi MiMo or your own speech service.",
        )}
      </p>
      <label className="block space-y-2 text-sm">
        <span>{t("Speech provider")}</span>
        <select
          className="w-full rounded-lg bg-surface px-3 py-2"
          value={config.protocol === "mimo" ? "mimo" : "transcription"}
          onChange={(event) => {
            const protocol = event.target.value;
            setConfig({
              ...config,
              protocol,
              hasKey: false,
              endpoint:
                protocol === "mimo"
                  ? "https://api.xiaomimimo.com/v1/chat/completions"
                  : "http://127.0.0.1:8000/v1/audio/transcriptions",
              model: protocol === "mimo" ? "mimo-v2.5-asr" : "whisper-1",
            });
            setKey("");
          }}
        >
          <option value="mimo">xiaomimimo API · MiMo-V2.5-ASR</option>
          <option value="transcription">
            {t("Local / OpenAI-compatible speech service")}
          </option>
        </select>
      </label>
      <p className="text-xs text-content/50">
        {t(
          "MiMo speech uses an API key for the API endpoint, not a Token Plan endpoint. Local speech requires a running transcription service; model weights are not bundled.",
        )}
      </p>
      {[
        ["endpoint", "Speech transcription endpoint"],
        ["model", "Speech model"],
      ].map(([field, label]) => (
        <label key={field} className="block space-y-2 text-sm">
          <span>{t(label)}</span>
          <input
            className="w-full rounded-lg bg-content/5 px-3 py-2"
            value={config[field as "endpoint" | "model"]}
            onChange={(event) =>
              setConfig({ ...config, [field]: event.target.value })
            }
            required
          />
        </label>
      ))}
      <label className="block space-y-2 text-sm">
        <span>{t("API Key")}</span>
        <input
          type="password"
          autoComplete="off"
          className="w-full rounded-lg bg-content/5 px-3 py-2"
          value={key}
          placeholder={t(
            config.hasKey
              ? "Key saved; leave blank to keep it"
              : "Optional for local services",
          )}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.commands}
          onChange={(event) =>
            setConfig({ ...config, commands: event.target.checked })
          }
        />
        {t("Enable voice commands")}
      </label>
      <p className="text-xs text-content/50">
        {t(
          "Commands: new task, open settings, office mode, development mode. Other speech is inserted as an editable draft and is never sent automatically.",
        )}
      </p>
      <p className="text-xs text-content/50">
        {t(
          "Use the microphone button or configure Voice input in Shortcuts. Recording stops after two minutes.",
        )}
      </p>
      <button
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-black disabled:opacity-40"
      >
        {t(busy ? "Saving…" : "Save")}
      </button>
      {status && (
        <p role="status" className="text-sm">
          {t(status)}
        </p>
      )}
    </form>
  );
}
