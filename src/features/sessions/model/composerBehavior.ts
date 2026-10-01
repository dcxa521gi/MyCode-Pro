import { useEffect, useState } from "react";
export type ComposerBehavior = {
  sendKey: "enter" | "ctrl-enter";
  numberedLists: boolean;
};
const key = "mycode.composer-behavior";
export function loadComposerBehavior(): ComposerBehavior {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      sendKey: v.sendKey === "ctrl-enter" ? "ctrl-enter" : "enter",
      numberedLists: v.numberedLists !== false,
    };
  } catch {
    return { sendKey: "enter", numberedLists: true };
  }
}
export function saveComposerBehavior(value: ComposerBehavior) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(key));
}
export function useComposerBehavior() {
  const [value, setValue] = useState(loadComposerBehavior);
  useEffect(() => {
    const sync = () => setValue(loadComposerBehavior());
    window.addEventListener(key, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(key, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return value;
}
export function shouldSend(
  e: {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
  },
  mode: ComposerBehavior["sendKey"],
) {
  return (
    e.key === "Enter" &&
    !e.shiftKey &&
    !e.altKey &&
    (mode === "ctrl-enter" ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey)
  );
}
export function numberedNewline(
  text: string,
  start: number,
  end: number,
): { text: string; cursor: number } | null {
  if (start !== end) return null;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const line = text.slice(lineStart, start);
  const match = /^(\s*)(\d{1,8})([、.]?)(\s*)(.*)$/.exec(line);
  if (!match || (!match[3] && !match[4] && match[5])) return null;
  const prefix = `${match[1]}${Number(match[2]) + 1}${match[3]}${match[4]}`;
  const insert = `\n${prefix}`;
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    cursor: start + insert.length,
  };
}
const contextPrefix = "[MyCode quoted context]\n";
const contextEnd = "\n[/MyCode quoted context]\n";
export function decodeContextDraft(value: string) {
  if (value.startsWith(contextPrefix)) {
    const end = value.indexOf(contextEnd);
    if (end >= 0)
      try {
        const quotes: unknown = JSON.parse(
          value.slice(contextPrefix.length, end),
        );
        if (Array.isArray(quotes) && quotes.every((x) => typeof x === "string"))
          return {
            text: value.slice(end + contextEnd.length),
            quotes: quotes as string[],
          };
      } catch {
        /* ordinary text */
      }
  }
  return { text: value, quotes: [] as string[] };
}
export function encodeContextDraft(text: string, quotes: string[]) {
  return quotes.length
    ? contextPrefix + JSON.stringify(quotes) + contextEnd + text
    : text;
}
export function contextPrompt(text: string, quotes: string[]) {
  return quotes.length
    ? quotes
        .map((q) =>
          q
            .split("\n")
            .map((l) => "> " + l)
            .join("\n"),
        )
        .join("\n\n") +
        "\n\n" +
        text
    : text;
}
