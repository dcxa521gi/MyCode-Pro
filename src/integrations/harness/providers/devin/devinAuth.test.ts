import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../../platform/tauri/fs", () => ({ homeDir: async () => "C:/Users/test" }));
vi.mock("../../core/child", () => ({ execChild: vi.fn(), readHarnessTextFile: vi.fn() }));
import { execChild, readHarnessTextFile } from "../../core/child";
import { readDevinApiKey } from "./devinAuth";
beforeEach(() => { vi.resetAllMocks(); });
it("resolves the current profile instead of retaining the previous credential path", async () => {
  vi.mocked(execChild).mockResolvedValueOnce("Credentials path: D:/profile-a/credentials.toml").mockResolvedValueOnce("Credentials path: D:/profile-b/credentials.toml");
  vi.mocked(readHarnessTextFile).mockImplementation(async (path) => `api_key = "${path.includes("profile-a") ? "a" : "b"}"`);
  expect(await readDevinApiKey("devin")).toBe("a");
  expect(await readDevinApiKey("devin")).toBe("b");
});
it("does not substitute another account when the selected profile is unreadable", async () => {
  vi.mocked(execChild).mockResolvedValue("Credentials path: D:/selected/credentials.toml");
  vi.mocked(readHarnessTextFile).mockRejectedValue(Error("denied"));
  expect(await readDevinApiKey("devin")).toBeNull();
  expect(readHarnessTextFile).toHaveBeenCalledTimes(1);
});
