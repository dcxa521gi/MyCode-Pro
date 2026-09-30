// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { AccountCenter } from "./AccountCenter";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../shared/i18n", () => ({
  useTranslation: () => ({ t: (s: string) => s }),
}));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  invoke.mockReset();
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (window as any).__TAURI_INTERNALS__;
});
async function render() {
  await act(async () => root.render(createElement(AccountCenter)));
}
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it("opens a sign-in dialog for an unsigned-in startup without opening a browser", async () => {
  invoke.mockResolvedValue(null);
  await render();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain("not final quality");
  expect(invoke).toHaveBeenCalledWith("account_center_status");
  expect(invoke).not.toHaveBeenCalledWith("account_center_login");
  await click("Later");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("keeps a verified signed-in startup quiet and shows the account entry", async () => {
  invoke.mockResolvedValue({ sub: "app-scoped-id", name: "Test identity" });
  await render();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toContain("Test identity");
});
it("does not fabricate successful sign-in after a transport error", async () => {
  invoke.mockImplementation((command: string) =>
    command === "account_center_status"
      ? Promise.resolve(null)
      : Promise.reject(new Error("Offline")),
  );
  await render();
  await click("Sign in with browser");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Offline",
  );
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
