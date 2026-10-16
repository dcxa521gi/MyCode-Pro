import { describe, expect, it } from "vitest";
import { formatIMProjects, parseIMProjectCommand } from "./imProjects";

describe("IM project commands", () => {
  it("recognizes project questions and explicit commands", () => {
    expect(parseIMProjectCommand("总共有哪些已完结项目？")).toEqual({ kind: "list", page: 1, completedQuestion: true });
    expect(parseIMProjectCommand("/项目 2")).toEqual({ kind: "list", page: 2, completedQuestion: false });
    expect(parseIMProjectCommand("/切换项目 3")).toEqual({ kind: "switch", selector: "3" });
    expect(parseIMProjectCommand("/新建项目 新站 | 做一个首页")).toEqual({ kind: "create", name: "新站", prompt: "做一个首页" });
  });
  it("does not claim completion without a completion marker", () => {
    expect(formatIMProjects(["F:/work/one"], 1, true)).toContain("尚无可靠的“项目已完结”标记");
  });
});
