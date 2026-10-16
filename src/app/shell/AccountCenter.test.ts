// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { AccountCenter } from "./AccountCenter";
const invoke = vi.hoisted(() => vi.fn());
const openUrl = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));
vi.mock("../../shared/i18n", () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  invoke.mockReset(); openUrl.mockReset();
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); delete (window as any).__TAURI_INTERNALS__;
});
it("shows a local TokenDance account entry without opening a startup dialog", async () => {
  invoke.mockResolvedValue(null);
  await act(async () => root.render(createElement(AccountCenter)));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toContain("Sign in to TokenDance");
  expect(invoke).toHaveBeenCalledWith("tokendance_account_status");
  expect(invoke).not.toHaveBeenCalledWith("account_center_status");
});
it("shows balance from the authorized key in micro-yuan", async () => {
  invoke.mockResolvedValue({ connected: true, name: "Alice", balance: 2500000, credits: 4000000, creditsUsed: 1500000 });
  await act(async () => root.render(createElement(AccountCenter)));
  expect(container.textContent).toContain("Alice");
  expect(container.textContent).toContain("¥2.50");
  await act(async () => container.querySelector("button")!.click());
  expect(document.body.textContent).toContain("¥4.00");
  expect(document.body.textContent).toContain("¥1.50");
});
it("starts TokenDance authorization instead of the removed account service", async () => {
  invoke.mockImplementation((command: string) => command === "tokendance_authorize"
    ? Promise.resolve({ id: "flow", url: "https://tokendance.space/auth" })
    : Promise.resolve(null));
  openUrl.mockResolvedValue(undefined);
  await act(async () => root.render(createElement(AccountCenter)));
  await act(async () => container.querySelector("button")!.click());
  const authorize = [...document.querySelectorAll("button")].find((button) => button.textContent === "Authorize TokenDance")!;
  await act(async () => authorize.click());
  expect(invoke).toHaveBeenCalledWith("tokendance_authorize", { provider: "tokendance" });
  expect(openUrl).toHaveBeenCalledWith("https://tokendance.space/auth");
  expect(invoke).not.toHaveBeenCalledWith("account_center_login");
});
