import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "../../../shared/i18n";
import { Modal } from "../../../shared/ui/Modal";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { pluginText, type FormValues } from "../model/localPlugins";
import {
  answerPluginForm,
  expirePluginForms,
  pluginOperations,
  subscribePluginOperations,
  type PluginOperation,
} from "../model/pluginForms";

function PluginForm({
  operation,
  onComplete,
  sessionName,
}: {
  operation: PluginOperation;
  onComplete: (sessionId: string, operationId: string) => void;
  sessionName: string;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormValues>(operation.values);
  const [error, setError] = useState("");
  const fieldClass =
    "mt-1 w-full rounded-lg border border-content/15 bg-content/5 px-3 py-2 text-sm outline-none focus:border-content/40";
  return (
    <Modal
      title={pluginText(operation.tool.name)}
      description={`${pluginText(operation.plugin.name)} · ${sessionName}`}
      onClose={() => answerPluginForm(operation.id, null)}
      fitViewport
    >
      <form
        className="space-y-4 px-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            answerPluginForm(operation.id, values);
            onComplete(operation.sessionId, operation.id);
          } catch (reason) {
            setError(String(reason));
          }
        }}
      >
        <p className="text-sm leading-relaxed text-content/65">
          {pluginText(operation.tool.description)}
        </p>
        {operation.tool.fields.map((field) => (
          <label key={field.key} className="block text-sm">
            {pluginText(field.label)}
            {field.required && <span aria-hidden="true"> *</span>}
            {field.type === "switch" ? (
              <input
                type="checkbox"
                className="ml-3"
                checked={values[field.key] === true}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.checked })
                }
              />
            ) : field.type === "select" ? (
              <SettingsDropdown
                value={String(values[field.key] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
              >
                <option value="">{t("Choose…")}</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {pluginText(option.label)}
                  </option>
                ))}
              </SettingsDropdown>
            ) : field.type === "textarea" ? (
              <textarea
                required={field.required}
                maxLength={8000}
                className={`${fieldClass} min-h-24 resize-y`}
                value={String(values[field.key] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
              />
            ) : (
              <input
                required={field.required}
                maxLength={8000}
                className={fieldClass}
                value={String(values[field.key] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
              />
            )}
          </label>
        ))}
        <details className="rounded-lg bg-content/5 p-3 text-xs">
          <summary className="cursor-pointer">
            {t("Review workflow instructions")}
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans leading-relaxed text-content/65">
            {pluginText(operation.tool.instructions)}
          </pre>
        </details>
        <p className="text-xs text-content/55">
          {t(
            "Confirming sends these inputs back to this conversation. Existing file access and approval settings still apply.",
          )}
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => answerPluginForm(operation.id, null)}
          >
            {t("Cancel")}
          </SecondaryButton>
          <SecondaryButton type="submit">
            {t("Confirm and continue")}
          </SecondaryButton>
        </div>
      </form>
    </Modal>
  );
}
export function PluginFormHost({
  onComplete,
  sessionName,
}: {
  onComplete: (sessionId: string, operationId: string) => void;
  sessionName: (id: string) => string;
}) {
  const operations = useSyncExternalStore(
    subscribePluginOperations,
    pluginOperations,
    pluginOperations,
  );
  useEffect(() => {
    const timer = setInterval(() => expirePluginForms(), 1000);
    return () => clearInterval(timer);
  }, []);
  const operation = operations.find((op) => op.status === "waiting");
  return operation ? (
    <PluginForm
      key={operation.id}
      operation={operation}
      onComplete={onComplete}
      sessionName={sessionName(operation.sessionId)}
    />
  ) : null;
}
