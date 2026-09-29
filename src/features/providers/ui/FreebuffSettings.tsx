import { useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { TerminalView } from "../../terminal/ui/TerminalView";
import {
  inspectHarnessBinary,
  resolveHarnessBinary,
} from "../../../integrations/harness/core/child";
import { applyProviderBinaryPath } from "../model/providerBinaryPaths";
import { useTranslation } from "../../../shared/i18n";
import { IS_WIN } from "../../../platform/tauri/platform";
export function FreebuffSettings({ cwd }: { cwd?: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const [terminal, setTerminal] = useState<{
    id: string;
    cwd: string;
    command: string;
  } | null>(null);
  const run = async (action: "check" | "install" | "open") => {
    setBusy(true);
    setStatus("");
    try {
      if (action === "install") {
        const path = await invoke<string>("managed_cli_install", {
          provider: "freebuff",
        });
        if (!(await applyProviderBinaryPath("freebuff", path)))
          throw Error("Could not save the binary path.");
        const info = await inspectHarnessBinary("freebuff", path);
        if (!info.version)
          throw Error(info.error || "CLI returned no valid version.");
        setStatus(`${t("Installation successful")} · ${info.version}`);
      } else if (action === "check") {
        const installed = await inspectHarnessBinary("freebuff").catch(
          () => null,
        );
        const latest = await invoke<{ version: string }>("managed_cli_latest", {
          provider: "freebuff",
        });
        setStatus(
          `${t("Installed")}: ${installed?.version || t("Not installed")} · ${t("Latest")}: ${latest.version}`,
        );
      } else {
        const folder =
          cwd ||
          (await open({
            directory: true,
            multiple: false,
            title: t("Choose workspace folder"),
          }));
        if (typeof folder !== "string") return;
        const { path } = await resolveHarnessBinary("freebuff");
        // Fixed platform shell; quote the executable as a literal, never code.
        const command = IS_WIN
          ? `& '${path.replace(/'/g, "''")}'`
          : `'${path.replace(/'/g, "'\\''")}'`;
        setTerminal({ id: crypto.randomUUID(), cwd: folder, command });
      }
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 py-5">
      <h3 className="text-sm font-semibold">Freebuff</h3>
      <p className="text-xs text-content/60">
        {t(
          "Freebuff runs in its official interactive terminal. Its CLI does not expose a headless chat protocol; models and login are managed in that terminal.",
        )}
      </p>
      <div className="flex gap-3 text-xs">
        {(["check", "install", "open"] as const).map((action, i) => (
          <button
            disabled={busy}
            key={action}
            className="rounded-lg bg-content/10 px-3 py-2 disabled:opacity-40"
            onClick={() => void run(action)}
          >
            {t(
              [
                "Check version",
                "Install / update in MyCode",
                "Open Freebuff terminal",
              ][i],
            )}
          </button>
        ))}
      </div>
      {busy && <progress aria-label={t("Working…")} className="w-full" />}
      {status && (
        <p role="status" className="break-words text-xs">
          {t(status)}
        </p>
      )}
      {terminal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-surface p-4">
            <header className="mb-3 flex justify-between">
              <span>Freebuff · {terminal.cwd}</span>
              <button onClick={() => setTerminal(null)}>{t("Close")}</button>
            </header>
            <div className="min-h-0 flex-1">
              <TerminalView
                id={terminal.id}
                cwd={terminal.cwd}
                active
                initialCommand={terminal.command}
              />
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
