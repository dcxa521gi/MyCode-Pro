// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SettingsOptions } from "./SettingsOptions";
it("keeps disabled choices out of keyboard selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Form() {
    const [value, setValue] = useState("a");
    return createElement(
      SettingsOptions,
      {
        "aria-label": "Choices",
        value,
        onChange: (e) => setValue(e.target.value),
      },
      createElement("option", { value: "a" }, "A"),
      createElement("option", { value: "b", disabled: true }, "B"),
      createElement("option", { value: "c" }, "C"),
    );
  }
  try {
    await act(async () => root.render(createElement(Form)));
    const a = container.querySelector<HTMLButtonElement>("button")!;
    a.focus();
    await act(async () =>
      a.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(document.activeElement?.textContent).toBe("C");
    expect(document.activeElement?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector("select")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
