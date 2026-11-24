import { afterEach, expect, it, vi } from "vitest";
import {
  RemoteCatalogCache,
  retainFailedCatalogProviders,
} from "./remoteCatalogCache";
import type { HostModelCatalog } from "./protocol";
const catalog: HostModelCatalog = {
  models: { codex: [{ id: "codex:test", name: "Test", harness: "codex" }] },
  errors: {},
};
afterEach(() => vi.useRealTimers());
it("coalesces concurrent reads and refreshes after the shared 15 second budget", async () => {
  vi.useFakeTimers();
  const cache = new RemoteCatalogCache();
  const fetch = vi.fn(async () => catalog);
  await Promise.all([cache.read("a", fetch), cache.read("a", fetch)]);
  await cache.read("a", fetch);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(15_001);
  await cache.read("a", fetch);
  expect(fetch).toHaveBeenCalledTimes(2);
  await cache.read("b", fetch);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("keeps transiently failed rows but does not resurrect revoked or successfully removed models", () => {
  expect(
    retainFailedCatalogProviders(catalog, {
      models: {},
      errors: { codex: "temporarily offline" },
    }).models.codex,
  ).toEqual(catalog.models.codex);
  expect(
    retainFailedCatalogProviders(catalog, {
      models: {},
      errors: { codex: "Access denied" },
    }).models.codex,
  ).toBeUndefined();
  expect(
    retainFailedCatalogProviders(catalog, { models: { codex: [] }, errors: {} })
      .models.codex,
  ).toEqual([]);
});
it("does not cache a late response after invalidation or poison the next read after failure", async () => {
  const cache = new RemoteCatalogCache();
  let resolve!: (v: HostModelCatalog) => void;
  const old = cache.read(
    "a",
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await Promise.resolve();
  cache.invalidate("a");
  resolve(catalog);
  await old;
  expect(cache.peek("a")).toBeUndefined();
  await expect(
    cache.read("a", async () => {
      throw Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(await cache.read("a", async () => catalog)).toEqual(catalog);
});
it("bounds a hanging catalog read and allows the next request to recover", async () => {
  vi.useFakeTimers();
  const cache = new RemoteCatalogCache();
  const read = cache.read("a", () => new Promise(() => {}));
  const assertion = expect(read).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(20_001);
  await assertion;
  expect(await cache.read("a", async () => catalog)).toEqual(catalog);
});
