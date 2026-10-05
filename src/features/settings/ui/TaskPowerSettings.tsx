import { SettingsSwitch } from "../../../shared/ui/SettingsSwitch";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
const KEY = "mycode.preventAppSleep",
  EVENT = "mycode:power-settings";
export function useTaskPower() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(KEY) !== "false",
  );
  useEffect(() => {
    const changed = () => setEnabled(localStorage.getItem(KEY) !== "false");
    window.addEventListener(EVENT, changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  // The app also serves remote requests while all sessions are idle.
  const busy = true;
  useEffect(() => {
    const sync = () =>
      void invoke<string | null>("power_sync", { enabled, busy })
        .then((error) =>
          window.dispatchEvent(
            new CustomEvent("mycode:power-status", { detail: error || "" }),
          ),
        )
        .catch(() =>
          window.dispatchEvent(
            new CustomEvent("mycode:power-status", {
              detail:
                "System wake lock is unavailable. Check system power permissions.",
            }),
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
  const [failed, setFailed] = useState("");
  useEffect(() => {
    const changed = (e: Event) => setFailed((e as CustomEvent<string>).detail);
    window.addEventListener("mycode:power-status", changed);
    return () => window.removeEventListener("mycode:power-status", changed);
  }, []);
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(KEY) !== "false",
  );
  return (
    <section className="rounded-xl border border-content/10 bg-content/[0.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <span>
          <strong className="block text-sm font-medium">
            {t("Prevent sleep while MyCode is open")}
          </strong>
          <span className="mt-1 block max-w-xl text-xs leading-relaxed text-content/50">
            {t(
              "Keep the computer awake while MyCode is open, including between tasks. The display may turn off. On Windows a temporary power plan disables lid sleep and the previous plan is restored when MyCode closes. Manual sleep, shutdown and network loss can still interrupt connections.",
            )}
          </span>
        </span>
        <SettingsSwitch
          label={t("Prevent sleep while MyCode is open")}
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
          {t(failed)}
        </p>
      )}
    </section>
  );
}
