// An app-owned, revocable MCP transport. No global daemon or Cindy services.
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const [binary, configPath, generation] = process.argv.slice(2);
const allowed = () => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return (
      config.enabled &&
      config.generation === generation &&
      config.binary === binary
    );
  } catch {
    return false;
  }
};
if (!allowed()) process.exit(0);
const child = spawn(binary, ["mcp", "--direct", "--embedded"], {
  windowsHide: true,
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    CUA_DRIVER_RS_TELEMETRY_ENABLED: "false",
    CUA_DRIVER_RS_UPDATE_CHECK: "false",
  },
});
let ending = false;
const stop = () => {
  if (ending) return;
  ending = true;
  child.kill();
  setTimeout(() => process.exit(0), 200).unref();
};
child.on("error", () => {
  process.stderr.write("Could not start local Cua Driver.\n");
  process.exit(1);
});
child.on("exit", () => process.exit(0));
child.stdin.on("error", stop);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
readline
  .createInterface({ input: process.stdin })
  .on("line", (line) => {
    if (!allowed()) {
      stop();
      return;
    }
    child.stdin.write(line + "\n");
  })
  .on("close", stop);
const timer = setInterval(() => {
  if (!allowed()) stop();
}, 100);
timer.unref();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.on("exit", () => child.kill());
