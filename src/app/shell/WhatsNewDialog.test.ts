// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const fetchRelease = vi.hoisted(() => vi.fn());
vi.mock("../model/githubReleases", () => ({ fetchRelease }));
import { WhatsNewBody } from "./WhatsNewDialog";
afterEach(() => vi.unstubAllGlobals());
describe("WhatsNewBody", () => {
  it("renders notes fetched for the requested version", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    fetchRelease.mockResolvedValue({
      version: "0.5.0",
      body: "## MyCode release\n\nLocal features.",
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(createElement(WhatsNewBody, { version: "0.5.0" })),
      );
      expect(fetchRelease).toHaveBeenCalledWith(
        "0.5.0",
        expect.any(AbortSignal),
      );
      expect(container.querySelector(".whats-new-md")).not.toBeNull();
      expect(container.textContent).toContain("Local features.");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
