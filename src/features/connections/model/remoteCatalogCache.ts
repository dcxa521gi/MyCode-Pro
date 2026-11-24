import type { HostModelCatalog, RemoteProvider } from "./protocol";
import { translate } from "../../../shared/i18n";

/** Cindy 2965b7c7f0: one freshness budget and in-flight read per host identity/project. */
export const REMOTE_CATALOG_FRESH_MS = 15_000;
export class RemoteCatalogCache {
  private values = new Map<string, { catalog: HostModelCatalog; at: number }>();
  private pending = new Map<string, Promise<HostModelCatalog>>();
  key(machine: string, environment: string, project: string) {
    return JSON.stringify([machine, environment, project]);
  }
  peek(key: string) {
    return this.values.get(key)?.catalog;
  }
  invalidate(key: string) {
    this.values.delete(key);
    this.pending.delete(key);
  }
  async read(
    key: string,
    fetch: () => Promise<HostModelCatalog>,
    force = false,
  ): Promise<HostModelCatalog> {
    const previous = this.values.get(key);
    if (
      !force &&
      previous &&
      Date.now() - previous.at < REMOTE_CATALOG_FRESH_MS
    )
      return previous.catalog;
    const pending = this.pending.get(key);
    if (pending) return pending;
    let timer: ReturnType<typeof setTimeout>;
    const bounded = Promise.race([
      Promise.resolve().then(fetch),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(
                translate(
                  "Remote model catalog timed out. Reconnect and retry.",
                ),
              ),
            ),
          20_000,
        );
      }),
    ]);
    const request = bounded
      .then((next) => {
        const catalog = retainFailedCatalogProviders(previous?.catalog, next);
        // A removed machine or replaced identity cannot be repopulated by a late response.
        if (this.pending.get(key) === request) {
          this.values.set(key, { catalog, at: Date.now() });
          if (this.values.size > 64)
            this.values.delete(this.values.keys().next().value!);
        }
        return catalog;
      })
      .finally(() => {
        clearTimeout(timer);
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request;
  }
}
/** Retain display-only rows for explicit transient errors; a successful empty response is authoritative. */
export function retainFailedCatalogProviders(
  previous: HostModelCatalog | undefined,
  next: HostModelCatalog,
): HostModelCatalog {
  const models = { ...next.models };
  for (const provider of Object.keys(next.errors) as RemoteProvider[]) {
    if (
      !models[provider]?.length &&
      previous?.models[provider]?.length &&
      !/denied|forbidden|unauthori[sz]ed|revoked|removed|not allowed|权限|撤销/i.test(
        next.errors[provider] ?? "",
      )
    )
      models[provider] = previous.models[provider];
  }
  return { ...next, models };
}
export const remoteCatalogCache = new RemoteCatalogCache();
