import { localizedError } from "../../../shared/lib/localizedError";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { Modal } from "../../../shared/ui/Modal";
import { inspectAcpEngine } from "../../../integrations/harness/providers/acp/acpEngine";
import { pickFolder } from "../../../platform/tauri/fs";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import {
  refreshAcpEngines,
  saveAcpEngine,
  removeAcpEngine,
  setAcpEngineEnabled,
  engineName,
  type AcpEngine,
} from "../model/acpEngines";

const example = JSON.stringify(
  {
    id: "my-agent",
    name: "My agent",
    nameZh: "我的智能体",
    version: "1.0.0",
    command: "C:\\Tools\\agent.exe",
    args: ["acp"],
    models: [{ id: "default", name: "Default" }],
    accounts: ["default"],
    enabled: true,
  },
  null,
  2,
);
export function AcpEnginesPanel() {
  const { t } = useTranslation();
  const [engines, setEngines] = useState<AcpEngine[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspected, setInspected] = useState<{
    engine: AcpEngine;
    account: string;
    authMethods: { id: string; name: string }[];
    models: AcpEngine["models"];
    error: string;
    cwd: string;
  } | null>(null);
  const inspect = async (
    engine: AcpEngine,
    account: string,
    folder?: string,
  ) => {
    const cwd = folder || (await pickFolder());
    if (!cwd) return;
    setBusy(true);
    setError("");
    try {
      setInspected({
        engine,
        account,
        cwd,
        ...(await inspectAcpEngine(engine, account, cwd)),
      });
    } catch (e) {
      setError(localizedError(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void refreshAcpEngines()
      .then(setEngines)
      .catch((e) => setError(localizedError(e)));
  }, []);
  const run = async (work: () => Promise<AcpEngine[]>) => {
    setBusy(true);
    setError("");
    try {
      setEngines(await work());
      setDraft(null);
    } catch (e) {
      setError(localizedError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mb-6 space-y-3 rounded-xl border border-content/10 bg-content/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("ACP plugin engines")}</h2>
        <div className="flex gap-2">
          <SecondaryButton
            disabled={busy}
            onClick={() => void run(refreshAcpEngines)}
          >
            {t("Refresh")}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => {
              setDraft(example);
              setError("");
            }}
          >
            {t("Add ACP engine")}
          </SecondaryButton>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-content/60">
        {t(
          "Approved local ACP programs appear in the model picker. Each account uses its own home directory. Removing an engine retains its credentials and history.",
        )}
      </p>
      {!engines.length && (
        <p className="py-3 text-center text-xs text-content/45">
          {t("No ACP engines installed")}
        </p>
      )}
      {engines.map((engine) => (
        <details
          key={engine.id}
          className="rounded-lg border border-content/10 bg-content/5"
        >
          <summary className="cursor-pointer px-3 py-2 text-sm">
            {engineName(engine)}{" "}
            <span className="text-xs text-content/45">
              v{engine.version} · {t(engine.enabled ? "Enabled" : "Disabled")}
            </span>
          </summary>
          <div className="space-y-2 border-t border-content/10 p-3 text-xs">
            <p className="break-all text-content/60">{engine.command}</p>
            <p>
              {t("Models")}: {engine.models.map((m) => m.name).join(" · ")}
            </p>
            <p>
              {t("Accounts")}: {engine.accounts.join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {engine.accounts.map((account) => (
                <SecondaryButton
                  key={account}
                  disabled={busy || !engine.enabled}
                  onClick={() => void inspect(engine, account)}
                >
                  {t("Sign in and discover models")} · {account}
                </SecondaryButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                disabled={busy}
                onClick={() => {
                  const {
                    revision: _revision,
                    integrity: _integrity,
                    ...manifest
                  } = engine;
                  setDraft(JSON.stringify(manifest, null, 2));
                }}
              >
                {t("Edit and approve update")}
              </SecondaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    setAcpEngineEnabled(engine.id, !engine.enabled),
                  )
                }
              >
                {t(engine.enabled ? "Disable" : "Enable")}
              </SecondaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() => void run(() => removeAcpEngine(engine.id))}
              >
                {t("Remove")}
              </SecondaryButton>
            </div>
          </div>
        </details>
      ))}
      {error && (
        <p role="alert" className="break-words text-xs text-red-500">
          {error}
        </p>
      )}
      {inspected && (
        <Modal
          title={t("ACP authentication and models")}
          fitViewport
          size="lg"
          onClose={() => !busy && setInspected(null)}
        >
          <div className="space-y-4 p-5">
            <p className="text-sm">
              {engineName(inspected.engine)} · {inspected.account}
            </p>
            <p className="text-xs text-content/60">
              {t(
                "Discovery starts a temporary engine session without sending a prompt. Choose an advertised sign-in method if authentication is required.",
              )}
            </p>
            <SettingsDropdown
              disabled={busy}
              aria-label={t("Authentication method")}
              value={inspected.engine.authMethodId || ""}
              onChange={(e) =>
                setInspected({
                  ...inspected,
                  engine: {
                    ...inspected.engine,
                    authMethodId: e.target.value || undefined,
                  },
                })
              }
            >
              <option value="">{t("Use existing sign-in")}</option>
              {inspected.authMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </SettingsDropdown>
            {inspected.error && (
              <p className="break-words text-xs text-red-500">
                {inspected.error}
              </p>
            )}
            <ul className="max-h-52 overflow-y-auto rounded-lg bg-content/5 p-3 text-xs">
              {inspected.models.map((model) => (
                <li key={model.id} className="py-1">
                  {model.name}{" "}
                  <span className="text-content/50">{model.id}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  void inspect(
                    inspected.engine,
                    inspected.account,
                    inspected.cwd,
                  )
                }
              >
                {t(busy ? "Connecting…" : "Sign in and refresh")}
              </SecondaryButton>
              <SecondaryButton
                disabled={busy || !inspected.models.length}
                onClick={() => {
                  setDraft(
                    JSON.stringify(
                      { ...inspected.engine, models: inspected.models },
                      null,
                      2,
                    ),
                  );
                  setInspected(null);
                }}
              >
                {t("Review and save discovered models")}
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}
      {draft !== null && (
        <Modal
          title={t("Review ACP engine permissions")}
          fitViewport
          size="lg"
          onClose={() => !busy && setDraft(null)}
        >
          <div className="space-y-4 p-5">
            <h3 className="font-medium">
              {t("Review ACP engine permissions")}
            </h3>
            <p className="text-xs leading-relaxed text-content/60">
              {t(
                "This program runs locally with your user permissions. Review its executable, arguments, models and account names. Approval records the executable hash; changed programs require approval again.",
              )}
            </p>
            <textarea
              aria-label={t("ACP engine manifest")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="h-72 w-full rounded-lg border border-content/15 bg-content/5 p-3 font-mono text-xs outline-none"
            />
            <p className="text-xs text-content/60">
              {t(
                "Use absolute paths for the executable and entry scripts. Account names create isolated profiles; authenticate through the engine on its first conversation.",
              )}
            </p>
            {error && (
              <p role="alert" className="break-words text-xs text-red-500">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <SecondaryButton disabled={busy} onClick={() => setDraft(null)}>
                {t("Cancel")}
              </SecondaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  void run(() => saveAcpEngine(JSON.parse(draft) as AcpEngine))
                }
              >
                {t(busy ? "Saving…" : "Approve and install")}
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
