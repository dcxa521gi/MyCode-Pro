import { describe, expect, it, vi } from "vitest";
import type { HarnessId } from "../../sessions/model/session";
import {
  announceHarnessUpdated,
  findHarnessUpdates,
  onHarnessUpdated,
  UPDATABLE_HARNESSES,
  fetchLatestHarnessVersion,
} from "./harnessUpdates";
import { HARNESSES } from "../../sessions/model/session";

const events = vi.hoisted(() => {
  const listeners = new Map<
    string,
    Set<(event: { payload: unknown }) => void>
  >();
  return {
    emit: vi.fn(async (name: string, payload: unknown) => {
      listeners.get(name)?.forEach((listener) => listener({ payload }));
    }),
    listen: vi.fn(
      async (name: string, listener: (event: { payload: unknown }) => void) => {
        const handlers = listeners.get(name) ?? new Set();
        handlers.add(listener);
        listeners.set(name, handlers);
        return () => {
          handlers.delete(listener);
        };
      },
    ),
  };
});
vi.mock("@tauri-apps/api/event", () => events);
const native = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ version: "1.2.3" })),
}));
vi.mock("@tauri-apps/api/core", () => native);

const INSTALLED: Partial<Record<HarnessId, string>> = {
  claude: "2.1.284 (Claude Code)",
  codex: "codex-cli 0.159.2",
  opencode: "1.18.31",
  cursor: "2026.09.01-abc",
};

const LATEST: Partial<Record<HarnessId, string>> = {
  claude: "2.1.285",
  codex: "0.159.2",
  opencode: "1.18.33",
};

function find(harnesses: HarnessId[]) {
  return findHarnessUpdates({
    harnesses,
    installedVersion: async (id) => INSTALLED[id],
    latestVersion: async (id) => {
      const version = LATEST[id];
      if (!version) throw new Error("offline");
      return version;
    },
  });
}

describe("harness update check", () => {
  it("uses each vendor managed feed for the six added CLIs", async () => {
    native.invoke.mockClear();
    for (const harness of [
      "cursor",
      "grok",
      "hermes",
      "minimax",
      "mimo",
      "devin",
    ] as const) {
      expect(await fetchLatestHarnessVersion(harness)).toBe("1.2.3");
      expect(native.invoke).toHaveBeenLastCalledWith("managed_cli_latest", {
        provider: harness,
      });
    }
  });
  it("bounds vendor version inspections to two and keeps input order", async () => {
    let active = 0,
      peak = 0;
    const updates = await findHarnessUpdates({
      harnesses: HARNESSES,
      installedVersion: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return "1.0.0";
      },
      latestVersion: async () => "1.1.0",
    });
    expect(peak).toBe(2);
    expect(updates.map((update) => update.harness)).toEqual(HARNESSES);
  });
  it("checks all active CLIs and compares Hermes calendar releases against its installed date", async () => {
    expect([...UPDATABLE_HARNESSES].sort()).toEqual([...HARNESSES].sort());
    expect(
      await findHarnessUpdates({
        harnesses: ["hermes", "devin", "minimax", "mimo", "cursor", "grok"],
        installedVersion: async (id) =>
          id === "hermes" ? "Hermes Agent v0.21.5 (2026.9.20)" : "1.0.0",
        latestVersion: async (id) => (id === "hermes" ? "v2026.9.24" : "1.1.0"),
      }),
    ).toHaveLength(6);
  });
  it("reports only harnesses behind the published release", async () => {
    expect(await find(["claude", "codex", "opencode"])).toEqual([
      {
        harness: "claude",
        installed: "2.1.284",
        latest: "2.1.285",
      },
      {
        harness: "opencode",
        installed: "1.18.31",
        latest: "1.18.33",
      },
    ]);
  });

  it("skips harnesses without a version feed or whose lookup fails", async () => {
    expect(await find(["cursor", "pi"])).toEqual([]);
  });

  it("offers a harness still behind again, at the newest release", async () => {
    expect(await find(["claude"])).toMatchObject([{ latest: "2.1.285" }]);

    LATEST.claude = "2.1.286";
    try {
      expect(await find(["claude"])).toMatchObject([
        { harness: "claude", installed: "2.1.284", latest: "2.1.286" },
      ]);
    } finally {
      LATEST.claude = "2.1.285";
    }
  });
});

it("bridges managed installation events while ignoring retired Freebuff", async () => {
  const changed = vi.fn();
  const stop = await onHarnessUpdated(changed);
  await events.emit("mycode-cli-updated", "freebuff");
  expect(changed).not.toHaveBeenCalled();
  await events.emit("mycode-cli-updated", "devin");
  expect(changed).toHaveBeenCalledWith("devin", "installed");
  stop();
});

it("delivers updates to other windows while skipping the sender and respecting cleanup", async () => {
  // A fresh module instance represents another window's separate JS runtime.
  vi.resetModules();
  const otherWindow = await import("./harnessUpdates");
  const localRefresh = vi.fn();
  const remoteRefresh = vi.fn();
  const stopLocal = await onHarnessUpdated(localRefresh);
  const stopRemote = await otherWindow.onHarnessUpdated(remoteRefresh);
  try {
    await announceHarnessUpdated("claude");
    expect(localRefresh).not.toHaveBeenCalled();
    expect(remoteRefresh).toHaveBeenCalledExactlyOnceWith("claude");

    await otherWindow.announceHarnessUpdated("codex");
    expect(localRefresh).toHaveBeenCalledExactlyOnceWith("codex");
    expect(remoteRefresh).toHaveBeenCalledTimes(1);

    stopLocal();
    await otherWindow.announceHarnessUpdated("opencode");
    expect(localRefresh).toHaveBeenCalledTimes(1);
    expect(remoteRefresh).toHaveBeenCalledTimes(1);
  } finally {
    stopLocal();
    stopRemote();
  }
});
