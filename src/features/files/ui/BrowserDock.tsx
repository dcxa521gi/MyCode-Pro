import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../../shared/i18n";
export function BrowserDock({ hidden = false }: { hidden?: boolean }) {
  const { t } = useTranslation();
  const [page, setPage] = useState<{
    id: string;
    url: string;
    path: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const current = useRef(page);
  current.current = page;
  useEffect(() => {
    const handler = (event: Event) => {
      const { path, external } = (
        event as CustomEvent<{ path: string; external: boolean }>
      ).detail;
      const gen = ++generation.current;
      setLoading(true);
      setError("");
      void invoke<{ id: string; url: string }>("local_preview_start", { path })
        .then(async (result) => {
          if (external) {
            await openUrl(result.url);
            return;
          }
          if (gen !== generation.current) {
            void invoke("local_preview_stop", { id: result.id });
            return;
          }
          if (current.current)
            void invoke("local_preview_stop", { id: current.current.id });
          setPage({ ...result, path });
        })
        .catch((e) => setError(String(e)))
        .finally(() => {
          if (gen === generation.current) setLoading(false);
        });
    };
    window.addEventListener("mycode:preview-file", handler);
    return () => {
      window.removeEventListener("mycode:preview-file", handler);
      if (current.current)
        void invoke("local_preview_stop", { id: current.current.id });
    };
  }, []);
  if (hidden || (!page && !error && !loading)) return null;
  return (
    <aside
      className="order-30 flex w-[42vw] min-w-72 max-w-[70vw] resize-x flex-col overflow-hidden border-l border-content/10 bg-surface text-content"
      aria-label={t("Built-in browser")}
    >
      <header className="flex items-center gap-2 border-b border-content/10 p-3 text-xs">
        <span className="min-w-0 flex-1 truncate" title={page?.path}>
          {loading
            ? t("Loading…")
            : page?.path.split(/[\\/]/).pop() || t("Built-in browser")}
        </span>
        <button onClick={() => setRevision((n) => n + 1)}>
          {t("Refresh")}
        </button>
        <button disabled={!page} onClick={() => page && void openUrl(page.url)}>
          {t("External browser")}
        </button>
        <button
          aria-label={t("Close browser")}
          onClick={() => {
            generation.current++;
            if (page) void invoke("local_preview_stop", { id: page.id });
            setPage(null);
            setError("");
            setLoading(false);
          }}
        >
          ×
        </button>
      </header>
      {error ? (
        <p role="alert" className="p-4 text-sm text-red-500">
          {error}
        </p>
      ) : (
        page && (
          <iframe
            key={revision + page.url}
            src={page.url}
            title={t("Local page preview")}
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            className="min-h-0 w-full flex-1 bg-white"
          />
        )
      )}
    </aside>
  );
}
