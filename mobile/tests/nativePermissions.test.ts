// @vitest-environment node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";

let ios: {
  infoPlist: { NSMicrophoneUsageDescription?: string };
  entitlements: Record<string, unknown>;
};
let android: {
  manifest: { manifest: { "uses-permission": Array<{ $: Record<string, string> }> } };
};

beforeAll(() => {
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("../node_modules/expo/bin/cli", import.meta.url)),
      "config",
      "--type",
      "introspect",
      "--json",
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, EXPO_NO_DOTENV: "1" },
      timeout: 25_000,
    },
  );
  const native = JSON.parse(output)._internal.modResults;
  ios = native.ios;
  android = native.android;
}, 30_000);

it("keeps a microphone purpose string after all Expo plugins run", () => {
  // Plugins share the same Info.plist: disabling microphone access in a
  // camera or image-picker plugin can erase the audio plugin's description.
  const description = ios.infoPlist.NSMicrophoneUsageDescription;
  // iOS terminates the app if it requests microphone access without this.
  expect(description).toEqual(expect.any(String));
  expect(description?.trim().length).toBeGreaterThan(0);
});

it("keeps local session notifications compatible with signing profiles without APNs", () => {
  expect(ios.entitlements).not.toHaveProperty("aps-environment");
});

it("keeps Android camera permission available for QR pairing", () => {
  const camera = android.manifest.manifest["uses-permission"].find(
    (permission) => permission.$["android:name"] === "android.permission.CAMERA",
  );
  expect(camera).toBeDefined();
  expect(camera?.$["tools:node"]).not.toBe("remove");
});
