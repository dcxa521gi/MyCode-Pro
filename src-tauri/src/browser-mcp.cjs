// Isolated, app-owned Chromium. Disabling the setting revokes running bridges.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const [root, generation] = process.argv.slice(2);
function allowed() {
  try {
    const c = JSON.parse(
      fs.readFileSync(path.join(root, "browser.json"), "utf8"),
    );
    return c.enabled && c.generation === generation;
  } catch {
    return false;
  }
}
if (!allowed()) process.exit(0);
const child = spawn(
  process.execPath,
  [
    path.join(
      root,
      process.platform === "win32"
        ? "node_modules/@playwright/mcp/cli.js"
        : "lib/node_modules/@playwright/mcp/cli.js",
    ),
    "--headless",
    "--isolated",
    "--browser",
    "chromium",
    "--output-dir",
    path.join(root, "output"),
  ],
  {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(root, "browsers"),
    },
  },
);
let ending = false;
function stop() {
  if (ending) return;
  ending = true;
  child.stdin.end();
  setTimeout(() => {
    child.kill();
    process.exit(0);
  }, 1500).unref();
}
child.on("error", () => {
  process.stderr.write("Could not start MyCode headless browser.\n");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code || 0));
child.stdin.on("error", stop);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
readline
  .createInterface({ input: process.stdin })
  .on("line", (line) => {
    if (!allowed()) return stop();
    child.stdin.write(line + "\n");
  })
  .on("close", stop);
setInterval(() => {
  if (!allowed()) stop();
}, 200).unref();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", () => child.kill());
