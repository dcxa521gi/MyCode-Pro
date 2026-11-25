// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import { WORKBENCH_TASKS } from "./workbench";
import {
  STUDIO_SPECS,
  studioDefaults,
  studioPrompt,
  studioMediaOptions,
  validateStudio,
  studioText,
} from "./studio";
afterEach(() => setLanguage("en"));
it("provides complete localized briefs for every creative tool", () => {
  for (const task of WORKBENCH_TASKS) {
    const spec = STUDIO_SPECS[task.id];
    const defaults = studioDefaults(task.id);
    expect(validateStudio(task.id, defaults)).toBeNull();
    setLanguage("zh-CN");
    expect(studioText(spec.prompt)).toMatch(/[\u4e00-\u9fff]/);
    for (const f of spec.fields) {
      expect(studioText(f.label)).toMatch(/[\u4e00-\u9fff]/);
      const value =
        f.kind === "textarea" || f.kind === "text"
          ? "my-specific-direction"
          : f.value;
      const prompt = studioPrompt(task.id, "my brief", {
        ...defaults,
        [f.id]: value,
      });
      expect(prompt).toContain("my brief");
      if (value !== "auto") expect(prompt).toContain(`${studioText(f.label)}:`);
    }
  }
});
it("rejects invalid lengths and only forwards provider media parameters", () => {
  expect(
    validateStudio("novel", { ...studioDefaults("novel"), chapters: "-1" }),
  ).not.toBeNull();
  expect(
    validateStudio("novel", { ...studioDefaults("novel"), genre: "unknown" }),
  ).not.toBeNull();
  expect(
    studioMediaOptions("text-image", {
      ...studioDefaults("text-image"),
      size: "1536x1024",
      n: "2",
      style: "watercolor",
      arbitrary: "secret",
    }),
  ).toEqual({ size: "1536x1024", n: 2 });
  expect(
    studioMediaOptions("text-video", {
      ...studioDefaults("text-video"),
      seconds: "8",
    }),
  ).toEqual({ seconds: "8" });
  expect(studioMediaOptions("novel", studioDefaults("novel"))).toEqual({});
});
