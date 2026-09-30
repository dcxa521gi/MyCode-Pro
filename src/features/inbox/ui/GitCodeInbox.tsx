import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
export function GitCodeInbox() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false),
    [connected, setConnected] = useState(false),
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
    if (open)
      void invoke<boolean>("gitcode_config", { token: null })
        .then(setConnected)
        .catch((e) => setError(String(e)));
  }, [open]);
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
  const url = (item: Item) =>
    `https://gitcode.com/${repo}/${kind}/${encodeURIComponent(item.number)}`;
  return (
    <>
      <button
        className="rounded px-2 py-1 text-xs hover:bg-content/10"
        onClick={() => setOpen(true)}
      >
        GitCode
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[250] grid place-items-center bg-black/50 p-8">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="GitCode"
              className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-4 rounded-2xl bg-surface p-5 shadow-2xl"
            >
              <header className="flex justify-between">
                <h2 className="font-medium">GitCode · {t("Inbox")}</h2>
                <button onClick={() => setOpen(false)}>{t("Close")}</button>
              </header>
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
                  disabled={!token.trim()}
                  onClick={() =>
                    void invoke<boolean>("gitcode_config", { token })
                      .then((v) => {
                        setConnected(v);
                        setToken("");
                      })
                      .catch((e) => setError(String(e)))
                  }
                >
                  {t("Save")}
                </button>
                {connected && (
                  <button
                    onClick={() =>
                      void invoke("gitcode_config", { token: "" })
                        .then(() => {
                          setConnected(false);
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
                <button
                  disabled={busy || !connected}
                  onClick={() => void load(1)}
                >
                  {t(busy ? "Loading…" : "Refresh")}
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {t(error)}
                </p>
              )}
              <div className="grid min-h-0 grid-cols-2 gap-4 overflow-auto">
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
                <div>
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
              </div>
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
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
