import { describe, it, expect } from "vitest";
import {
  numberedNewline,
  shouldSend,
  encodeContextDraft,
  decodeContextDraft,
  contextPrompt,
} from "./composerBehavior";
describe("composer input behavior", () => {
  it("separates Enter, Ctrl+Enter, Shift and composition callers", () => {
    const e = {
      key: "Enter",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    };
    expect(shouldSend(e, "enter")).toBe(true);
    expect(shouldSend(e, "ctrl-enter")).toBe(false);
    expect(shouldSend({ ...e, ctrlKey: true }, "ctrl-enter")).toBe(true);
    expect(shouldSend({ ...e, shiftKey: true }, "enter")).toBe(false);
  });
  it.each([
    ["1", "1\n2"],
    ["1、第一项", "1、第一项\n2、"],
    ["  9. item", "  9. item\n  10. "],
    ["1 内容", "1 内容\n2 "],
  ])("continues %s", (input, output) => {
    expect(numberedNewline(input, input.length, input.length)?.text).toBe(
      output,
    );
  });
  it("does not number years or replace selected text", () => {
    expect(numberedNewline("2026年", 5, 5)).toBeNull();
    expect(numberedNewline("1. abc", 3, 6)).toBeNull();
  });
  it("stores full references separately from typed thoughts and submits both", () => {
    const draft = encodeContextDraft("我的想法", ["第一行\n第二行", "file.ts"]);
    expect(decodeContextDraft(draft)).toEqual({
      text: "我的想法",
      quotes: ["第一行\n第二行", "file.ts"],
    });
    expect(contextPrompt("我的想法", ["第一行\n第二行"])).toBe(
      "> 第一行\n> 第二行\n\n我的想法",
    );
    expect(decodeContextDraft("ordinary")).toEqual({
      text: "ordinary",
      quotes: [],
    });
  });
});
