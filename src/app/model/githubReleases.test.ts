import { afterEach, describe, expect, it, vi } from "vitest";
import { compareVersions, fetchRelease } from "./githubReleases";
afterEach(() => vi.unstubAllGlobals());
describe("GitHub release metadata", () => {
  it("orders versions and prereleases correctly", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0-rc.9")).toBe(1);
    expect(compareVersions("1.0.0-rc.10", "1.0.0-rc.9")).toBe(1);
    expect(compareVersions("v1.0.0+build", "1.0.0")).toBe(0);
    expect(() => compareVersions("untrusted", "1.0.0")).toThrow();
  });
  it("only queries our repository and constructs its own download URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: "v0.5.0",
          body: "说明",
          html_url: "https://untrusted.example/",
        }),
      });
    vi.stubGlobal("fetch", fetcher);
    const release = await fetchRelease("0.5.0");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/dcxa521gi/MyCode/releases/tags/v0.5.0",
    );
    expect(release.url).toBe(
      "https://github.com/dcxa521gi/MyCode/releases/tag/v0.5.0",
    );
    expect(release.body).toBe("说明");
  });
  it("rejects HTTP errors and mismatched versions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tag_name: "v0.6.0" }),
        }),
    );
    await expect(fetchRelease()).rejects.toThrow("403");
    await expect(fetchRelease("0.5.0")).rejects.toThrow("mismatch");
  });
});
