import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const bytes = fs.readFileSync("src-tauri/runtime/im-bridge.cjs");
if (bytes.length > 32 * 1024 * 1024)
  throw Error("IM plugin exceeds the desktop limit");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const file = `im-bridge-${version}-${sha256}.cjs`;
const out = path.resolve(`build/im-plugin-${version}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, file), bytes);
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(
    { version, minAppVersion: "0.24.1", protocol: 1, sha256, file },
    null,
    2,
  ) + "\n",
);
fs.copyFileSync(
  "src-tauri/runtime/THIRD-PARTY-LICENSES.txt",
  path.join(out, "THIRD-PARTY-LICENSES.txt"),
);
fs.copyFileSync("vendor/cindy-im/LICENSE", path.join(out, "CINDY-LICENSE"));
fs.copyFileSync("vendor/cindy-im/NOTICE.md", path.join(out, "CINDY-NOTICE.md"));
for (const name of [
  "WECHAT-NOTICE.md",
  "WECHAT-UPSTREAM.md",
  "WECHAT-TENCENT-LICENSE",
]) {
  fs.copyFileSync(path.join("src-tauri/runtime", name), path.join(out, name));
}
console.log(`${out}\n${sha256}  ${file}`);
