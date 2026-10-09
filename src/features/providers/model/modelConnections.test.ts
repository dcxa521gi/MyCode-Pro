// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../sessions/model/models", () => ({
  setConnectionModels: vi.fn(),
}));
import { setLanguage } from "../../../shared/i18n";
import { connectionDisplayName } from "./modelConnections";
afterEach(() => setLanguage("en"));
it("localizes saved partner branding without rewriting connection data", () => {
  const saved = {
    name: "TokenDance · Partner",
    baseUrl: "https://tokendance.space/gateway/v1",
  };
  setLanguage("zh-CN");
  expect(connectionDisplayName(saved)).toContain("词元跳动");
  expect(connectionDisplayName(saved)).not.toContain("TokenDance");
  expect(saved.name).toBe("TokenDance · Partner");
  expect(saved.baseUrl).toBe("https://tokendance.space/gateway/v1");
  setLanguage("en");
  expect(connectionDisplayName(saved)).toBe("TokenDance · Partner");
});
it("preserves user-defined names and endpoints", () => {
  setLanguage("zh-CN");
  expect(
    connectionDisplayName({
      name: "我的工作账号",
      baseUrl: "https://tokendance.space/gateway/v1",
    }),
  ).toBe("我的工作账号");
  expect(
    connectionDisplayName({
      name: "TokenDance research",
      baseUrl: "https://example.com/v1",
    }),
  ).toBe("TokenDance research");
});
