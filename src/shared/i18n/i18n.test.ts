// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectLocale,
  getLanguagePreference,
  getLocale,
  initLanguage,
  LANGUAGE_KEY,
  setLanguage,
  subscribeLanguage,
  translate,
  translateInContext,
} from "./index";
import zhCN from "./zh-CN.json";

afterEach(() => {
  vi.restoreAllMocks();
  setLanguage("en");
  localStorage.clear();
});

describe("language selection", () => {
  it.each([
    "Asia/Shanghai",
    "Asia/Urumqi",
    "Asia/Chongqing",
    "Asia/Hong_Kong",
    "Asia/Macau",
    "Asia/Taipei",
    "PRC",
  ])("recognizes Chinese region %s", (zone) => {
    expect(detectLocale(zone, ["en-US"])).toBe("zh-CN");
  });
  it.each([
    "Asia/Singapore",
    "Asia/Manila",
    "Asia/Tokyo",
    "America/New_York",
    "Europe/London",
  ])("does not infer Chinese from UTC offset in %s", (zone) => {
    expect(detectLocale(zone, ["zh-CN"])).toBe("en");
  });
  it("falls back to the system language only when a region is unavailable", () => {
    expect(detectLocale("UTC", ["zh-CN"])).toBe("zh-CN");
    expect(detectLocale("", ["en-US", "zh-CN"])).toBe("en");
    expect(detectLocale("", [])).toBe("en");
  });
  it("loads a saved choice, updates document language, and synchronizes windows", () => {
    localStorage.setItem(LANGUAGE_KEY, "zh-CN");
    initLanguage();
    expect(getLocale()).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    const listener = vi.fn();
    const unsubscribe = subscribeLanguage(listener);
    window.dispatchEvent(
      new StorageEvent("storage", { key: LANGUAGE_KEY, newValue: "en" }),
    );
    expect(getLocale()).toBe("en");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    window.dispatchEvent(
      new StorageEvent("storage", { key: LANGUAGE_KEY, newValue: "invalid" }),
    );
    expect(getLanguagePreference()).toBe("auto");
  });
  it("manual selection overrides the region and persists", () => {
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      ...resolved,
      timeZone: "Asia/Shanghai",
    });
    setLanguage("en");
    expect(getLocale()).toBe("en");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
    setLanguage("auto");
    expect(getLocale()).toBe("zh-CN");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("auto");
  });
  it("survives blocked storage and missing time zone data", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setLanguage("zh-CN")).not.toThrow();
    expect(getLocale()).toBe("zh-CN");
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions",
    ).mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => setLanguage("auto")).not.toThrow();
  });
  it("preserves source text for missing translations and English", () => {
    expect(translate("Settings", "en")).toBe("Settings");
    expect(translate("Settings", "zh-CN")).toBe("设置");
    expect(translate("User-provided project name", "zh-CN")).toBe(
      "User-provided project name",
    );
    for (const value of Object.values(zhCN)) {
      expect(value.trim()).not.toBe("");
      expect(value).not.toMatch(/\uFFFD|\?{3,}/);
    }
  });
});

describe("context-specific action and status semantics", () => {
  it("distinguishes the Chinese Open action from an open inbox status", () => {
    setLanguage("zh-CN");
    expect(translate("Open")).toBe("打开");
    expect(translateInContext("Open", "status")).toBe("待处理");
    expect(translateInContext("Open", "unknown-context")).toBe("打开");
    expect(translateInContext("Closed", "status")).toBe(translate("Closed"));
    expect(translateInContext("Custom user label", "status")).toBe(
      "Custom user label",
    );
  });
  it("keeps the same English source label for both contexts", () => {
    setLanguage("en");
    expect(translate("Open")).toBe("Open");
    expect(translateInContext("Open", "status")).toBe("Open");
    expect(translateInContext("Unknown", "status")).toBe("Unknown");
  });
});

it("keeps the new resource controls and chat setting readable in both languages", () => {
  expect(translate("Memory", "zh-CN")).toBe("记忆");
  expect(translate("Memory usage", "zh-CN")).toBe("内存使用量");
  for (const key of [
    "Resource pressure",
    "View processes",
    "Stop agent",
    "Stop build/tool",
    "Stop session",
    "Smooth text reveal",
  ]) {
    expect(translate(key, "en")).toBe(key);
    expect(translate(key, "zh-CN")).not.toBe(key);
  }
});

it("localizes the new workspace, running work, account and history actions", () => {
  for (const key of [
    "Try the new layout",
    "New layout",
    "Workspace theme",
    "Running work",
    "Stop this session and pause queued work",
    "Choose another account",
    "Search history",
    "Stage hunk",
  ]) {
    expect(translate(key, "en")).toBe(key);
    expect(translate(key, "zh-CN")).not.toBe(key);
  }
});
