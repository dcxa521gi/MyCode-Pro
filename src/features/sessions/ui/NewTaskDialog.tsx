import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../../shared/ui/Modal";
import { useTranslation } from "../../../shared/i18n";
import { pickFolder } from "../../../platform/tauri/fs";
import { HARNESSES, HARNESS_TITLE, type HarnessId } from "../model/session";
import {
  defaultSessionChoice,
  modelsFor,
  preferredModelId,
  subscribeModels,
  getModelSnapshot,
} from "../model/models";
import { useWorkMode } from "../../settings/model/workMode";

export function NewTaskDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (cwd: string, harness: HarnessId, model: string) => void;
}) {
  const { t } = useTranslation();
  const mode = useWorkMode();
  useSyncExternalStore(subscribeModels, getModelSnapshot);
  const [cwd, setCwd] = useState(
    () => localStorage.getItem(`mycode.defaultWorkspace.${mode}`) ?? "",
  );
  const [choice, setChoice] = useState(() => defaultSessionChoice());
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (cwd) return;
    let live = true;
    void invoke<string>("default_workspace")
      .then((path) => {
        if (live) setCwd(path);
      })
      .catch(() => {
        if (live) setError("Choose a workspace folder to continue.");
      });
    return () => {
      live = false;
    };
  }, [cwd]);
  const models = modelsFor(choice.harness);
  const selectedModel = models.some((model) => model.id === choice.model)
    ? choice.model
    : preferredModelId(choice.harness);
  const field =
    "w-full rounded-lg bg-content/5 px-3 py-3 text-sm outline-none focus:ring-1 focus:ring-accent";
  return (
    <Modal title={t("New task")} onClose={onClose}>
      <div className="space-y-5 p-5">
        <div className="flex gap-2 text-xs">
          {["Workspace folder", "Agent", "Model"].map((label, index) => (
            <button
              key={label}
              className={`rounded-full px-3 py-1 ${step === index ? "bg-accent text-black" : "bg-content/5"}`}
              disabled={index > step && !cwd}
              onClick={() => setStep(index)}
            >
              {index + 1}. {t(label)}
            </button>
          ))}
        </div>
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-content/60">
              {t(
                mode === "office"
                  ? "Choose where to save documents and office tasks."
                  : "Choose the working folder for this task.",
              )}
            </p>
            <div className="break-all rounded-lg bg-content/5 p-3 text-sm">
              {cwd || t("Choose workspace folder")}
            </div>
            <button
              className="rounded-lg bg-content/10 px-3 py-2 text-sm"
              onClick={() =>
                void pickFolder(t("Choose workspace folder"))
                  .then((path) => {
                    if (path) {
                      setCwd(path);
                      setError("");
                    }
                  })
                  .catch(() => setError("Could not open the folder picker."))
              }
            >
              {t("Change folder")}
            </button>
            <p className="text-xs text-content/45">
              {t(
                "This folder becomes the default for new tasks in this work mode.",
              )}
            </p>
          </div>
        )}
        {step === 1 && (
          <label className="block space-y-2 text-sm">
            <span>{t("Agent")}</span>
            <select
              className={field}
              value={choice.harness}
              onChange={(event) => {
                const harness = event.target.value as HarnessId;
                setChoice({ harness, model: preferredModelId(harness) });
              }}
            >
              {HARNESSES.map((harness) => (
                <option key={harness} value={harness}>
                  {HARNESS_TITLE[harness]}
                </option>
              ))}
            </select>
          </label>
        )}
        {step === 2 && (
          <label className="block space-y-2 text-sm">
            <span>{t("Model")}</span>
            <select
              className={field}
              value={selectedModel}
              onChange={(event) =>
                setChoice({ ...choice, model: event.target.value })
              }
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.primary ? "★ " : ""}
                  {model.provider?.name ? `${model.provider.name} · ` : ""}
                  {t(model.name)}
                </option>
              ))}
            </select>
            <p className="text-xs text-content/45">
              {t(
                "The primary provider model is preferred. Official models remain available for this agent.",
              )}
            </p>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {t(error)}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={step ? () => setStep(step - 1) : onClose}>
            {t(step ? "Back" : "Cancel")}
          </button>
          <button
            className="rounded-lg bg-accent px-4 py-2 text-black disabled:opacity-40"
            disabled={!cwd || (step === 2 && !models.length)}
            onClick={() => {
              if (step < 2) setStep(step + 1);
              else {
                localStorage.setItem(`mycode.defaultWorkspace.${mode}`, cwd);
                onCreate(cwd, choice.harness, selectedModel);
              }
            }}
          >
            {t(step === 2 ? "Create task" : "Continue")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
