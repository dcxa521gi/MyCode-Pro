import { invoke } from "@tauri-apps/api/core";
import type { HarnessId } from "../../sessions/model/session";

export type ConfigurableBinaryProvider = HarnessId | "freebuff";

const STORAGE_KEY = "monocode.providerBinaryPaths.v1";

type StoredBinaryPaths = Partial<Record<ConfigurableBinaryProvider, string>>;

function readProviderBinaryPaths(): StoredBinaryPaths {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value).filter(([, path]) => typeof path === "string"),
    ) as StoredBinaryPaths;
  } catch {
    return {};
  }
}

const runtimeBinaryPaths = readProviderBinaryPaths();

export async function initializeProviderBinaryPaths(): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const native = await invoke<StoredBinaryPaths>("managed_cli_paths");
    const migrated = { ...readProviderBinaryPaths(), ...native };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }
  const active = await invoke<StoredBinaryPaths>(
    "harness_runtime_binary_paths",
    {
      paths: readProviderBinaryPaths(),
    },
  );
  for (const provider of Object.keys(runtimeBinaryPaths)) {
    delete runtimeBinaryPaths[provider as ConfigurableBinaryProvider];
  }
  Object.assign(runtimeBinaryPaths, active);
}

export function runtimeProviderBinaryPath(
  provider: ConfigurableBinaryProvider,
): string | null {
  const path = runtimeBinaryPaths[provider];
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function loadProviderBinaryPath(
  provider: ConfigurableBinaryProvider,
): string | null {
  const path = readProviderBinaryPaths()[provider];
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export function providerBinaryPathChangePending(
  provider: ConfigurableBinaryProvider,
): boolean {
  return (
    runtimeProviderBinaryPath(provider) !== loadProviderBinaryPath(provider)
  );
}

export function saveProviderBinaryPath(
  provider: ConfigurableBinaryProvider,
  path: string | null,
): boolean {
  try {
    const stored = readProviderBinaryPaths();
    const value = path?.trim();
    if (value) stored[provider] = value;
    else delete stored[provider];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export async function applyProviderBinaryPath(
  provider: ConfigurableBinaryProvider,
  path: string | null,
): Promise<boolean> {
  try {
    const normalized = path?.trim().replace(/^"(.*)"$/, "$1") || null;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window)
      await invoke("managed_cli_save_path", { provider, path: normalized });
    if (!saveProviderBinaryPath(provider, normalized)) return false;
    if (normalized) runtimeBinaryPaths[provider] = normalized;
    else delete runtimeBinaryPaths[provider];
    window.dispatchEvent(new CustomEvent("mycode-cli-paths-changed", {detail:{provider}}));
    return true;
  } catch {
    return false;
  }
}
