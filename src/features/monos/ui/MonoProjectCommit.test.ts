// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import { MonoProjectCommit } from "./MonoProjectCommit";
import { gitCommit, type GitDiffIndex } from "../../../platform/tauri/fs";
import { keepSessionChanges } from "../../sessions/model/checkpoint";

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../../../platform/tauri/fs", () => ({
  gitCommit: vi.fn(async () => {}),
  gitPrStatus: vi.fn(async () => null),
  notifyGitChanged: vi.fn(),
  subscribeGitChanged: () => () => {},
  basename: (path: string) => path.split("/").pop() ?? path,
}));
vi.mock("../../../integrations/harness", () => ({
  generateCommitMessage: vi.fn(),
  generatePrContent: vi.fn(),
}));
vi.mock("../../files/model/fileWatch", () => ({
  invalidateWatchedFiles: vi.fn(),
}));
vi.mock("../../inbox/model/inboxSelfActivity", () => ({
  recordInboxSelfActivity: vi.fn(),
}));
vi.mock("../../sessions/model/checkpoint", () => ({
  keepSessionChanges: vi.fn(async () => {}),
  notifyReviewChanged: vi.fn(),
}));

afterEach(() => {
  setLanguage("en");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("updates visible commit feedback on language changes without restarting its four-second lifetime", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage("en");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const file = {
    path: "/repo/change.txt",
    relative: "change.txt",
    status: "modified" as const,
    additions: 1,
    deletions: 0,
    staged: true,
    unstaged: false,
  };
  const index: GitDiffIndex = {
    branch: "feature",
    head: "abc",
    additions: 1,
    deletions: 0,
    remote: "",
    upstream: "",
    defaultBranch: "main",
    ahead: 0,
    behind: 0,
    aheadOfDefault: 0,
    headPushed: true,
    files: [file],
  };
  const reloadIndex = vi.fn();
  const render = (currentIndex: GitDiffIndex) =>
    act(async () =>
      root.render(
        createElement(MonoProjectCommit, {
          sessionId: "mono-feedback",
          cwd: "/repo",
          root: "/repo",
          files: [
            {
              relative: file.relative,
              file: { ...file, exact: true, undoable: true },
            },
          ],
          index: currentIndex,
          reloadIndex,
          onOpenFile: vi.fn(),
        }),
      ),
    );
  try {
    await render(index);
    const input = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(input, "Fix feedback");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Commit")!
        .click(),
    );
    expect(gitCommit).toHaveBeenCalledExactlyOnceWith(
      "/repo",
      "Fix feedback",
      false,
    );
    expect(keepSessionChanges).toHaveBeenCalledExactlyOnceWith(
      "mono-feedback",
      "/repo",
      "change.txt",
    );
    expect(reloadIndex).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Committed",
    );
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => setLanguage("zh-CN"));
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "已提交",
    );
    // Git reload can remove every changed file while feedback remains visible.
    await render({ ...index, files: [] });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "已提交",
    );
    await act(async () => setLanguage("en"));
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Committed",
    );
    await act(async () => vi.advanceTimersByTime(3000));
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "No uncommitted changes",
    );
    expect(gitCommit).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
