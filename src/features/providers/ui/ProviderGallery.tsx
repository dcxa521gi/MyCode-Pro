import { useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import { Modal } from "../../../shared/ui/Modal";
import {
  CONNECTION_PRESETS,
  PROVIDER_CATEGORIES,
  providerCategory,
  type ConnectionPreset,
  type ModelConnection,
} from "../model/modelConnections";

export function ProviderGallery({
  connections,
  onSelect,
  onClose,
  onOpenCli,
}: {
  connections: ModelConnection[];
  onSelect: (preset: ConnectionPreset) => void;
  onClose: () => void;
  onOpenCli?: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const matches = CONNECTION_PRESETS.filter(
    (p) =>
      (!category || providerCategory(p) === category) &&
      `${p.name} ${t(p.name)} ${p.baseUrl}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <Modal
      title={t("Choose a provider")}
      size="lg"
      className="bg-background-base text-content"
      fitViewport
      onClose={onClose}
    >
      <div className="space-y-4 px-4 py-4 text-content">
        <input
          autoFocus
          type="search"
          aria-label={t("Search providers")}
          placeholder={t("Search providers")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-content/10 bg-content/[0.035] px-4 py-3 text-sm outline-none"
        />
        <div
          className="flex flex-wrap gap-2"
          aria-label={t("Provider categories")}
        >
          {["", ...PROVIDER_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${category === c ? "bg-content/15 text-content" : "bg-content/[0.035] text-content/65 hover:bg-content/10"}`}
            >
              {t(c || "All providers")}
            </button>
          ))}
        </div>
        {PROVIDER_CATEGORIES.map((c) => {
          const providers = matches.filter((p) => providerCategory(p) === c);
          if (!providers.length) return null;
          return (
            <section key={c} className="space-y-2.5">
              <h3 className="text-xs font-medium text-content/60">
                {t(c)}{" "}
                <span className="ml-1 tabular-nums text-content/40">
                  {providers.length}
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {providers.map((p) => {
                  const configured =
                    !!p.baseUrl &&
                    connections.some(
                      (item) =>
                        item.baseUrl.replace(/\/$/, "") ===
                        p.baseUrl.replace(/\/$/, ""),
                    );
                  return (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => onSelect(p)}
                      className="group flex min-h-16 items-center gap-3 rounded-xl border border-content/10 bg-content/[0.025] px-3 py-3 text-left transition-colors hover:border-content/25 hover:bg-content/[0.07] focus-visible:outline-2 focus-visible:outline-content/40"
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-content/[0.065] text-xs font-semibold text-content/75"
                      >
                        {p.name
                          .split(/\s/)
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {t(p.name)}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-content/55">
                          {p.baseUrl
                            ? new URL(p.baseUrl).host
                            : t("Bring your own endpoint")}
                        </span>
                      </span>
                      {configured && (
                        <span
                          className="shrink-0 text-xs text-content/60"
                          title={t("Already added")}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!matches.length && (
          <p className="py-8 text-center text-sm text-content/55">
            {t("No matching providers")}
          </p>
        )}
        {onOpenCli && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-content/[0.035] p-4">
            <div>
              <h3 className="text-sm font-medium">{t("CLI subscriptions")}</h3>
              <p className="mt-1 text-xs text-content/55">
                {t(
                  "Use Claude, ChatGPT, Cursor and other CLI accounts in CLI agent tools.",
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCli}
              className="rounded-lg bg-content/10 px-3 py-2 text-xs hover:bg-content/15"
            >
              {t("CLI agent tools")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
