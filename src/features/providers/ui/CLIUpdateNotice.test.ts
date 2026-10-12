// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { HARNESSES } from "../../sessions/model/session";
const mocks = vi.hoisted(() => ({
  check: vi.fn(async (_provider: string) => undefined),
  invalidate: vi.fn(),
  probe: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
  listener: undefined as undefined | ((event: { payload: string }) => void),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_: string, callback: typeof mocks.listener) => {
    mocks.listener = callback;
    return () => {};
  }),
}));
vi.mock("../model/cliVersions", () => ({
  checkCLIVersion: mocks.check,
  cliState: () => ({ phase: "current" }),
  invalidateCLIVersion: mocks.invalidate,
  subscribeCLIVersions: () => () => {},
}));
vi.mock("../../../integrations/harness/core/availability", () => ({
  probeHarnessAvailability: mocks.probe,
}));
vi.mock("../../../integrations/harness/core/registry", () => ({
  refreshHarnessCatalogs: mocks.refresh,
}));
afterEach(() => vi.unstubAllGlobals());
it("checks only active CLIs including Devin and ignores obsolete Freebuff update events", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(
      createElement((await import("./CLIUpdateNotice")).CLIUpdateNotice, {
        onOpen: vi.fn(),
      }),
    );
  });
  expect(mocks.check.mock.calls.map(([id]) => id)).toEqual(
    expect.arrayContaining(HARNESSES),
  );
  expect(mocks.check).toHaveBeenCalledTimes(HARNESSES.length);
  expect(mocks.check).not.toHaveBeenCalledWith("freebuff");
  expect(mocks.check).toHaveBeenCalledWith("devin");
  act(() => mocks.listener?.({ payload: "freebuff" }));
  expect(mocks.probe).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  act(() => root.unmount());
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});
