import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url).href);

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": `${root}src`,
      react: `${root}node_modules/react`,
      "react-dom": `${root}node_modules/react-dom`,
      "expo-localization": `${root}tests/mocks/expoLocalization.ts`,
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "happy-dom",
    // Protocol round trips need both the desktop and mobile dependency trees.
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      // Vite resolves a cross-root ../ glob as a URL on Windows and then
      // cannot load the file. Run this protocol test from the root config there.
      ...(process.platform === "win32" ? [] : ["../tests/mobile/**/*.test.ts"]),
    ],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
