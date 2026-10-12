// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { newerCliVersion } from "./cliReady";
const readyMocks = vi.hoisted(() => ({ inspect: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: readyMocks.invoke,
}));
vi.mock("../../../integrations/harness/core/child", () => ({
  inspectHarnessBinary: readyMocks.inspect,
}));
it("compares numeric versions without downgrading newer CLIs or guessing unknown versions", () => {
  expect(newerCliVersion("codex 0.9.0", "v0.10.0")).toBe(true);
  expect(newerCliVersion("1.2.3", "1.2.3")).toBe(false);
  expect(newerCliVersion("2.0.0", "1.99.0")).toBe(false);
  expect(newerCliVersion("1.2.3-beta", "1.2.3")).toBe(true);
  expect(newerCliVersion("ACP server", "latest")).toBe(false);
});
it.each(["newer release available", "version feed offline"])(
  "does not block an installed CLI when %s",
  async () => {
    vi.resetModules();
    readyMocks.invoke.mockClear();
    readyMocks.invoke.mockRejectedValue(Error("offline"));
    readyMocks.inspect.mockResolvedValue({
      path: "/cli/codex",
      version: "1.0.0",
    });
    const dispatched = vi
      .spyOn(window, "dispatchEvent")
      .mockImplementation((event) => {
        (
          event as CustomEvent<{ finish: (ready: boolean) => void }>
        ).detail.finish(true);
        return true;
      });
    const { ensureCliReady } = await import("./cliReady");
    expect(await ensureCliReady("codex", crypto.randomUUID())).toBe(true);
    expect(readyMocks.invoke).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
    dispatched.mockRestore();
  },
);
it("offers preparation only for a missing active CLI and refuses Freebuff", async () => {
  vi.resetModules();
  readyMocks.invoke.mockClear();
  readyMocks.inspect.mockRejectedValue(Error("CLI not installed"));
  const receive = vi
    .spyOn(window, "dispatchEvent")
    .mockImplementation((event) => {
      (
        event as CustomEvent<{ finish: (ready: boolean) => void }>
      ).detail.finish(true);
      return true;
    });
  const { ensureCliReady } = await import("./cliReady");
  expect(await ensureCliReady("codex", "missing")).toBe(true);
  expect(receive).toHaveBeenCalledTimes(1);
  expect(readyMocks.invoke).not.toHaveBeenCalled();
  receive.mockClear();
  expect(await ensureCliReady("freebuff" as never, "retired")).toBe(false);
  expect(receive).not.toHaveBeenCalled();
  receive.mockRestore();
});
