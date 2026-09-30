import { useEffect, useState } from "react";
import { Modal } from "../../shared/ui/Modal";
import { User } from "../../shared/ui/icons";
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
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-content/50 hover:bg-content/10 hover:text-content"
        onClick={() => setOpen(true)}
      >
        <User size={16} strokeWidth={1.75} className="shrink-0 opacity-70" />
        <span className="truncate">{user?.name || t("Account sign-in")}</span>
      </button>
      {open && (
        <Modal
          title={`MyCode · ${t("Account sign-in")}`}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <section className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
                <User size={24} />
              </div>
              <div>
                <p className="font-semibold">
                  {user?.name || t("Account sign-in")}
                </p>
                <p className="mt-1 text-xs text-content/50">MyCode</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-content/65">
              {t(
                "Sign in securely in your system browser. Only your basic profile is requested. You can continue using local features without signing in.",
              )}
            </p>
            {user && (
              <p className="rounded-xl bg-content/5 p-4 text-sm">
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
        </Modal>
      )}
    </>
  );
}
