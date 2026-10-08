import { expect, it } from "vitest";
import { compareCliVersions } from "./cliVersion";
it("compares vendor calendar releases against the installed release date", () => {
  expect(
    compareCliVersions(
      "Hermes Agent v0.21.5+4977.g12 (2026.9.24)\nPython: 3.14.7",
      "v2026.9.24",
    ),
  ).toBe(0);
  expect(
    compareCliVersions("Hermes Agent v0.21.5 (2026.9.24)", "v2026.10.1"),
  ).toBeGreaterThan(0);
  expect(compareCliVersions("agent 2026-10-07-abcdef", "2026.10.07")).toBe(0);
  expect(compareCliVersions("Hermes 0.21.5", "v2026.10.1")).toBeNull();
});
it("compares prereleases, ignores build metadata and never downgrades", () => {
  expect(compareCliVersions("codex 2.0.0", "1.99.0")).toBeLessThan(0);
  expect(compareCliVersions("1.2.3-beta.2", "1.2.3-beta.10")).toBeGreaterThan(
    0,
  );
  expect(compareCliVersions("1.2.3-rc.1", "1.2.3")).toBeGreaterThan(0);
  expect(compareCliVersions("1.2.3", "1.2.3-rc.1")).toBeLessThan(0);
  expect(compareCliVersions("1.2.3+old", "1.2.3+new")).toBe(0);
  expect(compareCliVersions("CLI unknown", "latest")).toBeNull();
});
