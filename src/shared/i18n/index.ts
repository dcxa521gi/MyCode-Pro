import { useSyncExternalStore } from "react";
import zhCN from "./zh-CN.json";

export type Locale = "en" | "zh-CN";
export type LanguagePreference = "auto" | Locale;
export const LANGUAGE_KEY = "monocode.language";
const listeners = new Set<() => void>();
let preference: LanguagePreference = "auto";
let locale: Locale = "en";
let initialized = false;

/** Use named regions, never UTC offsets: Singapore and Shanghai share UTC+8. */
export function detectLocale(
  timeZone: string,
  languages: readonly string[] = [],
): Locale {
  if (
    /^(Asia\/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Kashgar|Hong_Kong|Macau|Macao|Taipei)|PRC|ROC|Hongkong)$/i.test(
      timeZone,
    )
  ) {
    return "zh-CN";
  }
  if (
    timeZone &&
    timeZone !== "UTC" &&
    timeZone !== "Etc/UTC" &&
    timeZone !== "Etc/GMT"
  )
    return "en";
  return languages[0]?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function validPreference(value: unknown): LanguagePreference {
  return value === "en" || value === "zh-CN" ? value : "auto";
}

function resolveLocale(): Locale {
  if (preference !== "auto") return preference;
  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* Fall back to OS language. */
  }
  return detectLocale(
    timeZone,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
}

function refresh() {
  locale = resolveLocale();
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("app_set_locale", { locale }))
      .catch(() => undefined);
  }
  listeners.forEach((listener) => listener());
}

export function initLanguage() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    preference = validPreference(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    /* Storage may be unavailable. */
  }
  refresh();
  window.addEventListener("storage", (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null) {
      preference = validPreference(event.newValue);
      refresh();
    }
  });
  window.addEventListener("focus", () => {
    if (preference === "auto") refresh();
  });
}

export function setLanguage(value: LanguagePreference) {
  preference = validPreference(value);
  try {
    localStorage.setItem(LANGUAGE_KEY, preference);
  } catch {
    /* Keep the choice for this session. */
  }
  refresh();
}

export function getLanguagePreference() {
  return preference;
}
export function getLocale() {
  return locale;
}
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** English source text is the fallback for untranslated UI messages. */
export function translate(message: string, target: Locale = locale): string {
  return target === "zh-CN" &&
    Object.prototype.hasOwnProperty.call(zhCN, message)
    ? ((zhCN as Record<string, string>)[message] ?? message)
    : message;
}

export function formatMessage(
  message: string,
  values: Record<string, string | number>,
): string {
  return translate(message).replace(/\{(\w+)\}/g, (match, key: string) =>
    String(values[key] ?? match),
  );
}

export function useTranslation() {
  useSyncExternalStore(
    subscribeLanguage,
    () => `${preference}:${locale}`,
    () => "auto:en",
  );
  return { t: translate, locale, preference, setLanguage };
}
