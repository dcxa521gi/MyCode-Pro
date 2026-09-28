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
