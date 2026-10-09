import { expect, it } from "vitest";
import {
  REMOTE_PROVIDERS,
  isRemoteProvider,
  requireHostDescriptor,
} from "../src/features/connections/model/protocol";
import { hostProviders } from "./providers";
import { HARNESSES } from "../src/features/sessions/model/session";

it("exposes supported remote harnesses without restoring removed CLIs", () => {
  expect(Object.keys(hostProviders).sort()).toEqual(["claude","codex","cursor","grok","hermes","opencode","pi"]);
  for (const provider of Object.keys(hostProviders) as (keyof typeof hostProviders)[]) {
    expect(HARNESSES).toContain(provider);
    expect(isRemoteProvider(provider)).toBe(true);
    expect(hostProviders[provider]!.send).toBeTypeOf("function");
    expect(hostProviders[provider]!.cancel).toBeTypeOf("function");
    expect(hostProviders[provider]!.bind).toBeTypeOf("function");
    expect(hostProviders[provider]!.approve).toBeTypeOf("function");
  }
  expect(
    requireHostDescriptor({
      protocolVersion: 1,
      environmentId: "host",
      name: "fixture",
      providers: [...REMOTE_PROVIDERS],
      capabilities: [],
    }).providers,
  ).toHaveLength(REMOTE_PROVIDERS.length);
});
