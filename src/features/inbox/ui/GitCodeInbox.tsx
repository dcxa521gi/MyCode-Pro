import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../../shared/i18n";
import { copyText } from "../../../platform/tauri/clipboard";
type Item = {
  number: number | string;
  title: string;
  body?: string;
  state: string;
  updatedAt: string;
};
export function GitCodeInbox({
  settings = false,
  detailTarget,
}: {
  settings?: boolean;
  detailTarget?: HTMLElement | null;
}) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""),
    [repo, setRepo] = useState(
      () => localStorage.getItem("mycode.gitcodeRepo") || "",
    ),
    [kind, setKind] = useState("issues"),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState<Item | null>(null);
  useEffect(() => {
    void invoke<boolean>("gitcode_config", { token: null })
      .then((value) => {
        setConnected(value);
        if (!value) {
          localStorage.removeItem("mycode.gitcodeConnected");
          window.dispatchEvent(new Event("mycode:gitcode"));
        }
      })
      .catch((e) => setError(String(e)));
  }, []);
  const load = async (next = page) => {
    setBusy(true);
    setError("");
    try {
      setItems(
        await invoke<Item[]>("gitcode_items", {
          repo: repo.trim(),
          kind,
          page: next,
        }),
      );
      setPage(next);
      localStorage.setItem("mycode.gitcodeRepo", repo.trim());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!settings && connected) void load(1);
  }, [settings, connected, kind]);
  const url = (item: Item) =>
    `https://gitcode.com/${repo}/${kind}/${encodeURIComponent(item.number)}`;
  const detail = (
    <div className="h-full overflow-auto p-6">
      {selected && (
        <>
          <h3 className="font-medium">{selected.title}</h3>
          <pre className="my-3 whitespace-pre-wrap font-sans text-sm text-content/70">
            {selected.body || t("No description")}
          </pre>
          <div className="flex gap-3 text-xs">
            <button onClick={() => void openUrl(url(selected))}>
              {t("Open in browser")}
            </button>
            <button
              onClick={() =>
                void copyText(
                  `${url(selected)}\n${selected.title}\n${selected.body || ""}`,
                )
              }
            >
              {t("Copy task context")}
            </button>
          </div>
        </>
      )}
    </div>
  );
  return (
    <section
      className={`flex min-h-0 w-full flex-col gap-4 text-content ${settings ? "py-5" : "h-full p-3"}`}
    >
      {settings && <h3 className="font-medium">GitCode</h3>}
      {settings && (
        <>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              aria-label={t("Personal access token")}
              className="min-w-0 flex-1 rounded bg-content/5 px-3 py-2 text-sm"
              placeholder={t(
                connected
                  ? "Leave blank to keep the saved key"
                  : "Personal access token",
              )}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              disabled={busy || (!token.trim() && !connected) || !repo.trim()}
              onClick={() => {
                setBusy(true);
                setError("");
                void invoke("gitcode_items", {
                  repo: repo.trim(),
                  kind: "issues",
                  page: 1,
                  tokenOverride: token.trim() || null,
                })
                  .then(() =>
                    invoke<boolean>("gitcode_config", {
                      token: token.trim() || null,
                    }),
                  )
                  .then((value) => {
                    localStorage.setItem("mycode.gitcodeRepo", repo.trim());
                    localStorage.setItem("mycode.gitcodeConnected", "true");
                    window.dispatchEvent(new Event("mycode:gitcode"));
                    setConnected(value);
                    setToken("");
                  })
                  .catch((error) => setError(String(error)))
                  .finally(() => setBusy(false));
              }}
            >
              {t("Save")}
            </button>
            {connected && (
              <button
                onClick={() =>
                  void invoke("gitcode_config", { token: "" })
                    .then(() => {
                      setConnected(false);
                      localStorage.removeItem("mycode.gitcodeConnected");
                      window.dispatchEvent(new Event("mycode:gitcode"));
                      setItems([]);
                      setSelected(null);
                    })
                    .catch((e) => setError(String(e)))
                }
              >
                {t("Disconnect")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              aria-label={t("Repository")}
              className="min-w-0 flex-1 rounded bg-content/5 px-3 py-2 text-sm"
              placeholder="owner/repository"
              value={repo}
              disabled={busy}
              onChange={(e) => {
                setRepo(e.target.value);
                setItems([]);
                setSelected(null);
                setPage(1);
              }}
            />
            <select
              disabled={busy}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setItems([]);
                setSelected(null);
                setPage(1);
              }}
            >
              <option value="issues">{t("Issues")}</option>
              <option value="pulls">{t("Pull requests")}</option>
            </select>
            <button disabled={busy || !connected} onClick={() => void load(1)}>
              {t(busy ? "Loading…" : "Refresh")}
            </button>
          </div>
        </>
      )}
      {!settings && (
        <div className="flex items-center gap-3">
          <strong className="flex-1 text-sm">GitCode · {repo}</strong>
          <select
            className="rounded-md bg-surface px-2 py-1 text-xs"
            disabled={busy}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(1);
              setItems([]);
              setSelected(null);
            }}
          >
            <option value="issues">{t("Issues")}</option>
            <option value="pulls">{t("Pull requests")}</option>
          </select>
          <button onClick={() => void load(1)} disabled={busy}>
            {t("Refresh")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {t(error)}
        </p>
      )}
      {!settings && (
        <div
          className={
            detailTarget
              ? "min-h-0 flex-1 overflow-auto"
              : "grid min-h-0 flex-1 grid-cols-[minmax(220px,1fr)_2fr] gap-5 overflow-auto"
          }
        >
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.number}
                className="block w-full rounded-lg bg-content/5 p-3 text-left text-sm"
                onClick={() => setSelected(item)}
              >
                #{item.number} · {item.title}
                <span className="block text-xs text-content/50">
                  {t(item.state)} · {item.updatedAt}
                </span>
              </button>
            ))}
          </div>
          {detailTarget ? createPortal(detail, detailTarget) : detail}
        </div>
      )}
      {!settings && (
        <footer className="flex justify-end gap-3 text-sm">
          <button
            disabled={busy || page <= 1}
            onClick={() => void load(page - 1)}
          >
            {t("Previous")}
          </button>
          <span>{page}</span>
          <button
            disabled={busy || items.length < 20}
            onClick={() => void load(page + 1)}
          >
            {t("Next")}
          </button>
        </footer>
      )}
    </section>
  );
}
