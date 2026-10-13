import { afterEach, expect, it, vi } from "vitest";
import {
  bindIMTurnOrigin,
  captureIMTurnOrigin,
  clearIMTurnOrigin,
  publishIMProviderWake,
  subscribeIMProviderWake,
} from "./imProviderWake";

afterEach(() => clearIMTurnOrigin("s1"));

it("returns a provider-owned final answer only to the original channel and project", () => {
  const deliver = vi.fn();
  const dispose = subscribeIMProviderWake(deliver);
  bindIMTurnOrigin({
    sessionId: "s1",
    cwd: "/original",
    harness: "claude",
    channel: "telegram",
    ownerId: "owner",
  });
  const lease = captureIMTurnOrigin("s1");
  publishIMProviderWake(
    {
      sessionId: "s1",
      cwd: "/original",
      harness: "claude",
      text: "Final answer",
    },
    lease,
  );
  expect(deliver).toHaveBeenCalledWith({
    sessionId: "s1",
    cwd: "/original",
    harness: "claude",
    channel: "telegram",
    ownerId: "owner",
    text: "Final answer",
  });
  publishIMProviderWake(
    {
      sessionId: "s1",
      cwd: "/different",
      harness: "claude",
      text: "Wrong project",
    },
    lease,
  );
  expect(deliver).toHaveBeenCalledTimes(1);
  clearIMTurnOrigin("s1");
  publishIMProviderWake(
    {
      sessionId: "s1",
      cwd: "/original",
      harness: "claude",
      text: "Desktop turn",
    },
    lease,
  );
  expect(deliver).toHaveBeenCalledTimes(1);
  dispose();
});

it("revokes a captured wake lease even when a later turn rebinds the same owner", () => {
  const deliver = vi.fn();
  const dispose = subscribeIMProviderWake(deliver);
  const origin = {
    sessionId: "s1",
    cwd: "/repo",
    harness: "claude" as const,
    channel: "telegram",
    ownerId: "owner",
  };
  try {
    bindIMTurnOrigin(origin);
    const lease = captureIMTurnOrigin("s1");
    clearIMTurnOrigin("s1");
    bindIMTurnOrigin(origin);
    const wake = {
      sessionId: "s1",
      cwd: "/repo",
      harness: "claude" as const,
      text: "Old wake",
    };
    publishIMProviderWake(wake, lease);
    expect(deliver).not.toHaveBeenCalled();
    publishIMProviderWake(wake, captureIMTurnOrigin("s1"));
    expect(deliver).toHaveBeenCalledTimes(1);
  } finally {
    dispose();
  }
});
