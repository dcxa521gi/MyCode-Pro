import { SettingsSwitch } from "../../../shared/ui/SettingsSwitch";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import type { Session } from "../../sessions/model/session";
const KEY = "mycode.preventTaskSleep",
  EVENT = "mycode:power-settings";
export function useTaskPower(sessions: Session[]) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(KEY) === "true",
  );
  useEffect(() => {
    const changed = () => setEnabled(localStorage.getItem(KEY) === "true");
    window.addEventListener(EVENT, changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  const busy = sessions.some((s) => s.busy || !!s.backgroundTasks?.length);
  useEffect(() => {
    const sync = () =>
      void invoke<string | null>("power_sync", { enabled, busy })
        .then((error) =>
          window.dispatchEvent(
            new CustomEvent("mycode:power-status", { detail: !!error && busy }),
          ),
        )
        .catch(() =>
          window.dispatchEvent(
            new CustomEvent("mycode:power-status", { detail: busy }),
          ),
        );
    sync();
    const timer = enabled && busy ? setInterval(sync, 5000) : undefined;
    return () => {
      if (timer) clearInterval(timer);
      void invoke("power_sync", { enabled: false, busy: false }).catch(
        () => {},
      );
    };
  }, [enabled, busy]);
}
export function TaskPowerSettings() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const changed = (e: Event) => setFailed((e as CustomEvent<boolean>).detail);
    window.addEventListener("mycode:power-status", changed);
    return () => window.removeEventListener("mycode:power-status", changed);
  }, []);
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(KEY) === "true",
  );
  return (
    <section className="rounded-xl border border-content/10 bg-content/[0.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <span>
          <strong className="block text-sm font-medium">
            {t("Prevent sleep while tasks run")}
          </strong>
          <span className="mt-1 block max-w-xl text-xs leading-relaxed text-content/50">
            {t(
              "Keep the computer awake during agent tasks. The display may turn off. Release the wake lock when tasks finish. Manual sleep, shutdown and network loss still interrupt tasks.",
            )}
          </span>
        </span>
        <SettingsSwitch
          label={t("Prevent sleep while tasks run")}
          on={enabled}
          onChange={(value) => {
            setEnabled(value);
            localStorage.setItem(KEY, String(value));
            window.dispatchEvent(new Event(EVENT));
          }}
        />
      </div>
      {enabled && failed && (
        <p role="status" className="mt-2 text-xs text-content/60">
          {t(
            "System wake lock is unavailable. Check system power permissions.",
          )}
        </p>
      )}
    </section>
  );
}
