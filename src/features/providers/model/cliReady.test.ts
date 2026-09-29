import { expect, it } from "vitest";
import { newerCliVersion } from "./cliReady";
it("compares numeric versions without downgrading newer CLIs or guessing unknown versions", () => {
  expect(newerCliVersion("codex 0.9.0", "v0.10.0")).toBe(true);
  expect(newerCliVersion("1.2.3", "1.2.3")).toBe(false);
  expect(newerCliVersion("2.0.0", "1.99.0")).toBe(false);
  expect(newerCliVersion("1.2.3-beta", "1.2.3")).toBe(true);
  expect(newerCliVersion("ACP server", "latest")).toBe(false);
});
