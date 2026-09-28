import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { refreshPiCatalog } from "../../../integrations/harness/providers/pi/piCatalog";
import {
  CONNECTION_PRESETS,
  loadLocalAIConfig,
  type ModelConnection,
} from "../model/modelConnections";

const inputClass =
  "w-full rounded-lg border border-content/15 bg-content/5 px-3 py-2 text-sm outline-none focus:border-accent";
const empty = (): ModelConnection => ({
  id: crypto.randomUUID(),
  name: "",
  baseUrl: "",
  api: "openai-completions",
  models: [],
  enabled: true,
  hasKey: false,
});

export function ModelConnections() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ModelConnection[]>([]);
  const [draft, setDraft] = useState<ModelConnection | null>(null);
  const [key, setKey] = useState("");
  const [modelText, setModelText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = async () => setItems((await loadLocalAIConfig()).connections);
  useEffect(() => {
    void reload().catch((e) => setStatus(String(e)));
  }, []);
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    try {
      await work();
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };
  const edit = (connection: ModelConnection) => {
    setDraft(connection);
    setModelText(connection.models.join("\n"));
    setKey("");
    setStatus("");
  };
  return (
    <section
      className="mb-8 rounded-xl border border-content/10 bg-content/[0.02] p-5"
      aria-label={t("Model connections")}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{t("Model connections")}</h2>
        <SecondaryButton disabled={busy} onClick={() => edit(empty())}>
          {t("Add connection")}
        </SecondaryButton>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-content/55">
        {t(
          "Connect your own API or local model through Pi. Install Pi below, then select its models in a new conversation. No Cindy account is required.",
        )}
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-3 border-t border-content/10 py-3 text-sm"
        >
          <span className="min-w-0 flex-1">
            <strong>{item.name}</strong>
            <span className="ml-2 text-xs text-content/50">
              {item.models.join(", ")}
            </span>
          </span>
          <SecondaryButton
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const count = await invoke<number>("local_ai_test_connection", {
                  id: item.id,
                });
                setStatus(
                  `${t("Connection succeeded. Models returned:")} ${count}`,
                );
              })
            }
          >
            {t("Test connection")}
          </SecondaryButton>
          <SecondaryButton disabled={busy} onClick={() => edit(item)}>
            {t("Edit")}
          </SecondaryButton>
          <SecondaryButton
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await invoke("local_ai_remove_connection", { id: item.id });
                await reload();
                await refreshPiCatalog();
              })
            }
          >
            {t("Remove")}
          </SecondaryButton>
        </div>
      ))}
      {draft && (
        <form
          className="mt-4 grid gap-3 rounded-lg border border-content/10 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              await invoke("local_ai_save_connection", {
                connection: {
                  ...draft,
                  models: modelText
                    .split(/[\n,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                apiKey: key || (draft.hasKey ? null : ""),
              });
              setKey("");
              setDraft(null);
              await reload();
              await refreshPiCatalog();
              setStatus(
                "Connection saved. Start a new conversation to use it.",
              );
            });
          }}
        >
          <label className="grid gap-1 text-xs">
            {t("Provider template")}
            <select
              aria-label={t("Provider template")}
              className={inputClass}
              defaultValue=""
              onChange={(e) => {
                const preset = CONNECTION_PRESETS[Number(e.target.value)];
                setDraft({ ...draft, ...preset });
              }}
            >
              <option value="" disabled>
                {t("Choose a provider")}
              </option>
              {CONNECTION_PRESETS.map((p, i) => (
                <option key={p.name} value={i}>
                  {t(p.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            {t("Name")}
            <input
              aria-label={t("Name")}
              required
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            {t("API base URL")}
            <input
              aria-label={t("API base URL")}
              required
              type="url"
              className={inputClass}
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            {t("API protocol")}
            <select
              aria-label={t("API protocol")}
              className={inputClass}
              value={draft.api}
              onChange={(e) => setDraft({ ...draft, api: e.target.value })}
            >
              <option value="openai-completions">
                {t("OpenAI Chat Completions")}
              </option>
              <option value="openai-responses">{t("OpenAI Responses")}</option>
              <option value="anthropic-messages">
                {t("Anthropic Messages")}
              </option>
              <option value="google-generative-ai">
                {t("Google Generative AI")}
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            {t("API key")}
            <input
              aria-label={t("API key")}
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={key}
              placeholder={t(
                draft.hasKey
                  ? "Leave blank to keep the saved key"
                  : "Optional for local models",
              )}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            {t("Model IDs, one per line")}
            <textarea
              aria-label={t("Model IDs, one per line")}
              required
              rows={3}
              className={inputClass}
              value={modelText}
              onChange={(e) => setModelText(e.target.value)}
            />
          </label>
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft({ ...draft, enabled: e.target.checked })
              }
            />
            {t("Enabled")}
          </label>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
              disabled={busy}
              type="submit"
            >
              {t(busy ? "Saving…" : "Save")}
            </button>
            <SecondaryButton
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setKey("");
              }}
            >
              {t("Cancel")}
            </SecondaryButton>
          </div>
        </form>
      )}
      {status && (
        <p role="status" className="mt-3 text-sm text-content/70">
          {t(status)}
        </p>
      )}
    </section>
  );
}
