import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { IS_WIN } from "../../../platform/tauri/platform";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import {
  applyProviderBinaryPath,
  loadProviderBinaryPath,
} from "../model/providerBinaryPaths";
import { probeHarnessAvailability } from "../../../integrations/harness/core/availability";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import type { HarnessId } from "../../sessions/model/session";
import { refreshPiCatalog } from "../../../integrations/harness/providers/pi/piCatalog";
export function ManagedCLIControls({ provider }: { provider: HarnessId }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState(
    () => localStorage.getItem("mycode.cliScope." + provider) || "app",
  );
  const switchScope = async (next: string) => {
    if (busy || next === scope) return;
    setBusy(true);
    setStatus("");
    try {
      const key = "mycode.appCliPath." + provider;
      if (next === "global") {
        const current = loadProviderBinaryPath(provider);
        if (current) localStorage.setItem(key, current);
      }
      if (next === "app" && !localStorage.getItem(key))
        throw Error(
          t("Install a CLI in MyCode before switching to application scope."),
        );
      if (
        !(await applyProviderBinaryPath(
          provider,
          next === "global" ? null : localStorage.getItem(key),
        ))
      )
        throw Error(t("Could not save the binary path."));
      localStorage.setItem("mycode.cliScope." + provider, next);
      setScope(next);
      await probeHarnessAvailability({ force: true });
      setStatus(
        t(
          next === "global"
            ? "Using the CLI installed on this computer."
            : "Using the MyCode application CLI.",
        ),
      );
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };
  const run = async (install: boolean) => {
    setBusy(true);
    setStatus(t(install ? "Installing…" : "Checking installed version…"));
    try {
      if (
        install &&
        IS_WIN &&
        ["fx", "antigravity", "zcode"].includes(provider)
      ) {
        setStatus(
          t(
            provider === "zcode"
              ? "ZCode publishes a desktop installer only. Its CLI currently requires a source build; select an existing CLI executable below."
              : "This agent has no official Windows CLI release. Use a supported system or configure an existing compatible executable.",
          ),
        );
        return;
      }
      if (install) {
        const path = await invoke<string>("managed_cli_install", { provider });
        if (!(await applyProviderBinaryPath(provider, path)))
          throw Error("Could not save the binary path.");
        localStorage.setItem("mycode.appCliPath." + provider, path);
        localStorage.setItem("mycode.cliScope." + provider, "app");
        setScope("app");
        await probeHarnessAvailability({ force: true });
        if (provider === "pi") await refreshPiCatalog();
        setStatus(t("Installed in MyCode. New sessions use this version."));
      } else {
        const current = await inspectHarnessBinary(provider).catch(() => null);
        const installed = `${t("Installed")}: ${current?.version ?? t("Not installed")}`;
        setStatus(`${installed} · ${t("Checking latest version…")}`);
        const latest = await invoke<{ version: string }>("managed_cli_latest", {
          provider,
        }).catch((error) => {
          setStatus(`${installed} · ${String(error)}`);
          return null;
        });
        if (!latest) return;
        setStatus(
          `${t("Installed")}: ${current?.version ?? t("Not installed")} · ${t("Latest")}: ${latest.version}`,
        );
      }
    } catch (error) {
      setStatus(`${t("CLI operation failed.")} ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px] font-normal">
      <SettingsDropdown
        aria-label={t("CLI scope")}
        disabled={busy}
        value={scope}
        onChange={(event) => void switchScope(event.target.value)}
        className="rounded-md border border-content/15 px-2 py-1"
      >
        <option value="app">{t("MyCode app")}</option>
        <option value="global">{t("Global (this computer)")}</option>
      </SettingsDropdown>
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
