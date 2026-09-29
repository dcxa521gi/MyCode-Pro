// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { VoiceInput } from "./VoiceInput";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("transcribes Token Plan audio while recording, flushes the tail once, and stops tracks", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let processor: {
    onaudioprocess: ((event: unknown) => void) | null;
    connect: () => void;
    disconnect: () => void;
  };
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 16000;
      destination = {};
      resume = async () => {};
      close = async () => {};
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createScriptProcessor() {
        processor = { onaudioprocess: null, connect() {}, disconnect() {} };
        return processor;
      }
      createGain() {
        return { gain: { value: 0 }, connect() {}, disconnect() {} };
      }
    },
  );
  let calls = 0;
  mocks.invoke.mockImplementation(async (command: string) =>
    command === "voice_config"
      ? {
          endpoint: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions",
          model: "mimo-v2.5-asr",
          hasKey: true,
          commands: false,
        }
      : `segment-${++calls}`,
  );
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const text = vi.fn();
  try {
    await act(async () =>
      root.render(createElement(VoiceInput, { onText: text })),
    );
    await act(async () => node.querySelector("button")!.click());
    const speak = () =>
      processor.onaudioprocess!({
        inputBuffer: { getChannelData: () => new Float32Array([0.2, 0.4]) },
      });
    speak();
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(text).toHaveBeenNthCalledWith(1, "segment-1");
    expect(stop).not.toHaveBeenCalled();
    speak();
    await act(async () => node.querySelector("button")!.click());
    expect(text).toHaveBeenNthCalledWith(2, "segment-2");
    expect(stop).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(text).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    node.remove();
  }
});
