import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { refreshPiCatalog } from "../../../integrations/harness/providers/pi/piCatalog";
import {
  CONNECTION_PRESETS,
  loadLocalAIConfig,
  type ModelConnection,
  type ModelMetadata,
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
  const [authorization, setAuthorization] = useState("");
  const [code, setCode] = useState("");
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  useEffect(() => {
    if (
      !draft?.baseUrl ||
      (!key &&
        !draft.hasKey &&
        !draft.baseUrl.startsWith("https://tokendance.space/") &&
        !/^http:\/\/(127\.0\.0\.1|localhost)/.test(draft.baseUrl))
    )
      return;
    let active = true;
    const timer = setTimeout(() => {
      setDiscovering(true);
      setStatus("");
      void invoke<Record<string, ModelMetadata>>("local_ai_discover_models", {
        connection: draft,
        apiKey: key || (draft.hasKey ? null : ""),
      })
        .then((metadata) => {
          const models = Object.keys(metadata);
          if (active) {
            setDraft((current) =>
              current ? { ...current, modelMetadata: metadata } : current,
            );
            setDiscovered(models);
            setModelText((current) =>
              current.trim() ? current : models.join("\n"),
            );
            if (!models.length)
              setStatus(
                "No models returned. You can enter model IDs manually.",
              );
          }
        })
        .catch(() => {
          if (active)
            setStatus(
              "Could not fetch models. Check your key and endpoint, then retry.",
            );
        })
        .finally(() => {
          if (active) setDiscovering(false);
        });
    }, 800);
    return () => {
      active = false;
      clearTimeout(timer);
      setDiscovering(false);
    };
  }, [draft?.id, draft?.name, draft?.baseUrl, draft?.api, key, discoveryRetry]);
  const reload = async () => setItems((await loadLocalAIConfig()).connections);
  useEffect(() => {
    void reload().catch((e) => setStatus(String(e)));
  }, []);
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    setDiscovered([]);
    try {
      await work();
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };
  const edit = (connection: ModelConnection) => {
    setDiscovered([]);
    setDraft(connection);
    setModelText(connection.models.join("\n"));
    setKey("");
    setStatus("");
  };
  return (
    <section className="mb-8 space-y-4" aria-label={t("Model connections")}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{t("Model connections")}</h2>
        <SecondaryButton disabled={busy} onClick={() => edit(empty())}>
          {t("Add connection")}
        </SecondaryButton>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-content/55">
        {t(
          "Saved models appear under compatible agents in the composer and can be favorited. The primary model takes priority for new selections; agents with a closed model catalog use their own models.",
        )}
      </p>
      <p className="text-xs leading-relaxed text-content/55">
        {t(
          "Custom models work in Pi, OpenCode and MiMo Code. Claude requires Anthropic Messages (MiMo switches automatically); Codex requires OpenAI Responses. Other agents use their own model catalogs.",
        )}
      </p>
      <p className="text-xs leading-relaxed text-content/55">
        {t(
          "Official models require this CLI’s own login or API credentials and quota. MyCode does not share a Codex subscription with other agents.",
        )}
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-content/[0.04] p-4 text-sm shadow-sm"
        >
          <span className="min-w-0 flex-1">
            <strong>{item.name}</strong>
            {!item.hasKey &&
              !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(
                item.baseUrl,
              ) && (
                <span className="ml-2 text-xs text-amber-500">
                  {t("API key missing")}
                </span>
              )}
            <span className="ml-2 text-xs text-content/50">
              {item.models.length} {t("Models")} · {item.api}
              <span className="mt-1 block truncate">{item.baseUrl}</span>
              {item.primaryModel && (
                <span className="mt-2 inline-block rounded-md bg-accent/10 px-2 py-1 text-accent">
                  {t("Primary model")}: {item.primaryModel}
                </span>
              )}
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
          className="mt-4 grid gap-3 rounded-lg bg-content/[0.025] p-4"
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
                setDraft({ ...draft, ...preset, hasKey: false });
                setKey("");
                setModelText("");
                setDiscovered([]);
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
              onChange={(e) => {
                setDraft({ ...draft, baseUrl: e.target.value, hasKey: false });
                setKey("");
                setDiscovered([]);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs">
            {t("API protocol")}
            <select
              aria-label={t("API protocol")}
              className={inputClass}
              value={draft.api}
              onChange={(e) => {
                const api = e.target.value;
                const mimo =
                  /^https:\/\/(api|token-plan-cn)\.xiaomimimo\.com\/(v1|anthropic)\/?$/.test(
                    draft.baseUrl,
                  );
                setDraft({
                  ...draft,
                  api,
                  hasKey: false,
                  baseUrl: mimo
                    ? draft.baseUrl.replace(
                        /\/(v1|anthropic)\/?$/,
                        api === "anthropic-messages" ? "/anthropic" : "/v1",
                      )
                    : draft.baseUrl,
                });
                setDiscovered([]);
                if (draft.hasKey && !key)
                  setStatus("Protocol changed. Enter your API key again.");
              }}
            >
              <option value="openai-completions">
                {t("OpenAI Chat Completions")}
              </option>
              {!/\.xiaomimimo\.com\//.test(draft.baseUrl) && (
                <option value="openai-responses">
                  {t("OpenAI Responses")}
                </option>
              )}
              <option value="anthropic-messages">
                {t("Anthropic Messages")}
              </option>
              {!/\.xiaomimimo\.com\//.test(draft.baseUrl) && (
                <option value="google-generative-ai">
                  {t("Google Generative AI")}
                </option>
              )}
            </select>
          </label>
          {draft.baseUrl.startsWith("https://tokendance.space/") && (
            <div className="rounded-xl bg-accent/5 p-3 space-y-2">
              <p className="text-sm font-medium">
                TokenDance · {t("Partner provider")}
              </p>
              <p className="text-xs text-content/60">
                {t(
                  "Authorize in your browser, then paste the one-time code. Your API key is stored securely in MyCode.",
                )}
              </p>
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const flow = await invoke<{ id: string; url: string }>(
                      "tokendance_authorize",
                    );
                    setAuthorization(flow.id);
                    await openUrl(flow.url);
                  })
                }
              >
                {t("Authorize TokenDance")}
              </SecondaryButton>
              {authorization && (
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    aria-label={t("Authorization code")}
                    placeholder={t("Authorization code")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <SecondaryButton
                    disabled={busy || !code.trim()}
                    onClick={() =>
                      void action(async () => {
                        await invoke("tokendance_exchange", {
                          id: authorization,
                          code,
                          connection: {
                            ...draft,
                            models: modelText
                              .split(/[\n,]/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        });
                        setCode("");
                        setAuthorization("");
                        const config = await loadLocalAIConfig();
                        setItems(config.connections);
                        const saved = config.connections.find(
                          (c) => c.id === draft.id,
                        );
                        if (saved) {
                          setDraft({ ...saved, enabled: true });
                          setDiscoveryRetry((n) => n + 1);
                        }
                        setStatus(
                          "Authorization succeeded. Select models and save.",
                        );
                      })
                    }
                  >
                    {t("Complete authorization")}
                  </SecondaryButton>
                </div>
              )}
            </div>
          )}
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
              onChange={(e) => {
                setKey(e.target.value);
                setModelText("");
              }}
            />
          </label>
          <div className="flex items-center justify-between text-xs">
            <span>
              {t(discovering ? "Fetching models…" : "Available models")}
            </span>
            <SecondaryButton
              disabled={discovering || busy}
              onClick={() => setDiscoveryRetry((n) => n + 1)}
            >
              {t("Refresh models")}
            </SecondaryButton>
          </div>
          {discovered.length > 0 && (
            <div className="grid max-h-96 gap-2 overflow-y-auto rounded-lg p-1">
              {discovered.map((id) => (
                <label
                  key={id}
                  className="flex min-w-0 items-start gap-3 rounded-xl bg-content/5 p-3 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={modelText.split("\n").includes(id)}
                    onChange={(e) =>
                      setModelText((current) =>
                        e.target.checked
                          ? [...current.split("\n").filter(Boolean), id].join(
                              "\n",
                            )
                          : current
                              .split("\n")
                              .filter((m) => m !== id)
                              .join("\n"),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1" title={id}>
                    <strong className="block truncate">
                      {draft.modelMetadata?.[id]?.name || id}
                    </strong>
                    <span className="block text-content/50">{id}</span>
                    <span className="mt-2 flex flex-wrap gap-2 text-content/65">
                      <span>
                        {t("Context")}:{" "}
                        {draft.modelMetadata?.[
                          id
                        ]?.contextWindow?.toLocaleString() || t("Not reported")}
                      </span>
                      <span>
                        {t("Output")}:{" "}
                        {draft.modelMetadata?.[
                          id
                        ]?.maxOutput?.toLocaleString() || t("Not reported")}
                      </span>
                      <span>
                        {t("Modalities")}:{" "}
                        {draft.modelMetadata?.[id]?.modalities
                          ?.map((m) => t(m))
                          .join(" / ") || t("Not reported")}
                      </span>
                    </span>
                    {draft.modelMetadata?.[id]?.source && (
                      <span className="mt-1 block break-all text-[10px] text-content/40">
                        {t("Official source")}: {draft.modelMetadata[id].source}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
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
          <label className="grid gap-1 text-xs">
            {t("Primary model")}
            <select
              aria-label={t("Primary model")}
              className={inputClass}
              value={draft.primaryModel ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, primaryModel: e.target.value })
              }
            >
              <option value="">{t("No primary model")}</option>
              {modelText
                .split("\n")
                .map((m) => m.trim())
                .filter(Boolean)
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
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
