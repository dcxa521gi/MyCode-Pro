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
    const fetcher = vi.fn().mockResolvedValue({
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
      "https://api.github.com/repos/dcxa521gi/MyCode-Pro/releases/tags/v0.5.0",
    );
    expect(release.url).toBe(
      "https://github.com/dcxa521gi/MyCode-Pro/releases/tag/v0.5.0",
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

  it("keeps stable checks separate from beta candidates in this fork", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag_name: "v0.19.0", prerelease: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { tag_name: "v0.19.0", prerelease: false },
          { tag_name: "v0.20.0-beta.2", prerelease: true },
          { tag_name: "v9.0.0", draft: true },
        ],
      });
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchRelease()).version).toBe("0.19.0");
    expect((await fetchRelease(undefined, undefined, "beta")).version).toBe(
      "0.20.0-beta.2",
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/repos/dcxa521gi/MyCode-Pro/releases/latest",
      "https://api.github.com/repos/dcxa521gi/MyCode-Pro/releases?per_page=20",
    ]);
  });
});
