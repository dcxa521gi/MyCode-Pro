import { useEffect, useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import {
  HARNESSES,
  HARNESS_TITLE,
  type HarnessId,
} from "../../sessions/model/session";
import { modelsFor, subscribeModels } from "../../sessions/model/models";
import {
  providerAccounts,
  providerAccountDisplayLabel,
  supportsProviderAccounts,
} from "../model/providerAccounts";
import {
  GROUP_STRATEGIES,
  GROUP_STRATEGY_LABELS,
  loadGroupConfig,
  saveGroupConfig,
  MODEL_GROUPS_CHANGED,
  pickGroup,
  readGroupCursor,
  type ModelGroup,
  type GroupStrategy,
} from "../model/modelGroups";
import {
  modelGroupFacts,
  refreshModelGroupQuotas,
} from "../model/modelGroupRouting";

const field =
  "rounded-md border border-content/15 bg-content/5 px-2 py-1.5 text-sm outline-none focus:border-content/40";
export function ModelGroupsPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(loadGroupConfig);
  const [draft, setDraft] = useState<ModelGroup | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => subscribeModels(() => redraw((v) => v + 1)), []);
  useEffect(() => {
    const reload = () => setConfig(loadGroupConfig());
    window.addEventListener(MODEL_GROUPS_CHANGED, reload);
    return () => window.removeEventListener(MODEL_GROUPS_CHANGED, reload);
  }, []);
  const save = (next: typeof config) => {
    try {
      saveGroupConfig(next);
      setConfig(next);
      setError("");
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    }
  };
  const strategyOptions = GROUP_STRATEGIES.map((s) => (
    <option key={s} value={s}>
      {t(GROUP_STRATEGY_LABELS[s])}
    </option>
  ));
  const facts = draft ? modelGroupFacts(draft, "") : {};
  const preview = draft
    ? pickGroup(draft, facts, readGroupCursor(draft))
    : null;
  return (
    <details className="rounded-xl border border-content/10 bg-content/[0.03]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {t("Model groups and account pools")}
      </summary>
      <div className="space-y-4 border-t border-content/10 p-4">
        <p className="text-xs leading-relaxed text-content/60">
          {t(
            "Choose a source for new conversations. Existing conversations keep their model and isolated account; switching a group never migrates credentials or retries completed work.",
          )}
        </p>
        {config.groups.map((group) => (
          <div
            key={group.id}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-content/5 p-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <strong>{group.name}</strong>
              <p className="text-xs text-content/60">
                {HARNESS_TITLE[group.harness]} ·{" "}
                {t(GROUP_STRATEGY_LABELS[group.strategy])}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.defaults[group.harness] === group.id}
                onChange={(e) =>
                  save({
                    ...config,
                    defaults: {
                      ...config.defaults,
                      [group.harness]: e.target.checked ? group.id : undefined,
                    },
                  })
                }
              />
              {t("Use for new conversations")}
            </label>
            <SecondaryButton
              onClick={() => {
                setDraft(structuredClone(group));
                setError("");
              }}
            >
              {t("Edit")}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                if (
                  save({
                    ...config,
                    groups: config.groups.filter((g) => g.id !== group.id),
                    defaults: Object.fromEntries(
                      Object.entries(config.defaults).filter(
                        ([, id]) => id !== group.id,
                      ),
                    ),
                  }) &&
                  draft?.id === group.id
                )
                  setDraft(null);
              }}
            >
              {t("Delete")}
            </SecondaryButton>
          </div>
        ))}
        {!draft && (
          <SecondaryButton
            onClick={() => {
              setDraft({
                id: crypto.randomUUID(),
                name: t("New model group"),
                harness: "claude",
                strategy: "drain",
                candidates: [],
                exceptions: [],
              });
              setError("");
            }}
          >
            {t("Add model group")}
          </SecondaryButton>
        )}
        {draft && (
          <div className="space-y-4 rounded-lg border border-content/15 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                {t("Name")}
                <input
                  className={`${field} w-full`}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs">
                {t("Agent")}
                <SettingsDropdown
                  value={draft.harness}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      harness: e.target.value as HarnessId,
                      candidates: [],
                    })
                  }
                >
                  {HARNESSES.map((h) => (
                    <option key={h} value={h}>
                      {HARNESS_TITLE[h]}
                    </option>
                  ))}
                </SettingsDropdown>
              </label>
              <label className="space-y-1 text-xs">
                {t("Selection strategy")}
                <SettingsDropdown
                  value={draft.strategy}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      strategy: e.target.value as GroupStrategy,
                    })
                  }
                >
                  {strategyOptions}
                </SettingsDropdown>
              </label>
            </div>
            {draft.candidates.map((c, index) => (
              <div
                key={c.id}
                className="grid items-end gap-2 rounded-lg bg-content/5 p-3 sm:grid-cols-2"
              >
                <label className="text-xs">
                  {t("Model")}
                  <SettingsDropdown
                    value={c.model}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        candidates: draft.candidates.map((row) =>
                          row.id === c.id
                            ? {
                                ...row,
                                model: e.target.value,
                                accountId: undefined,
                              }
                            : row,
                        ),
                      })
                    }
                  >
                    {!modelsFor(draft.harness).some(
                      (m) => m.id === c.model,
                    ) && (
                      <option value={c.model}>
                        {c.model} · {t("Unavailable")}
                      </option>
                    )}
                    {modelsFor(draft.harness).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ·{" "}
                        {m.provider?.name ?? HARNESS_TITLE[draft.harness]}
                      </option>
                    ))}
                  </SettingsDropdown>
                </label>
                {supportsProviderAccounts(draft.harness) &&
                  !modelsFor(draft.harness).find((m) => m.id === c.model)
                    ?.connectionId && (
                    <label className="text-xs">
                      {t("Account")}
                      <SettingsDropdown
                        value={c.accountId ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            candidates: draft.candidates.map((row) =>
                              row.id === c.id
                                ? {
                                    ...row,
                                    accountId: e.target.value || undefined,
                                  }
                                : row,
                            ),
                          })
                        }
                      >
                        <option value="">{t("Project account")}</option>
                        {providerAccounts(draft.harness).map((a) => (
                          <option key={a.id} value={a.id}>
                            {providerAccountDisplayLabel(a)}
                          </option>
                        ))}
                      </SettingsDropdown>
                    </label>
                  )}
                <div className="flex flex-wrap items-center gap-3 text-xs sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          candidates: draft.candidates.map((row) =>
                            row.id === c.id
                              ? { ...row, enabled: e.target.checked }
                              : row,
                          ),
                        })
                      }
                    />
                    {t("Enabled")}
                  </label>
                  <label>
                    {t("Weight")}{" "}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className={`${field} w-16`}
                      value={c.weight}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          candidates: draft.candidates.map((row) =>
                            row.id === c.id
                              ? { ...row, weight: Number(e.target.value) }
                              : row,
                          ),
                        })
                      }
                    />
                  </label>
                  <span className="text-content/60">
                    {facts[c.id]?.headroom == null
                      ? t("Quota unknown")
                      : `${Math.round(facts[c.id].headroom!)}% ${t("remaining")}`}{" "}
                    ·{" "}
                    {t(
                      preview?.trace.find((row) => row.id === c.id)?.reason ??
                        (facts[c.id]?.limited ? "Exhausted" : "Unavailable"),
                    )}
                  </span>
                  <SecondaryButton
                    disabled={index === 0}
                    onClick={() => {
                      const candidates = [...draft.candidates];
                      [candidates[index - 1], candidates[index]] = [
                        candidates[index],
                        candidates[index - 1],
                      ];
                      setDraft({ ...draft, candidates });
                    }}
                  >
                    {t("Move up")}
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() =>
                      setDraft({
                        ...draft,
                        candidates: draft.candidates.filter(
                          (row) => row.id !== c.id,
                        ),
                      })
                    }
                  >
                    {t("Remove")}
                  </SecondaryButton>
                </div>
              </div>
            ))}
            <SecondaryButton
              disabled={!modelsFor(draft.harness).length}
              onClick={() =>
                setDraft({
                  ...draft,
                  candidates: [
                    ...draft.candidates,
                    {
                      id: crypto.randomUUID(),
                      model: modelsFor(draft.harness)[0].id,
                      weight: 1,
                      enabled: true,
                    },
                  ],
                })
              }
            >
              {t("Add model source")}
            </SecondaryButton>
            <details>
              <summary className="cursor-pointer text-xs">
                {t("Weekday and time exceptions")}
              </summary>
              <p className="my-2 text-xs text-content/55">
                {t(
                  "Overnight ranges belong to the starting weekday. The first matching rule wins; times use this computer's timezone.",
                )}
              </p>
              {draft.exceptions.map((rule, index) => (
                <div
                  key={index}
                  className="my-2 space-y-2 rounded-lg bg-content/5 p-3"
                >
                  <div className="flex flex-wrap gap-3">
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((day, d) => (
                      <label
                        key={day}
                        className="flex items-center gap-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={rule.days.includes(d)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              exceptions: draft.exceptions.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      days: e.target.checked
                                        ? [...r.days, d]
                                        : r.days.filter((v) => v !== d),
                                    }
                                  : r,
                              ),
                            })
                          }
                        />
                        {t(day)}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["start", "end"] as const).map((key) => (
                      <input
                        key={key}
                        aria-label={t(
                          key === "start" ? "Start time" : "End time",
                        )}
                        type="time"
                        className={field}
                        value={rule[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            exceptions: draft.exceptions.map((r, i) =>
                              i === index ? { ...r, [key]: e.target.value } : r,
                            ),
                          })
                        }
                      />
                    ))}
                    <SettingsDropdown
                      value={rule.strategy}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          exceptions: draft.exceptions.map((r, i) =>
                            i === index
                              ? {
                                  ...r,
                                  strategy: e.target.value as GroupStrategy,
                                }
                              : r,
                          ),
                        })
                      }
                    >
                      {strategyOptions}
                    </SettingsDropdown>
                    <SecondaryButton
                      onClick={() =>
                        setDraft({
                          ...draft,
                          exceptions: draft.exceptions.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      {t("Remove")}
                    </SecondaryButton>
                  </div>
                </div>
              ))}
              <SecondaryButton
                onClick={() =>
                  setDraft({
                    ...draft,
                    exceptions: [
                      ...draft.exceptions,
                      {
                        days: [1, 2, 3, 4, 5],
                        start: "09:00",
                        end: "18:00",
                        strategy: "headroom",
                      },
                    ],
                  })
                }
              >
                {t("Add time exception")}
              </SecondaryButton>
            </details>
            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryButton
                disabled={checking}
                onClick={() => {
                  setChecking(true);
                  void refreshModelGroupQuotas(draft)
                    .then(() => redraw((v) => v + 1))
                    .catch((reason) => setError(String(reason)))
                    .finally(() => setChecking(false));
                }}
              >
                {t(checking ? "Checking…" : "Refresh account quotas")}
              </SecondaryButton>
              <SecondaryButton onClick={() => setDraft(null)}>
                {t("Cancel")}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  if (
                    save({
                      ...config,
                      groups: [
                        ...config.groups.filter((g) => g.id !== draft.id),
                        draft,
                      ],
                    })
                  )
                    setDraft(null);
                }}
              >
                {t("Save")}
              </SecondaryButton>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
