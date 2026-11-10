import { t } from "@/ui/i18n";

/** Keep transport codes out of the file preview while preserving local errors. */
export function fileErrorText(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (/\[(?:MEDIA_SOURCE_MISSING|FILE_NOT_FOUND)\]/.test(message)) {
    return t("This file is no longer available on your desktop.");
  }
  if (/\[(?:DEVICE_OFFLINE|HOST_OFFLINE|CONNECTION_LOST)\]/.test(message)) {
    return t("Connect to your desktop and try again.");
  }
  if (/\[[A-Z][A-Z0-9_]{2,}\]/.test(message)) {
    return t("Could not open this file. Try again.");
  }
  return message;
}
