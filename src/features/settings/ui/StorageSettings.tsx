import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { pickFolder } from "../../../platform/tauri/fs";
import { useTranslation } from "../../../shared/i18n";
import { useWorkMode } from "../model/workMode";

export function StorageSettings() {
  const { t } = useTranslation();
  const mode = useWorkMode();
  const [workspace, setWorkspace] = useState("");
  const [cache, setCache] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void invoke<string>("default_workspace")
      .then((p) => {
        if (active) setWorkspace(p);
      })
      .catch((e) => setError(String(e)));
    void invoke<string>("cache_location")
      .then((p) => {
        if (active) setCache(p);
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
    };
  }, [mode]);
  const choose = async (kind: "workspace" | "cache") => {
    try {
      const folder = await pickFolder(t("Choose folder"));
      if (!folder) return;
      if (kind === "workspace") {
        const saved = await invoke<string>("workspace_set_location", { folder });
        localStorage.setItem(`mycode.defaultWorkspace.${mode}`, saved);
        setWorkspace(saved);
      } else setCache(await invoke<string>("cache_set_location", { folder }));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <section className="mb-8 space-y-5">
      <h2 className="font-medium">{t("Storage locations")}</h2>
      {(
        [
          ["workspace", "Default workspace folder", workspace],
          ["cache", "Cache folder", cache],
        ] as const
      ).map(([kind, label, value]) => (
        <div key={kind} className="flex items-center gap-3 text-sm">
          <div className="min-w-0 flex-1">
            <div>
              {t(label)}
              {kind === "workspace"
                ? ` · ${t(mode === "office" ? "Office" : "Development")}`
                : ""}
            </div>
            <div className="mt-1 break-all text-xs text-content/50">
              {value || t("Loading…")}
            </div>
          </div>
          <button
            className="rounded-lg bg-content/5 px-3 py-2"
            onClick={() => void choose(kind)}
          >
            {t("Change folder")}
          </button>
        </div>
      ))}
      <p className="text-xs text-content/50">
        {t(
          "The cache folder stores new temporary attachments and screenshots. Existing files remain available in their original location. Account and conversation data stay in the application data folder.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
