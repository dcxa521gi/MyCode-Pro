import { getLocale } from "../i18n";

/** Native adapters can supply an English / Chinese pair; never split URLs or provider diagnostics. */
export function localizedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const pair = /^(.*?) \/ ([\u3400-\u9fff].*)$/s.exec(message);
  return pair ? pair[getLocale() === "zh-CN" ? 2 : 1] : message;
}
