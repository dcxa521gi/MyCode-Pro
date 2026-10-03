// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SettingsDropdown } from "./SettingsDropdown";
it("keeps choices outside clipped cards, supports keyboard navigation and text-only option values", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  host.style.overflow = "hidden";
  document.body.append(host);
  const root = createRoot(host);
  function Form() {
    const [value, setValue] = useState("A");
    return createElement(
      SettingsDropdown,
      {
        "aria-label": "Agent",
        value,
        onChange: (e) => setValue(e.target.value),
      },
      createElement("option", {}, "A"),
      createElement("option", { value: "b", disabled: true }, "B"),
      createElement("option", { value: "c" }, "C"),
    );
  }
  try {
    await act(async () => root.render(createElement(Form)));
    const trigger = host.querySelector<HTMLButtonElement>("button")!;
    await act(async () => trigger.click());
    const panel = document.querySelector('[role="listbox"]')!;
    expect(host.contains(panel)).toBe(false);
    expect(panel.parentElement?.style.position).toBe("fixed");
    await act(async () =>
      panel
        .querySelector<HTMLButtonElement>('button[role="option"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        ),
    );
    expect(document.activeElement?.textContent).toContain("A");
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    expect(document.activeElement?.textContent).toBe("C");
    await act(async () =>
      (document.activeElement as HTMLButtonElement).click(),
    );
    expect(trigger.textContent).toBe("C");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
