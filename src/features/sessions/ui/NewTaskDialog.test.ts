// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { NewTaskDialog } from "./NewTaskDialog";
import { setLanguage } from "../../../shared/i18n";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => "C:/Users/test/MyCode"),
}));
vi.mock("../../../platform/tauri/fs", () => ({
  pickFolder: vi.fn(async () => "D:/Office"),
}));
it("uses a chosen project folder without overwriting the default workspace", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setLanguage("en");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const create = vi.fn();
  const click = async (label: string) => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () =>
      root.render(
        createElement(NewTaskDialog, { onClose: vi.fn(), onCreate: create }),
      ),
    );
    expect(document.body.textContent).toContain("C:/Users/test/MyCode");
    expect(document.querySelectorAll("select")).toHaveLength(2);
    await click("Add folder");
    const agent = document.querySelector("select")!;
    await act(async () => {
      agent.value = "codex";
      agent.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.querySelectorAll("select")[1].value).toBe("codex:default");
    await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(create).toHaveBeenCalledWith("D:/Office", "codex", "codex:default");
    expect(localStorage.getItem("mycode.defaultWorkspace.development")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});
