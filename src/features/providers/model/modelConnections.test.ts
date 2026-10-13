// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../sessions/model/models", () => ({
  setConnectionModels: vi.fn(),
}));
import { setLanguage } from "../../../shared/i18n";
import {
  connectionDisplayName,
  mergeDiscoveredModelMetadata,
} from "./modelConnections";
afterEach(() => setLanguage("en"));

it("does not inherit discovered capabilities across directory sources", () => {
  const refreshed = mergeDiscoveredModelMetadata(
    {
      voice: {
        nativeApi: "openai-audio-speech",
        source: "https://old/models",
        manualOverrides: { name: "My Voice" },
      },
    },
    { voice: { nativeApi: null, source: "https://new/models" } },
  );
  expect(refreshed.voice.nativeApi).toBeUndefined();
  expect(refreshed.voice.name).toBe("My Voice");
  expect(refreshed.voice.manualOverrides).toEqual({ name: "My Voice" });
});

it("refreshes cached discovery while preserving only explicit manual overrides", () => {
  const previous = {
    voice: {
      name: "Cached",
      mode: "chat",
      thinking: true,
      source: "old",
      manualOverrides: {
        name: "My Voice",
        mode: "audio_speech",
        thinking: false,
      },
    },
    chat: { name: "Old Chat", contextWindow: 100, source: "old" },
  };
  const refreshed = mergeDiscoveredModelMetadata(previous, {
    voice: {
      name: "Provider Voice",
      mode: "chat",
      thinking: true,
      nativeApi: "openai-audio-speech",
      source: "new",
    },
    chat: { name: "New Chat", contextWindow: 200, source: "new" },
  });
  expect(refreshed.voice).toMatchObject({
    name: "My Voice",
    mode: "audio_speech",
    thinking: false,
    source: "new",
    nativeApi: "openai-audio-speech",
  });
  expect(refreshed.chat).toMatchObject({
    name: "New Chat",
    contextWindow: 200,
  });
  expect(previous.chat.name).toBe("Old Chat");
});
it("localizes saved partner branding without rewriting connection data", () => {
  const saved = {
    name: "TokenDance · Partner",
    baseUrl: "https://tokendance.space/gateway/v1",
  };
  setLanguage("zh-CN");
  expect(connectionDisplayName(saved)).toContain("词元跳动");
  expect(connectionDisplayName(saved)).not.toContain("TokenDance");
  expect(saved.name).toBe("TokenDance · Partner");
  expect(saved.baseUrl).toBe("https://tokendance.space/gateway/v1");
  setLanguage("en");
  expect(connectionDisplayName(saved)).toBe("TokenDance · Partner");
});
it("preserves user-defined names and endpoints", () => {
  setLanguage("zh-CN");
  expect(
    connectionDisplayName({
      name: "我的工作账号",
      baseUrl: "https://tokendance.space/gateway/v1",
    }),
  ).toBe("我的工作账号");
  expect(
    connectionDisplayName({
      name: "TokenDance research",
      baseUrl: "https://example.com/v1",
    }),
  ).toBe("TokenDance research");
});

it("retains known cached evidence when discovery reports null", () => {
  const previous = {
    voice: {
      nativeApi: "openai-audio-speech",
      thinking: true,
      supportedProtocols: ["openai:responses"],
    },
  };
  expect(
    mergeDiscoveredModelMetadata(previous, {
      voice: { nativeApi: null, thinking: false, supportedProtocols: [] },
    }).voice,
  ).toMatchObject({
    nativeApi: "openai-audio-speech",
    thinking: false,
    supportedProtocols: [],
  });
  expect(
    mergeDiscoveredModelMetadata(
      { voice: { ...previous.voice, manualOverrides: { nativeApi: null } } },
      { voice: { nativeApi: "anthropic-messages" } },
    ).voice.nativeApi,
  ).toBeNull();
});
