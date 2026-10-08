import { listen } from "@tauri-apps/api/event";
import { probeHarnessAvailability } from "../../../integrations/harness/core/availability";
import { refreshHarnessCatalogs } from "../../../integrations/harness/core/registry";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HARNESSES, HARNESS_TITLE } from "../../sessions/model/session";
import {
  checkCLIVersion,
  cliState,
  invalidateCLIVersion,
  subscribeCLIVersions,
} from "../model/cliVersions";
import { useTranslation } from "../../../shared/i18n";
import { ArrowDownCircle, X } from "../../../shared/ui/icons";

const CLI_PROVIDERS = [...HARNESSES, "freebuff"] as const;
const CLI_TITLES = { ...HARNESS_TITLE, freebuff: "Freebuff" };
let startupCheck: Promise<void> | undefined;
export function CLIUpdateNotice({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const signature = useSyncExternalStore(subscribeCLIVersions, () =>
    CLI_PROVIDERS.filter((id) => cliState(id).phase === "update")
      .map((id) => `${id}:${cliState(id).latest}`)
      .join("|"),
  );
  const [dismissed, setDismissed] = useState("");
  const [ready, setReady] = useState(false);
  const updates = CLI_PROVIDERS.filter((id) => cliState(id).phase === "update");
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void listen<string>("mycode-cli-updated", (event) => {
      const provider = event.payload as (typeof CLI_PROVIDERS)[number];
      if (CLI_PROVIDERS.includes(provider)) invalidateCLIVersion(provider);
      void probeHarnessAvailability({ force: true }).catch(() => {});
      void refreshHarnessCatalogs(HARNESSES).catch(() => {});
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    startupCheck ??= (async () => {
      // Bound concurrency: version checks can start a vendor runtime.
      const pending = [...CLI_PROVIDERS];
      const worker = async () => {
        while (pending.length) {
          const provider = pending.shift()!;
          try {
            await checkCLIVersion(provider);
          } catch {
            /* An offline probe does not interrupt startup. Manual retry remains available. */
          }
        }
      };
      await Promise.all([worker(), worker()]);
    })();
    void startupCheck.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  if (!ready || !updates.length || dismissed === signature) return null;
  return (
    <aside
      role="status"
      className="fixed bottom-12 right-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border border-content/10 bg-surface p-4 shadow-xl"
    >
      <ArrowDownCircle size={18} className="mt-1 shrink-0 text-accent" />
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          setDismissed(signature);
          onOpen();
        }}
      >
        <strong className="text-sm">{t("CLI updates available")}</strong>
        <p className="mt-1 text-xs text-content/60">
          {updates.map((id) => CLI_TITLES[id]).join(" · ")}
        </p>
        <p className="mt-2 text-xs text-accent">{t("Open CLI agent tools")}</p>
      </button>
      <button
        aria-label={t("Dismiss")}
        className="rounded-md p-1 hover:bg-content/10"
        onClick={() => setDismissed(signature)}
      >
        <X size={14} />
      </button>
    </aside>
  );
}
