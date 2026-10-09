import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatMessage, useTranslation } from "../../../shared/i18n";
import { compareCliVersions } from "../model/cliVersion";
import { cliErrorMessage } from "../model/cliErrors";
import {
  applyProviderBinaryPath,
  loadProviderBinaryPath,
} from "../model/providerBinaryPaths";
import { probeHarnessAvailability } from "../../../integrations/harness/core/availability";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import type { ConfigurableBinaryProvider } from "../model/providerBinaryPaths";
import {
  checkCLIVersion,
  invalidateCLIVersion,
  useCLIVersion,
} from "../model/cliVersions";
import { ArrowDownCircle, Loader } from "../../../shared/ui/icons";
import { refreshPiCatalog } from "../../../integrations/harness/providers/pi/piCatalog";
export function ManagedCLIControls({
  provider,
}: {
  provider: ConfigurableBinaryProvider;
}) {
  const { t } = useTranslation();
  const version = useCLIVersion(provider);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState(
    () => localStorage.getItem("mycode.cliScope." + provider) || "app",
  );
  useEffect(() => {
    let timer: number | undefined;
    const syncScope = () => {
      // Path activation emits before the updater records its selected scope.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setScope(localStorage.getItem("mycode.cliScope." + provider) || "app");
      }, 0);
    };
    window.addEventListener("mycode-cli-paths-changed", syncScope);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mycode-cli-paths-changed", syncScope);
    };
  }, [provider]);
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
      if (install) {
        const path = await invoke<string>("managed_cli_install", { provider });
        const verified = await inspectHarnessBinary(provider, path);
        if (!verified.version)
          throw Error(verified.error || t("CLI returned no valid version."));
        if (version.latest) {
          const comparison = compareCliVersions(
            verified.version,
            version.latest,
          );
          if (comparison === null || comparison > 0)
            throw Error(
              formatMessage("Installed CLI did not reach version {version}.", {
                version: version.latest,
              }),
            );
        }
        if (!(await applyProviderBinaryPath(provider, path)))
          throw Error(t("Could not save the binary path."));
        localStorage.setItem("mycode.appCliPath." + provider, path);
        localStorage.setItem("mycode.cliScope." + provider, "app");
        setScope("app");
        await probeHarnessAvailability({ force: true });
        if (provider === "pi") await refreshPiCatalog();
        invalidateCLIVersion(provider);
        await checkCLIVersion(provider, true);
        setStatus(t("Installed in MyCode. New sessions use this version."));
      } else {
        await checkCLIVersion(provider, true);
      }
    } catch (error) {
      setStatus(`${t("CLI operation failed.")} ${cliErrorMessage(error)}`);
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
        disabled={
          busy || ["idle", "checking", "current"].includes(version.phase)
        }
        title={t(
          version.phase === "current"
            ? "No new version"
            : version.phase === "error"
              ? "Retry check"
              : "Install / update in MyCode",
        )}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-accent disabled:cursor-default disabled:bg-content/5 disabled:text-content/35"
        onClick={() => void run(version.phase !== "error")}
      >
        {busy || ["idle", "checking"].includes(version.phase) ? (
          <Loader className="size-3 animate-spin" />
        ) : version.phase === "update" ? (
          <ArrowDownCircle className="size-3.5" aria-hidden />
        ) : null}
        {t(
          busy
            ? "Working…"
            : version.phase === "missing"
              ? "Install"
              : version.phase === "update"
                ? "Update"
                : version.phase === "current"
                  ? "No new version"
                  : version.phase === "error"
                    ? "Retry check"
                    : "Checking version…",
        )}
      </button>
      {version.phase === "update" && (
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
          {t("New version")} · {version.latest}
        </span>
      )}
      {version.phase === "error" && (
        <span
          role="status"
          className="max-w-72 text-content/50 [overflow-wrap:anywhere]"
        >
          {t("Version check failed")} · {t(version.error || "Unknown")}
        </span>
      )}
      {version.installed && (
        <span
          title={version.installed}
          className="max-w-48 truncate text-content/45"
        >
          {t("Installed")}: {version.installed.split("\n")[0]}
        </span>
      )}
      {status && (
        <span role="status" className="max-w-80 text-content/50">
          {status}
        </span>
      )}
    </span>
  );
}
