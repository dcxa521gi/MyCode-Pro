import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  HARNESSES,
  HARNESS_TITLE,
  type HarnessId,
} from "../../sessions/model/session";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import { compareSemver } from "../../../integrations/harness/providers/opencode/opencodeProtocol";
import { useTranslation } from "../../../shared/i18n";
import { ArrowDownCircle, X } from "../../../shared/ui/icons";

let startupCheck: Promise<HarnessId[]> | undefined;
export function CLIUpdateNotice({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const [updates, setUpdates] = useState<HarnessId[]>([]);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    startupCheck ??= (async () => {
      const updates: HarnessId[] = [];
      // Bound concurrency: version checks can start a vendor runtime.
      const pending = [...HARNESSES];
      const worker = async () => {
        while (pending.length) {
          const provider = pending.shift()!;
          try {
            const current = await inspectHarnessBinary(provider);
            const installed = current.version?.match(/\d+\.\d+\.\d+/)?.[0];
            if (!installed || current.error) continue;
            const latest = await invoke<{ version: string }>(
              "managed_cli_latest",
              { provider },
            );
            const version = latest.version.match(/\d+\.\d+\.\d+/)?.[0];
            if (version && compareSemver(version, installed) > 0)
              updates.push(provider);
          } catch {
            /* An offline probe does not interrupt startup. Manual retry remains available. */
          }
        }
      };
      await Promise.all([worker(), worker()]);
      return updates;
    })();
    void startupCheck.then((next) => {
      if (active) setUpdates(next);
    });
    return () => {
      active = false;
    };
  }, []);
  if (!updates.length) return null;
  return (
    <aside
      role="status"
      className="fixed bottom-12 right-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border border-content/10 bg-surface p-4 shadow-xl"
    >
      <ArrowDownCircle size={18} className="mt-1 shrink-0 text-accent" />
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          setUpdates([]);
          onOpen();
        }}
      >
        <strong className="text-sm">{t("CLI updates available")}</strong>
        <p className="mt-1 text-xs text-content/60">
          {updates.map((id) => HARNESS_TITLE[id]).join(" · ")}
        </p>
        <p className="mt-2 text-xs text-accent">{t("Open CLI agent tools")}</p>
      </button>
      <button
        aria-label={t("Dismiss")}
        className="rounded-md p-1 hover:bg-content/10"
        onClick={() => setUpdates([])}
      >
        <X size={14} />
      </button>
    </aside>
  );
}
