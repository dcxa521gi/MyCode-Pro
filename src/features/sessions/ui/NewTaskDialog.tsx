import { defaultWorkspace } from "../../../platform/tauri/workspace";
import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../../shared/ui/Modal";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";
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

export function NewTaskDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (cwd: string, harness: HarnessId, model: string) => void;
}) {
  const { t } = useTranslation();
  useSyncExternalStore(subscribeModels, getModelSnapshot);
  const [parent, setParent] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [choice, setChoice] = useState(defaultSessionChoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void defaultWorkspace()
      .then((path) => {
        if (live) setParent(path);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, []);
  const models = modelsFor(choice.harness);
  const selectedModel = models.some((m) => m.id === choice.model)
    ? choice.model
    : preferredModelId(choice.harness);
  const field =
    "w-full rounded-xl bg-content/5 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-accent";
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const cwd =
        source ||
        (await invoke<string>("create_project_folder", {
          parent,
          name: name.trim(),
        }));
      onCreate(cwd, choice.harness, selectedModel);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("Create project")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="block space-y-2 text-sm">
          <span>{t("Project name")}</span>
          <input
            autoFocus
            className={field}
            value={name}
            placeholder={t("Project name")}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="space-y-2 text-sm">
          <span>{t("Source folder")}</span>
          <div className="rounded-xl bg-content/5 p-5 text-center">
            <p className="mb-3 break-all text-xs text-content/60">
              {source || parent || t("Loading…")}
            </p>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-content/10 px-4 py-2 hover:bg-content/15"
              onClick={() =>
                void pickFolder(t("Choose workspace folder"))
                  .then((path) => {
                    if (path) {
                      setSource(path);
                      if (!name)
                        setName(
                          path.replace(/\\/g, "/").split("/").pop() || "",
                        );
                    }
                  })
                  .catch((e) => setError(String(e)))
              }
            >
              {t("Add folder")}
            </button>
            {source && (
              <button
                type="button"
                className="ml-3 text-xs text-content/60 underline"
                onClick={() => setSource("")}
              >
                {t("Create a folder in the default workspace")}
              </button>
            )}
          </div>
          <p className="break-all text-xs text-content/50">
            {source
              ? t("Use the selected folder")
              : `${t("Create a folder in the default workspace")} · ${parent}/${name.trim()}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2 text-sm">
            <span>{t("Agent")}</span>
            <select
              className={field}
              value={choice.harness}
              disabled={busy}
              onChange={(e) => {
                const harness = e.target.value as HarnessId;
                setChoice({ harness, model: preferredModelId(harness) });
              }}
            >
              {HARNESSES.map((h) => (
                <option key={h} value={h}>
                  {HARNESS_TITLE[h]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>{t("Model")}</span>
            <select
              className={field}
              value={selectedModel}
              disabled={busy}
              onChange={(e) => setChoice({ ...choice, model: e.target.value })}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.primary ? "★ " : ""}
                  {m.provider?.name ? `${m.provider.name} · ` : ""}
                  {t(m.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="break-words text-sm text-red-400">
            {t(error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm hover:bg-content/5"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={
              busy || (!source && (!parent || !name.trim())) || !models.length
            }
            className="rounded-xl bg-accent px-4 py-2 text-sm text-black disabled:opacity-40"
          >
            {busy ? (
              <BusyIndicator label={t("Creating…")} />
            ) : (
              t("Create project")
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
