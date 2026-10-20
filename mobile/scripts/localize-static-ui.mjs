import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..", "src");
const props = new Set(["title", "placeholder", "accessibilityLabel", "label", "description"]);
const skip = new Set(["MyCode", "mycode://pair…"]);
let filesChanged = 0;
let stringsChanged = 0;

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path);
    else if (entry.name.endsWith(".tsx")) localize(path);
  }
}

function localize(path) {
  const original = readFileSync(path, "utf8");
  const hasImport = original.includes('import { t } from "@/ui/i18n";');
  const source = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const changes = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Text" && node.children.length && node.children.every(ts.isJsxText)) {
      const value = normalize(node.children.map((child) => child.text).join(""));
      if (/[A-Za-z]/.test(value) && !skip.has(value)) {
        changes.push({ start: node.children[0].pos, end: node.children.at(-1).end, value: `{t(${JSON.stringify(value)})}` });
      }
    }
    if (ts.isJsxAttribute(node) && props.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = normalize(node.initializer.text);
      if (/[A-Za-z]/.test(value) && !skip.has(value)) {
        changes.push({ start: node.initializer.getStart(source), end: node.initializer.end, value: `{t(${JSON.stringify(value)})}` });
      }
    }
    if (ts.isPropertyAssignment(node) && (node.name.getText(source) === "title" || node.name.getText(source) === "placeholder") && ts.isStringLiteral(node.initializer)) {
      const value = normalize(node.initializer.text);
      if (/[A-Za-z]/.test(value) && !skip.has(value))
        changes.push({ start: node.initializer.getStart(source), end: node.initializer.end, value: `t(${JSON.stringify(value)})` });
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const count = name === "Alert.alert" ? 2 : ["setError", "setCameraError"].includes(name) ? 1 : 0;
      for (const arg of node.arguments.slice(0, count)) {
        if (ts.isStringLiteral(arg) && /[A-Za-z]/.test(arg.text))
          changes.push({ start: arg.getStart(source), end: arg.end, value: `t(${JSON.stringify(arg.text)})` });
      }
    }
    if (ts.isNewExpression(node) && node.expression.getText(source) === "Error") {
      const arg = node.arguments?.[0];
      if (arg && ts.isStringLiteral(arg) && /[A-Za-z]/.test(arg.text))
        changes.push({ start: arg.getStart(source), end: arg.end, value: `t(${JSON.stringify(arg.text)})` });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!changes.length) return;
  let next = original;
  for (const change of changes.sort((a, b) => b.start - a.start))
    next = next.slice(0, change.start) + change.value + next.slice(change.end);
  const imports = source.statements.filter(ts.isImportDeclaration);
  const at = imports.at(-1)?.end ?? 0;
  if (!hasImport) next = next.slice(0, at) + '\nimport { t } from "@/ui/i18n";' + next.slice(at);
  writeFileSync(path, next);
  filesChanged++;
  stringsChanged += changes.length;
}

walkFiles(root);
process.stdout.write(`${stringsChanged} UI strings in ${filesChanged} files localized\n`);
