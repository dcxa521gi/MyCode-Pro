import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../shared/i18n";

type Identity = { sub: string; name: string };
export function AccountCenter() {
  const { t } = useTranslation();
  const [user, setUser] = useState<Identity | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    const check = (startup = false) =>
      invoke<Identity | null>("account_center_status")
        .then((identity) => {
          if (!active) return;
          setUser(identity);
          setError("");
          if (startup && !identity) setOpen(true);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    void check(true);
    const timer = window.setInterval(() => void check(), 5 * 60_000);
    const focus = () => void check();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      setUser(await invoke<Identity>("account_center_login"));
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    await invoke("account_center_logout");
    setUser(null);
    setBusy(false);
  };
  return (
    <>
      <button
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs text-content/60 hover:bg-content/5"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{user?.name || t("Account sign-in")}</span>
        <span className="ml-2 shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-500">
          {t("Experimental")}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[400] grid place-items-center bg-black/50 p-6"
            onClick={() => {
              if (!busy) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={t("Account sign-in")}
              className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold">
                MyCode · {t("Account sign-in")}
              </h2>
              <p className="text-sm text-amber-500">
                {t("Experimental feature — not final quality.")}
              </p>
              <p className="text-sm leading-relaxed text-content/65">
                {t(
                  "Sign in securely in your system browser. Only your basic profile is requested. You can continue using local features without signing in.",
                )}
              </p>
              {user && (
                <p className="text-sm">
                  {user.name}
                  <span className="mt-1 block break-all text-xs text-content/45">
                    {user.sub}
                  </span>
                </p>
              )}
              {busy && (
                <p role="status" className="animate-pulse text-sm">
                  {t("Waiting for browser authorization…")}
                </p>
              )}
              {error && (
                <p role="alert" className="break-words text-sm text-red-400">
                  {t(error)}
                </p>
              )}
              <div className="flex justify-end gap-3 text-sm">
                <button
                  onClick={() => {
                    if (busy) void logout().catch((e) => setError(String(e)));
                    setOpen(false);
                  }}
                >
                  {t(busy ? "Cancel" : "Later")}
                </button>
                {user ? (
                  <button
                    onClick={() =>
                      void logout().catch((e) => setError(String(e)))
                    }
                  >
                    {t("Sign out locally")}
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    className="rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-40"
                    onClick={() => void login()}
                  >
                    {t("Sign in with browser")}
                  </button>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
