import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const out = path.resolve("src-tauri/runtime");
fs.mkdirSync(out, { recursive: true });
await build({entryPoints:["runtime/development-test.ts"],outfile:path.join(out,"development-test.cjs"),bundle:true,platform:"node",target:"node22",format:"cjs",external:["bufferutil","utf-8-validate"],logLevel:"warning"});
const bundle = await build({
  entryPoints: ["runtime/im-bridge.ts"],
  outfile: path.join(out, "im-bridge.cjs"),
  bundle: true,
  metafile: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["bufferutil", "utf-8-validate", "zlib-sync"],
  logLevel: "warning",
});
const nodeTarget = path.join(
  out,
  process.platform === "win32" ? "node.exe" : "node",
);
const digest = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
if (
  !fs.existsSync(nodeTarget) ||
  digest(process.execPath) !== digest(nodeTarget)
)
  fs.copyFileSync(process.execPath, nodeTarget);
if (process.platform !== "win32") fs.chmodSync(path.join(out, "node"), 0o755);
const candidates = [
  path.join(path.dirname(process.execPath), "node_modules/npm"),
  path.join(path.dirname(process.execPath), "../lib/node_modules/npm"),
];
let npmRoot = candidates.find((p) =>
  fs.existsSync(path.join(p, "bin/npm-cli.js")),
);
if (!npmRoot) {
  try {
    npmRoot = path.dirname(require.resolve("npm/package.json"));
  } catch {}
}
if (!npmRoot) throw new Error("npm runtime not found next to Node.js");
fs.cpSync(npmRoot, path.join(out, "npm"), { recursive: true });
const nodeLicense = path.join(path.dirname(process.execPath), "LICENSE");
if (fs.existsSync(nodeLicense))
  fs.copyFileSync(nodeLicense, path.join(out, "NODE-LICENSE"));
else {
  const response = await fetch(
    "https://raw.githubusercontent.com/nodejs/node/" +
      process.version +
      "/LICENSE",
  );
  if (!response.ok) throw new Error("Node license download failed");
  fs.writeFileSync(path.join(out, "NODE-LICENSE"), await response.text());
}
fs.copyFileSync("vendor/cindy-im/LICENSE", path.join(out, "CINDY-LICENSE"));
fs.copyFileSync("vendor/cindy-im/NOTICE.md", path.join(out, "CINDY-NOTICE.md"));
fs.copyFileSync(
  "vendor/cindy-wechat-ilink/NOTICE.md",
  path.join(out, "WECHAT-NOTICE.md"),
);
fs.copyFileSync(
  "vendor/cindy-wechat-ilink/UPSTREAM.md",
  path.join(out, "WECHAT-UPSTREAM.md"),
);
fs.copyFileSync(
  "vendor/cindy-wechat-ilink/LICENSE.tencent-openclaw-weixin",
  path.join(out, "WECHAT-TENCENT-LICENSE"),
);
console.log("MyCode runtime prepared (Node.js, npm and local IM transports).");

const roots = new Set();
for (const input of Object.keys(bundle.metafile.inputs)) {
  const parts = input.replaceAll("\\", "/").split("/");
  const index = parts.lastIndexOf("node_modules");
  if (index < 0) continue;
  roots.add(
    parts
      .slice(0, index + (parts[index + 1]?.startsWith("@") ? 3 : 2))
      .join("/"),
  );
}
const licenses = [];
for (const root of [...roots].sort()) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  licenses.push(
    "\n## " + pkg.name + " " + pkg.version + " (" + pkg.license + ")\n",
  );
  for (const name of fs
    .readdirSync(root)
    .filter((n) => /^(license|licence|copying|notice)(\.|$)/i.test(n))) {
    const file = path.join(root, name);
    if (fs.statSync(file).isFile())
      licenses.push(fs.readFileSync(file, "utf8"));
  }
}
fs.writeFileSync(
  path.join(out, "THIRD-PARTY-LICENSES.txt"),
  licenses.join("\n"),
);
