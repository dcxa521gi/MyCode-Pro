import { SettingsOptions } from "../../../shared/ui/SettingsOptions";
import { usageTokens } from "../../settings/model/usageTokens";
import type { UsageRow } from "../../settings/ui/UsageHistoryPage";
import { ProviderGallery } from "./ProviderGallery";
import { Modal } from "../../../shared/ui/Modal";
import { formatTokenCount } from "../../../shared/lib/tokenCount";
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
  "w-full rounded-lg border border-content/15 bg-content/5 px-3 py-2 text-sm outline-none focus:border-content/30";
const empty = (): ModelConnection => ({
  id: crypto.randomUUID(),
  name: "",
  baseUrl: "",
  api: "openai-completions",
  models: [],
  enabled: true,
  hasKey: false,
});

export function ModelConnections({
  onOpenCli,
}: { onOpenCli?: () => void } = {}) {
  const { t } = useTranslation();
  const [choosingProvider, setChoosingProvider] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [items, setItems] = useState<ModelConnection[]>([]);
  const [formStep, setFormStep] = useState(2);
  const [draft, setDraft] = useState<ModelConnection | null>(null);
  useEffect(() => setFormStep(2), [draft?.id]);
  const [key, setKey] = useState("");
  const [modelText, setModelText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorization, setAuthorization] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    setAuthorization("");
    setCode("");
  }, [draft?.id, draft?.baseUrl]);
  const [modelQuery, setModelQuery] = useState("");
  const [manualModelOpen, setManualModelOpen] = useState(false);
  const [manualModelId, setManualModelId] = useState("");
  const addManualModel = () => {
    const id = manualModelId.trim();
    if (!id) return;
    setDiscovered((models) => [...new Set([...models, id])]);
    setModelText((current) =>
      [...new Set([...current.split("\n").filter(Boolean), id])].join("\n"),
    );
    setManualModelId("");
    setModelQuery("");
  };
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
              current
                ? {
                    ...current,
                    modelMetadata: { ...current.modelMetadata, ...metadata },
                  }
                : current,
            );
            setDiscovered((current) => [...new Set([...current, ...models])]);

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
  const reload = async () => {
    const connections = (await loadLocalAIConfig()).connections;
    setItems(connections);
    setSelectedId((current) =>
      connections.some((c) => c.id === current)
        ? current
        : connections[0]?.id || null,
    );
  };
  useEffect(() => {
    void invoke<UsageRow[]>("usage_history")
      .then((rows) => {
        const totals: Record<string, number> = {};
        for (const row of rows)
          if (row.connectionId)
            totals[row.connectionId] =
              (totals[row.connectionId] || 0) + usageTokens(row);
        setUsage(totals);
      })
      .catch(() => {});
  }, []);
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
    setModelQuery("");
    setManualModelOpen(false);
    setDiscovered([
      ...new Set([
        ...connection.models,
        ...Object.keys(connection.modelMetadata || {}),
      ]),
    ]);
    setSelectedId(connection.id);
    setDraft(connection);
    setModelText(connection.models.join("\n"));
    setKey("");
    setStatus("");
  };
  return (
    <section className="mb-8 space-y-4" aria-label={t("Add model providers")}>
      {choosingProvider && (
        <ProviderGallery
          connections={items}
          onClose={() => setChoosingProvider(false)}
          onOpenCli={
            onOpenCli
              ? () => {
                  setChoosingProvider(false);
                  onOpenCli();
                }
              : undefined
          }
          onSelect={(preset) => {
            edit({
              ...empty(),
              ...(draft ? { id: draft.id } : {}),
              name: preset.name,
              baseUrl: preset.baseUrl,
              api: preset.api,
            });
            setChoosingProvider(false);
          }}
        />
      )}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{t("Add model providers")}</h2>
        <SecondaryButton
          disabled={busy}
          onClick={() => setChoosingProvider(true)}
        >
          {t("Add provider")}
        </SecondaryButton>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-content/55">
        {t(
          "Saved models appear under compatible agents in the composer and can be favorited. The primary model takes priority for new selections; agents with a closed model catalog use their own models.",
        )}
      </p>
      <p className="text-xs leading-relaxed text-content/55">
        {t(
          "Custom models work in Pi, OpenCode and MiMo Code. Hermes supports OpenAI Chat Completions; MiniMax Code supports OpenAI Chat Completions and Anthropic Messages. Claude requires Anthropic Messages (MiMo switches automatically); Codex requires OpenAI Responses. Other agents use their own model catalogs.",
        )}
      </p>
      <p className="text-xs leading-relaxed text-content/55">
        {t(
          "Official models require this CLI’s own login or API credentials and quota. MyCode does not share a Codex subscription with other agents.",
        )}
      </p>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-accent/10 p-4">
        <div>
          <strong>TokenDance</strong>
          <p className="mt-1 text-xs text-content/60">
            {t("Partner provider")}
          </p>
        </div>
        <SecondaryButton
          onClick={() =>
            edit(
              items.find((item) =>
                item.baseUrl.startsWith("https://tokendance.space/"),
              ) || { ...empty(), ...CONNECTION_PRESETS[0] },
            )
          }
        >
          {t("Connect")}
        </SecondaryButton>
      </div>
      <div className="grid min-h-[440px] overflow-hidden rounded-2xl bg-content/[0.025] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2 border-r border-content/5 p-3">
          {items.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedId === item.id}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest("button")) {
                  setSelectedId(item.id);
                  setDraft(null);
                }
              }}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  ["Enter", " "].includes(event.key)
                ) {
                  event.preventDefault();
                  setSelectedId(item.id);
                  setDraft(null);
                }
              }}
              className={`cursor-pointer space-y-2 rounded-xl px-3 py-3 text-sm ${selectedId === item.id ? "bg-accent/10" : "bg-content/[0.04] hover:bg-content/10"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${item.enabled ? "bg-emerald-500" : "bg-content/20"}`}
                />
                <strong className="min-w-0 flex-1 truncate" title={item.name}>
                  {item.name}
                </strong>
                <span className="shrink-0 text-xs text-content/45">
                  {item.models.length}
                </span>
              </div>
              <p className="text-xs text-content/50">
                {formatTokenCount(usage[item.id] || 0)} Token
              </p>
            </div>
          ))}
          <SecondaryButton
            disabled={busy}
            onClick={() => setChoosingProvider(true)}
          >
            {t("Add provider")}
          </SecondaryButton>
        </div>
        <div className="min-w-0">
          {!draft &&
            selectedId &&
            (() => {
              const item = items.find((item) => item.id === selectedId);
              return (
                item && (
                  <section className="rounded-xl bg-content/[0.025] p-5">
                    <div className="mb-5 space-y-3 border-b border-content/10 pb-4">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="break-all text-xs text-content/50">
                        {item.baseUrl}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              const count = await invoke<number>(
                                "local_ai_test_connection",
                                {
                                  id: item.id,
                                },
                              );
                              setStatus(
                                `${t("Connection succeeded. Models returned:")} ${count}`,
                              );
                            })
                          }
                        >
                          {t("Test connection")}
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={busy}
                          onClick={() => edit(item)}
                        >
                          {t("Edit")}
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await invoke("local_ai_remove_connection", {
                                id: item.id,
                              });
                              await reload();
                              await refreshPiCatalog();
                            })
                          }
                        >
                          {t("Remove")}
                        </SecondaryButton>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        ...new Set([
                          ...item.models,
                          ...Object.keys(item.modelMetadata || {}),
                        ]),
                      ].map((id) => (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-4 rounded-lg p-3 text-sm hover:bg-content/5"
                        >
                          <div>
                            <strong>
                              {item.modelMetadata?.[id]?.name || id}
                            </strong>
                            <p className="mt-1 text-xs text-content/50">
                              {id}
                              {item.primaryModel === id
                                ? ` · ${t("Primary model")}`
                                : ""}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={`${t("Enabled")} ${id}`}
                            checked={item.models.includes(id)}
                            disabled={busy}
                            className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-content/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-4 before:rounded-full before:bg-white before:transition-transform checked:bg-accent checked:before:translate-x-4 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              void action(async () => {
                                await invoke("local_ai_save_connection", {
                                  connection: {
                                    ...item,
                                    models: enabled
                                      ? [...item.models, id]
                                      : item.models.filter((m) => m !== id),
                                    primaryModel:
                                      !enabled && item.primaryModel === id
                                        ? undefined
                                        : item.primaryModel,
                                  },
                                  apiKey: null,
                                });
                                await reload();
                                await refreshPiCatalog();
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )
              );
            })()}
          {draft && !choosingProvider && (
            <Modal
              title={t(
                items.some((item) => item.id === draft.id)
                  ? "Edit connection"
                  : "Add provider",
              )}
              onClose={() => {
                if (!busy) {
                  setDraft(null);
                  setKey("");
                }
              }}
              fitViewport
            >
              <form
                className="mt-4 grid gap-3 rounded-lg bg-content/[0.025] p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (formStep === 2) {
                    setFormStep(3);
                    return;
                  }
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
                <div className="flex items-center justify-between gap-3 rounded-lg bg-content/5 p-3">
                  <span className="text-sm font-medium">
                    {draft.name || t("Custom endpoint")}
                  </span>
                  <SecondaryButton
                    type="button"
                    disabled={busy}
                    onClick={() => setChoosingProvider(true)}
                  >
                    {t("Change provider")}
                  </SecondaryButton>
                </div>
                <div className="flex items-center gap-2 text-xs text-content/55">
                  <span className="rounded-full bg-content/5 px-3 py-1">
                    {t("2 · Configure connection")}
                  </span>
                  <span>→</span>
                  <span
                    className={`rounded-full px-3 py-1 ${formStep === 3 ? "bg-selection text-content" : "bg-content/5"}`}
                  >
                    {t("3 · Select models")}
                  </span>
                </div>
                <div hidden={formStep !== 2} className="space-y-4">
                  <label className="grid gap-1 text-xs">
                    {t("Name")}
                    <input
                      aria-label={t("Name")}
                      required
                      className={inputClass}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
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
                        setDraft({
                          ...draft,
                          baseUrl: e.target.value,
                          hasKey: false,
                        });
                        setKey("");
                        setDiscovered([]);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    {t("API protocol")}
                    <SettingsOptions
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
                                api === "anthropic-messages"
                                  ? "/anthropic"
                                  : "/v1",
                              )
                            : draft.baseUrl,
                        });
                        setDiscovered([]);
                        if (draft.hasKey && !key)
                          setStatus(
                            "Protocol changed. Enter your API key again.",
                          );
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
                    </SettingsOptions>
                  </label>
                  {(draft.baseUrl.startsWith("https://tokendance.space/") ||
                    draft.baseUrl.replace(/\/$/, "") ===
                      "https://openrouter.ai/api/v1") && (
                    <div className="rounded-xl bg-accent/5 p-3 space-y-2">
                      <p className="text-sm font-medium">
                        {draft.baseUrl.includes("openrouter.ai") ? (
                          "OpenRouter · OAuth"
                        ) : (
                          <>TokenDance · {t("Partner provider")}</>
                        )}
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
                            const flow = await invoke<{
                              id: string;
                              url: string;
                            }>("tokendance_authorize", {
                              provider: draft.baseUrl.includes("openrouter.ai")
                                ? "openrouter"
                                : "tokendance",
                            });
                            setAuthorization(flow.id);
                            await openUrl(flow.url);
                          })
                        }
                      >
                        {t(
                          draft.baseUrl.includes("openrouter.ai")
                            ? "Authorize OpenRouter"
                            : "Authorize TokenDance",
                        )}
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
                </div>
                <div hidden={formStep !== 3} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span>
                      {t(discovering ? "Fetching models…" : "Available models")}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${inputClass} !w-40`}
                        aria-label={t("Search models")}
                        placeholder={t("Search models")}
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                      />
                      <SecondaryButton
                        onClick={() => setManualModelOpen((v) => !v)}
                      >
                        {t("Add model manually")}
                      </SecondaryButton>
                      <SecondaryButton
                        disabled={busy || !discovered.length}
                        onClick={() => setModelText(discovered.join("\n"))}
                      >
                        {t("Select all models")}
                      </SecondaryButton>
                      <SecondaryButton
                        disabled={busy || !modelText}
                        onClick={() => {
                          setModelText("");
                          setDraft({ ...draft, primaryModel: undefined });
                        }}
                      >
                        {t("Clear model selection")}
                      </SecondaryButton>
                      <SecondaryButton
                        disabled={discovering || busy}
                        onClick={() => setDiscoveryRetry((n) => n + 1)}
                      >
                        {t("Refresh models")}
                      </SecondaryButton>
                    </span>
                  </div>
                  {modelQuery.trim() &&
                    !discovered.some((id) =>
                      `${id} ${draft.modelMetadata?.[id]?.name || ""}`
                        .toLowerCase()
                        .includes(modelQuery.trim().toLowerCase()),
                    ) && (
                      <p role="status" className="p-3 text-xs text-content/60">
                        {t("No matching models")}
                      </p>
                    )}
                  {discovered.length > 0 && (
                    <div className="grid max-h-96 gap-2 overflow-y-auto rounded-lg p-1">
                      {discovered
                        .filter((id) =>
                          `${id} ${draft.modelMetadata?.[id]?.name || ""}`
                            .toLowerCase()
                            .includes(modelQuery.trim().toLowerCase()),
                        )
                        .map((id) => (
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
                                    ? [
                                        ...current.split("\n").filter(Boolean),
                                        id,
                                      ].join("\n")
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
                              <span className="block text-content/50">
                                {id}
                              </span>
                              <span className="mt-2 flex flex-wrap gap-2 text-content/65">
                                <span>
                                  {t("Context")}:{" "}
                                  {draft.modelMetadata?.[
                                    id
                                  ]?.contextWindow?.toLocaleString() ||
                                    t("Not reported")}
                                </span>
                                <span>
                                  {t("Output")}:{" "}
                                  {draft.modelMetadata?.[
                                    id
                                  ]?.maxOutput?.toLocaleString() ||
                                    t("Not reported")}
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
                                  {t("Official source")}:{" "}
                                  {draft.modelMetadata[id].source}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                  {(manualModelOpen || discovered.length === 0) && (
                    <div className="flex items-end gap-2 rounded-lg bg-content/5 p-3">
                      <label className="grid flex-1 gap-1 text-xs">
                        {t("Add model ID")}
                        <input
                          className={inputClass}
                          placeholder={t("Model ID")}
                          value={manualModelId}
                          onChange={(e) => setManualModelId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addManualModel();
                            }
                          }}
                        />
                      </label>
                      <SecondaryButton
                        disabled={!manualModelId.trim() || busy}
                        onClick={addManualModel}
                      >
                        {t("Add model")}
                      </SecondaryButton>
                    </div>
                  )}
                  <label className="grid gap-1 text-xs">
                    {t("Primary model")}
                    <SettingsOptions
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
                    </SettingsOptions>
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
                </div>
                <div className="flex gap-2">
                  {formStep === 3 && (
                    <SecondaryButton
                      type="button"
                      onClick={() => setFormStep(2)}
                    >
                      {t("Back")}
                    </SecondaryButton>
                  )}
                  <button
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
                    disabled={busy || (formStep === 3 && !modelText.trim())}
                    type="submit"
                  >
                    {t(busy ? "Saving…" : formStep === 2 ? "Next" : "Save")}
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
            </Modal>
          )}
          {status && (
            <p role="status" className="mt-3 text-sm text-content/70">
              {t(status)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
