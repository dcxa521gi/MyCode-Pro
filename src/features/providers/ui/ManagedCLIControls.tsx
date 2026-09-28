import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { applyProviderBinaryPath } from "../model/providerBinaryPaths";
import { probeHarnessAvailability } from "../../../integrations/harness/core/availability";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import type { HarnessId } from "../../sessions/model/session";
import { refreshPiCatalog } from "../../../integrations/harness/providers/pi/piCatalog";
export function ManagedCLIControls({ provider }: { provider: HarnessId }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  if (!["claude", "codex", "pi", "opencode"].includes(provider)) return null;
  const run = async (install: boolean) => {
    setBusy(true);
    setStatus("");
    try {
      if (install) {
        const path = await invoke<string>("managed_cli_install", { provider });
        if (!(await applyProviderBinaryPath(provider, path)))
          throw Error("Could not save the binary path.");
        await probeHarnessAvailability({ force: true });
        if (provider === "pi") await refreshPiCatalog();
        setStatus(t("Installed in MyCode. New sessions use this version."));
      } else {
        const latest = await invoke<{ version: string }>("managed_cli_latest", {
          provider,
        });
        const current = await inspectHarnessBinary(provider).catch(() => null);
        setStatus(
          `${t("Installed")}: ${current?.version ?? t("Not installed")} · ${t("Latest")}: ${latest.version}`,
        );
      }
    } catch {
      setStatus(t("CLI operation failed. Check network access and retry."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px] font-normal">
      <button
        disabled={busy}
        className="rounded-md border border-content/15 px-2 py-1 text-content/60 disabled:opacity-40"
        onClick={() => void run(false)}
      >
        {t("Check version")}
      </button>
      <button
        disabled={busy}
        className="rounded-md bg-accent/10 px-2 py-1 text-accent disabled:opacity-40"
        onClick={() => void run(true)}
      >
        {t(busy ? "Working…" : "Install / update in MyCode")}
      </button>
      {status && (
        <span role="status" className="max-w-80 text-content/50">
          {status}
        </span>
      )}
    </span>
  );
}
