import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..", "src");
const catalog = readFileSync(join(root, "ui", "i18n.ts"), "utf8");
const source = ts.createSourceFile("i18n.ts", catalog, ts.ScriptTarget.Latest, true);
const known = new Set();
function readCatalog(node) {
  if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) known.add(node.name.text);
  ts.forEachChild(node, readCatalog);
}
readCatalog(source);
const missing = new Map();
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) inspect(path);
  }
}
function inspect(path) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "t" && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text;
      if (!known.has(key) && key !== "MyCode") missing.set(key, path);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
scan(root);
for (const [key, path] of missing) process.stdout.write(`${key}\t${path}\n`);
if (missing.size) process.exitCode = 1;
