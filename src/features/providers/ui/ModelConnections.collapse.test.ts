// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { setLanguage, type Locale } from "../../../shared/i18n";
import { ModelConnections } from "./ModelConnections";
import type { ModelConnection } from "../model/modelConnections";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../integrations/harness/providers/pi/piCatalog", () => ({
  refreshPiCatalog: vi.fn(async () => {}),
}));

const connections: ModelConnection[] = [
  {
    id: "partner",
    name: "TokenDance · Partner",
    baseUrl: "https://tokendance.space/gateway/v1",
    api: "openai-completions",
    models: ["partner-model"],
    enabled: true,
    hasKey: false,
  },
  {
    id: "other",
    name: "Another provider",
    baseUrl: "https://example.invalid/v1",
    api: "openai-completions",
    models: ["other-model"],
    enabled: true,
    hasKey: false,
  },
];

let container: HTMLDivElement;
let root: Root;
let configuredConnections: ModelConnection[];
beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  configuredConnections = connections.slice(0, 1);
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "local_ai_config")
      return { connections: configuredConnections };
    if (command === "usage_history") return [];
    if (command === "local_ai_discover_models") return {};
    return null;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  setLanguage("en");
  vi.unstubAllGlobals();
});

async function render(locale: Locale = "en") {
  setLanguage(locale);
  await act(async () => root.render(createElement(ModelConnections)));
}
const row = (id: "partner" | "other") => {
  const url = connections.find((item) => item.id === id)!.baseUrl;
  return [...container.querySelectorAll<HTMLElement>('[role="button"]')].find(
    (item) => item.textContent?.includes(url),
  )!;
};
const modelSwitch = () => container.querySelector('input[role="switch"]');

it.each(["en", "zh-CN"] as const)(
  "collapses the expanded provider when its row is clicked again (%s)",
  async (locale) => {
    await render(locale);
    expect(modelSwitch()).not.toBeNull();
    expect(row("partner").textContent).toContain(
      locale === "zh-CN" ? "词元跳动" : "TokenDance",
    );
    vi.clearAllMocks();
    await act(async () => row("partner").click());
    expect(modelSwitch()).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  },
);

it.each(["en", "zh-CN"] as const)(
  "collapses the expanded provider with Enter (%s)",
  async (locale) => {
    await render(locale);
    expect(modelSwitch()).not.toBeNull();
    row("partner").focus();
    await act(async () =>
      row("partner").dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        }),
      ),
    );
    expect(modelSwitch()).toBeNull();
  },
);

it("can select a different provider through the same row event handler", async () => {
  configuredConnections = connections;
  await render();
  expect(modelSwitch()?.getAttribute("aria-label")).toContain("partner-model");
  await act(async () => row("other").click());
  expect(modelSwitch()?.getAttribute("aria-label")).toContain("other-model");
});

it("opens editing from the nested button instead of treating it as a row toggle", async () => {
  configuredConnections = connections;
  await render();
  await act(async () =>
    row("other").querySelector<HTMLButtonElement>("button")!.click(),
  );
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(modelSwitch()).toBeNull();
});

it.each(["en", "zh-CN"] as const)(
  "exposes expanded state and a disclosure icon for keyboard toggles (%s)",
  async (locale) => {
    await render(locale);
    expect(row("partner").getAttribute("aria-expanded")).toBe("true");
    expect(
      row("partner").querySelector('svg[aria-hidden="true"]'),
    ).not.toBeNull();
    for (const expanded of [false, true]) {
      await act(async () =>
        row("partner").dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(row("partner").getAttribute("aria-expanded")).toBe(
        String(expanded),
      );
      expect(Boolean(modelSwitch())).toBe(expanded);
    }
    expect(container.querySelector("button button")).toBeNull();
  },
);

it("keeps an explicitly collapsed provider closed when an in-flight model save reloads connections", async () => {
  let finishSave!: () => void;
  const saving = new Promise<void>((resolve) => {
    finishSave = resolve;
  });
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "local_ai_config")
      return { connections: configuredConnections };
    if (command === "usage_history") return [];
    if (command === "local_ai_save_connection") return saving;
    return null;
  });
  await render();
  await act(async () => (modelSwitch() as HTMLInputElement).click());
  expect(row("partner").getAttribute("aria-expanded")).toBe("true");
  await act(async () => row("partner").click());
  expect(modelSwitch()).toBeNull();
  await act(async () => finishSave());
  expect(modelSwitch()).toBeNull();
  expect(row("partner").getAttribute("aria-expanded")).toBe("false");
});

it("selects the remaining provider after removing the expanded provider", async () => {
  configuredConnections = [...connections];
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "local_ai_config")
      return { connections: configuredConnections };
    if (command === "usage_history") return [];
    if (command === "local_ai_remove_connection") {
      configuredConnections = configuredConnections.filter(
        (item) => item.id !== (args as { id: string }).id,
      );
    }
    return null;
  });
  await render();
  const remove = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent === "Remove")!;
  await act(async () => remove.click());
  expect(modelSwitch()?.getAttribute("aria-label")).toContain("other-model");
  expect(row("other").getAttribute("aria-expanded")).toBe("true");
});

it("opens the saved provider explicitly after editing a collapsed connection", async () => {
  await render();
  await act(async () => row("partner").click());
  await act(async () =>
    row("partner").querySelector<HTMLButtonElement>("button")!.click(),
  );
  const form = document.querySelector("form")!;
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(modelSwitch()?.getAttribute("aria-label")).toContain("partner-model");
  expect(row("partner").getAttribute("aria-expanded")).toBe("true");
});

it("ignores row keyboard toggles originating from the edit button", async () => {
  await render();
  const edit = row("partner").querySelector<HTMLButtonElement>("button")!;
  for (const key of ["Enter", " "]) {
    await act(async () =>
      edit.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })),
    );
    expect(modelSwitch()).not.toBeNull();
  }
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
