import { useEffect, useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { Modal } from "../../../shared/ui/Modal";
import {
  localPlugins,
  parseLocalPlugin,
  pluginText,
  saveLocalPlugins,
  subscribeLocalPlugins,
  type LocalPlugin,
} from "../model/localPlugins";

export function LocalPluginsPanel() {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState(localPlugins);
  const [candidate, setCandidate] = useState<LocalPlugin | null>(null);
  const [error, setError] = useState("");
  useEffect(() => subscribeLocalPlugins(() => setPlugins(localPlugins())), []);
  const save = (next: LocalPlugin[]) => {
    try {
      saveLocalPlugins(next);
      setError("");
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    }
  };
  return (
    <section className="mb-6 space-y-3 rounded-xl border border-content/10 bg-content/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("Local workflow plugins")}</h2>
        <label className="cursor-pointer rounded-md border border-content/15 px-3 py-1.5 text-xs hover:bg-content/10">
          {t("Import plugin manifest")}
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                if (file.size > 256_000)
                  throw Error(t("Local plugin manifest is too large"));
                setCandidate(parseLocalPlugin(JSON.parse(await file.text())));
                setError("");
              } catch (reason) {
                setError(String(reason));
              }
            }}
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-content/60">
        {t(
          "Install local named workflows with native input forms. Workflow plugins supply instructions to your existing agents; they do not install provider engines or execute embedded code.",
        )}
      </p>
      <p className="text-xs leading-relaxed text-content/60">
        {t(
          "In a conversation, use /operator and ask the agent to list plugins.list, request plugins.run, and read plugins.result after you confirm the form.",
        )}
      </p>
      {plugins.length === 0 && (
        <p className="py-3 text-center text-xs text-content/45">
          {t("No local workflow plugins installed")}
        </p>
      )}
      {plugins.map((plugin) => (
        <details
          key={plugin.id}
          className="rounded-lg border border-content/10 bg-content/5"
        >
          <summary className="cursor-pointer px-3 py-2 text-sm">
            {pluginText(plugin.name)}{" "}
            <span className="text-xs text-content/45">
              v{plugin.version} · {t(plugin.enabled ? "Enabled" : "Disabled")}
            </span>
          </summary>
          <div className="space-y-3 border-t border-content/10 p-3">
            <p className="text-xs text-content/65">
              {pluginText(plugin.description)}
            </p>
            {plugin.tools.map((tool) => (
              <div
                key={tool.id}
                className="rounded-md bg-content/5 p-2 text-xs"
              >
                <strong>{pluginText(tool.name)}</strong>
                <code className="ml-2 text-content/50">
                  {plugin.id}/{tool.id}
                </code>
                <p className="mt-1 text-content/60">
                  {pluginText(tool.description)}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer">
                    {t("Review workflow instructions")}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap">
                    {pluginText(tool.instructions)}
                  </p>
                </details>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <SecondaryButton
                onClick={() =>
                  save(
                    plugins.map((p) =>
                      p.id === plugin.id ? { ...p, enabled: !p.enabled } : p,
                    ),
                  )
                }
              >
                {t(plugin.enabled ? "Disable" : "Enable")}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => save(plugins.filter((p) => p.id !== plugin.id))}
              >
                {t("Uninstall")}
              </SecondaryButton>
            </div>
          </div>
        </details>
      ))}
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}
      {candidate && (
        <Modal
          title={t("Review local plugin")}
          onClose={() => setCandidate(null)}
          fitViewport
        >
          <div className="space-y-4 px-4 pb-4">
            <h3 className="font-medium">
              {pluginText(candidate.name)} · {candidate.version}
            </h3>
            <p className="text-sm text-content/65">
              {pluginText(candidate.description)}
            </p>
            {candidate.tools.map((tool) => (
              <div key={tool.id} className="rounded-lg bg-content/5 p-3">
                <strong className="text-sm">{pluginText(tool.name)}</strong>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-content/65">
                  {pluginText(tool.instructions)}
                </pre>
              </div>
            ))}
            <p className="text-xs text-content/60">
              {t(
                "Each invocation asks you to review its form. An update replaces only this plugin's manifest; provider credentials and conversation history are unchanged.",
              )}
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setCandidate(null)}>
                {t("Cancel")}
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  if (
                    save([
                      ...plugins.filter((p) => p.id !== candidate.id),
                      { ...candidate, enabled: false },
                    ])
                  )
                    setCandidate(null);
                }}
              >
                {t(
                  plugins.some((p) => p.id === candidate.id)
                    ? "Update plugin"
                    : "Install plugin",
                )}
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
