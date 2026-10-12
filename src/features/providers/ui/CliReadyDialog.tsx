import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";
import { useTranslation } from "../../../shared/i18n";
import {
  HARNESS_TITLE,
  HARNESSES,
  type Session,
} from "../../sessions/model/session";
import { ensureCliReady, type CliCheck } from "../model/cliReady";
import { applyProviderBinaryPath } from "../model/providerBinaryPaths";
import { probeHarnessAvailability } from "../../../integrations/harness/core/availability";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import { refreshHarnessCatalogs } from "../../../integrations/harness/core/registry";
import { announceHarnessUpdated } from "../model/harnessUpdates";
import { invalidateCLIVersion } from "../model/cliVersions";
import { cliErrorMessage } from "../model/cliErrors";
export function CliReadyDialog({ sessions }: { sessions: Session[] }) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<CliCheck[]>([]);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const seen = useRef(new Set(sessions.map((s) => `${s.id}:${s.harness}`)));
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<CliCheck>).detail;
      if (!detail || !HARNESSES.includes(detail.provider)) {
        detail?.finish(false);
        return;
      }
      if (detail.installed) {
        detail.finish(true);
        return;
      }
      setQueue((q) => [...q, detail]);
    };
    window.addEventListener("mycode:cli-check", receive);
    return () => window.removeEventListener("mycode:cli-check", receive);
  }, []);
  useEffect(() => {
    for (const session of sessions) {
      const key = `${session.id}:${session.harness}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (!session.blocks.length && !session.inboxAsk)
        void ensureCliReady(session.harness, session.id).catch(() => {});
    }
  }, [sessions]);
  const current = queue[0];
  if (!current) return null;
  const close = (ready: boolean) => {
    current.finish(ready);
    setQueue((q) => q.slice(1));
    setSuccess(false);
    setStatus("");
  };
  const install = async () => {
    setBusy(true);
    setStatus("");
    try {
      const path = await invoke<string>("managed_cli_install", {
        provider: current.provider,
      });
      const check = await inspectHarnessBinary(current.provider, path);
      if (!check.version)
        throw Error(check.error || t("CLI returned no valid version."));
      if (!(await applyProviderBinaryPath(current.provider, path)))
        throw Error(t("Could not save the binary path."));
      localStorage.setItem(`mycode.appCliPath.${current.provider}`, path);
      localStorage.setItem(`mycode.cliScope.${current.provider}`, "app");
      await probeHarnessAvailability({ force: true });
      invalidateCLIVersion(current.provider);
      await refreshHarnessCatalogs([current.provider], { force: true });
      void announceHarnessUpdated(current.provider).catch(() => undefined);
      setStatus(`${t("Installation successful")} · ${check.version}`);
      setQueue((items) =>
        items.map((item) =>
          item === current ? { ...item, installed: check.version } : item,
        ),
      );
      setSuccess(true);
    } catch (error) {
      setStatus(cliErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/50 p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("Install CLI")}
        className="w-full max-w-xl max-h-[calc(100dvh-48px)] overflow-y-auto space-y-4 rounded-2xl bg-surface p-6 text-content shadow-2xl"
      >
        <h2 className="text-lg font-semibold">
          {HARNESS_TITLE[current.provider]} · {t("Install CLI")}
        </h2>
        <p className="rounded-xl bg-content/5 p-3 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {t("Installed")}: {current.installed || t("Not installed")}
        </p>
        {busy && (
          <div className="rounded-xl border border-content/10 bg-content/[0.035] p-3">
            <BusyIndicator
              label={t("Downloading and installing in MyCode. Please wait…")}
            />
          </div>
        )}
        {status && (
          <p
            role="status"
            className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"
          >
            {t(status)}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 [&>button]:rounded-lg [&>button]:border [&>button]:border-content/10 [&>button]:px-3 [&>button]:py-2">
          <button disabled={busy} onClick={() => close(false)}>
            {t("Cancel")}
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-black disabled:opacity-40"
            onClick={() => (success ? close(true) : void install())}
          >
            {t(success ? "Continue" : "Install now")}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
