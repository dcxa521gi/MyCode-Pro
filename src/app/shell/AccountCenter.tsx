import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Modal } from "../../shared/ui/Modal";
import { User } from "../../shared/ui/icons";
import { useTranslation } from "../../shared/i18n";
import { loadLocalAIConfig } from "../../features/providers/model/modelConnections";

type Account = { connected: true; name?: string | null; avatar?: string | null; email?: string | null; userId?: string | null; connectionName?: string | null; balance?: number | null; credits?: number | null; creditsUsed?: number | null };
const amount = (micro?: number | null) => micro == null ? null : `¥${(micro / 1_000_000).toFixed(2)}`;

export function AccountCenter({ onManageModels }: { onManageModels?: () => void } = {}) {
  const { t } = useTranslation();
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const refresh = () => invoke<Account | null>("tokendance_account_status")
    .then(setAccount).catch((reason) => setError(String(reason)));
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void refresh();
    const focus = () => void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, []);
  const authorize = async () => {
    setBusy(true); setError("");
    try {
      const result = await invoke<{ id: string; url: string }>("tokendance_authorize", { provider: "tokendance" });
      setFlow(result.id);
      await openUrl(result.url);
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  };
  const exchange = async () => {
    setBusy(true); setError("");
    try {
      const config = await loadLocalAIConfig();
      const connections = config.connections.filter((item) => item.baseUrl.startsWith("https://tokendance.space/"));
      const existing = connections[connections.length - 1];
      await invoke("tokendance_exchange", { id: flow, code: code.trim(), connection: existing ?? {
        id: crypto.randomUUID(), name: "TokenDance · Partner", baseUrl: "https://tokendance.space/gateway/v1",
        api: "openai-completions", models: [], enabled: false, hasKey: false, primaryModel: "",
      }});
      setCode(""); setFlow("");
      await loadLocalAIConfig();
      await refresh();
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  };
  const avatar = account?.avatar && (account.avatar.startsWith("https://") || account.avatar.startsWith("/"))
    ? account.avatar.startsWith("/") ? `https://tokendance.space${account.avatar}` : account.avatar : null;
  return <>
    <button className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-content/65 hover:bg-content/10 hover:text-content" onClick={() => { setError(""); setOpen(true); }}>
      {avatar ? <img src={avatar} alt="" className="size-5 shrink-0 rounded-full object-cover" /> : <User size={17} className="shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{account?.name || (account ? t("TokenDance account") : t("Sign in to TokenDance"))}</span>
      {account && <span className="shrink-0 text-xs tabular-nums text-content/50">{amount(account.balance) ?? t("Balance unavailable")}</span>}
    </button>
    {open && <Modal title={t("TokenDance account")} onClose={() => !busy && setOpen(false)}>
      <section className="space-y-4 p-5 text-sm">
        <div className="flex items-center gap-3 rounded-xl bg-content/5 p-4">
          {avatar ? <img src={avatar} alt="" className="size-12 rounded-full object-cover" /> : <div className="grid size-12 place-items-center rounded-full bg-accent/15 text-accent"><User size={24} /></div>}
          <div className="min-w-0"><p className="truncate font-semibold">{account?.name || (account ? t("TokenDance account") : t("Not signed in"))}</p><p className="text-xs text-content/55">{account?.email || t("TokenDance · model provider and account")}</p></div>
        </div>
        {account ? <div className="grid grid-cols-2 gap-2">
          {[["Balance", amount(account.balance)], ["Total credits", amount(account.credits)], ["Used credits", amount(account.creditsUsed)], ["Account ID", account.userId], ["Model connection", account.connectionName]].filter(([, value]) => value != null).map(([label, value]) => <div className="rounded-lg bg-content/5 p-3" key={label}><p className="text-xs text-content/55">{t(label!)}</p><p className="mt-1 break-all font-medium">{value}</p></div>)}
        </div> : <p className="text-content/60">{t("Authorize TokenDance in your browser to connect your account and model provider.")}</p>}
        {account && account.balance == null && <p className="text-xs text-content/50">{t("Balance is temporarily unavailable. Your saved model connection remains usable.")}</p>}
        {flow && <div className="space-y-2"><p className="text-xs text-content/55">{t("Paste the one-time code shown after you approve access in your browser.")}</p><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-content/15 bg-content/5 px-3 py-2 outline-none" aria-label={t("Authorization code")} placeholder={t("Authorization code")} value={code} onChange={event => setCode(event.target.value)} /><button className="rounded-lg bg-accent px-3 text-white disabled:opacity-50" disabled={busy || !code.trim()} onClick={() => void exchange()}>{t("Complete authorization")}</button></div></div>}
        {error && <p role="alert" className="break-words text-red-400">{t(error.replace(/^Error:\s*/, ""))}</p>}
        <div className="flex justify-end gap-3">{account && onManageModels && <button className="mr-auto rounded-lg px-3 py-2 hover:bg-content/10" onClick={() => { setOpen(false); onManageModels(); }}>{t("Manage models")}</button>}<button className="rounded-lg px-3 py-2 hover:bg-content/10" onClick={() => setOpen(false)}>{t("Close")}</button><button className="rounded-lg bg-accent px-3 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => void authorize()}>{t(account ? "Reauthorize TokenDance" : "Authorize TokenDance")}</button></div>
      </section>
    </Modal>}
  </>;
}
