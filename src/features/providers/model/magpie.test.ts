// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { magpieRuntime, magpieSupplier } from "./magpie";
import {
  mergeDiscoveredModelMetadata,
  type ModelConnection,
} from "./modelConnections";
import {
  modelsFor,
  setConnectionModels,
  resetHarnessModelOverlays,
} from "../../sessions/model/models";
const connection: ModelConnection = {
  id: "magpie",
  name: "Gateway",
  gateway: "magpie",
  api: "openai-completions",
  baseUrl: "http://127.0.0.1:3425/v1",
  models: ["models/opaque", "one/same", "two/same"],
  enabled: true,
  hasKey: true,
};
afterEach(() => {
  setConnectionModels([]);
  resetHarnessModelOverlays();
});
it("uses three independent Magpie wire protocols and preserves exact routes", () => {
  expect(magpieRuntime(connection, "claude")).toEqual({
    api: "anthropic-messages",
    baseUrl: "http://127.0.0.1:3425",
  });
  expect(magpieRuntime(connection, "codex")).toEqual({
    api: "openai-responses",
    baseUrl: "http://127.0.0.1:3425/v1",
  });
  expect(
    magpieRuntime(
      {
        ...connection,
        magpieEndpoints: { pi: "https://gateway.example/chat/v1" },
      },
      "pi",
    ).baseUrl,
  ).toBe("https://gateway.example/chat/v1");
  setConnectionModels([
    {
      ...connection,
      modelMetadata: { "models/opaque": { nativeApi: "anthropic-messages" } },
    },
  ]);
  for (const engine of ["claude", "codex", "pi"] as const) {
    const routes = modelsFor(engine).filter((m) =>
      m.id.includes(":mycode-magpie/"),
    );
    expect(routes.map((m) => m.id)).toEqual(
      connection.models.map((id) => `${engine}:mycode-magpie/${id}`),
    );
  }
});
it("honors explicit route restrictions and excludes media-only routes from chat", () => {
  setConnectionModels([
    {
      ...connection,
      models: ["chat", "image"],
      modelMetadata: {
        chat: {
          nativeApi: "anthropic-messages",
          supportedProtocols: ["openai:responses"],
        },
        image: { nativeApi: "openai-images", outputModalities: ["image"] },
      },
    },
  ]);
  expect(
    modelsFor("claude").filter((m) => m.id.includes(":mycode-magpie/")),
  ).toHaveLength(0);
  expect(
    modelsFor("codex")
      .filter((m) => m.id.includes(":mycode-magpie/"))
      .map((m) => m.name),
  ).toEqual(["chat"]);
});
it("keeps supplier identity separate from model identity and refreshes stale provenance", () => {
  const metadata = {
    discoveredSource: {
      kind: "magpie" as const,
      providerId: "account-2",
      label: "Chat · Team · account",
      discoveredName: "Chat",
    },
    manualOverrides: { name: "My name" },
  };
  expect(magpieSupplier(metadata)).toBe("Team · account · account-2");
  expect(
    magpieSupplier({
      discoveredSource: { kind: "magpie", providerId: "bad\nlabel" },
    }),
  ).toBeUndefined();
  const refreshed = mergeDiscoveredModelMetadata(
    { chat: metadata },
    { chat: { name: "Chat" } },
  ).chat;
  expect(refreshed.discoveredSource).toBeUndefined();
  expect(refreshed.name).toBe("My name");
});
