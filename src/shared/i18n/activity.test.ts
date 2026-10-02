import { afterEach, expect, it } from "vitest";
import { setLanguage } from ".";
import { translateActivity } from "./activity";
afterEach(() => setLanguage("en"));
it("localizes activity grammar while preserving paths and arbitrary agent prose", () => {
  setLanguage("zh-CN");
  expect(translateActivity("Editing README.md")).toBe("正在编辑 README.md");
  expect(translateActivity("Ran 2 commands · Edited 3 files")).toBe(
    "已运行 2 条命令 · 已编辑 3 个文件",
  );
  expect(translateActivity("Section numbering collided")).toBe(
    "Section numbering collided",
  );
  expect(translateActivity("Read C:\\path with spaces\\code.ts")).toBe(
    "已读取 C:\\path with spaces\\code.ts",
  );
});
