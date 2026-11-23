import { describe, expect, it } from "vitest";
import { markdownBlockDirection } from "./markdownDirection";

describe("markdownBlockDirection", () => {
  it("uses the dominant prose language when a Persian sentence starts in English", () => {
    expect(markdownBlockDirection("Actually این متن فارسی است و باید راست به چپ نمایش داده شود.")).toBe("rtl");
  });

  it("keeps an English paragraph with a Hebrew term left to right", () => {
    expect(markdownBlockDirection("The status is שלום but the rest is English text.")).toBe("ltr");
  });

  it("does not let inline code and links decide the surrounding direction", () => {
    expect(markdownBlockDirection("`src/app/layout.tsx` این متن فارسی است و ادامه دارد [docs](https://example.com/english/path)")).toBe("rtl");
  });

  it("ignores fenced code before surrounding prose", () => {
    expect(markdownBlockDirection("```ts\nconst value = true;\n```\nاین متن فارسی است و ادامه دارد")).toBe("rtl");
  });
});
