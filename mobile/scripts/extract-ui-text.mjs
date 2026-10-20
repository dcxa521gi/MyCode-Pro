import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..", "src");
const strings = new Map();
const mixed = [];
const props = new Set(["title", "placeholder", "accessibilityLabel", "label", "description"]);

function walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path);
    else if (entry.name.endsWith(".tsx")) inspect(path);
  }
}

function add(value, path) {
  const key = value.replace(/\s+/g, " ").trim();
  if (key && /[A-Za-z]/.test(key)) strings.set(key, [...(strings.get(key) ?? []), path]);
}

function inspect(path) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Text") {
      const text = node.children.filter(ts.isJsxText);
      if (text.length && node.children.every(ts.isJsxText)) add(text.map((child) => child.text).join(""), path);
      else if (text.some((child) => /[A-Za-z]/.test(child.text)))
        mixed.push(`${path}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}\t${text.map((child) => child.text).join(" ").replace(/\s+/g, " ").trim()}`);
    }
    if (ts.isJsxAttribute(node) && props.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer))
      add(node.initializer.text, path);
    ts.forEachChild(node, visit);
  }
  visit(source);
}

walkFiles(root);
for (const [value, paths] of [...strings].sort(([a], [b]) => a.localeCompare(b)))
  process.stdout.write(`${value}\t${paths.length}\n`);
if (process.argv.includes("--mixed")) for (const value of mixed) process.stderr.write(`${value}\n`);
