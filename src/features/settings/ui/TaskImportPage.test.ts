// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createElement } from "react";
import { TaskImportPage } from "./TaskImportPage";
import { setLanguage } from "../../../shared/i18n";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("keeps successful imports and retries only the failed selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage("en");
  let failed = true;
  vi.mocked(invoke).mockImplementation(async (command, args: any) => {
    if (command === "task_import_scan")
      return ["a", "b"].map((id) => ({
        id,
        title: id,
        source: "codex",
        cwd: "/repo",
        turns: 1,
        existing: false,
      }));
    if (command === "task_import_commit") {
      if (args.id === "b" && failed) throw Error("disk busy");
      return { id: args.id, title: args.id };
    }
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(TaskImportPage)));
    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((b) =>
        b.textContent?.startsWith(label),
      );
      expect(button).toBeDefined();
      await act(async () => button!.click());
    };
    await click("Scan local tasks");
    for (const input of container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ))
      await act(async () => input.click());
    await click("Import selected");
    expect(container.textContent).toContain(
      "Completed imports have been kept.",
    );
    expect(container.textContent).toContain("Import selected (1)");
    failed = false;
    await click("Import selected");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(
          ([command, args]) =>
            command === "task_import_commit" && (args as any).id === "a",
        ),
    ).toHaveLength(1);
    expect(container.textContent).toContain("Import completed.");
    await act(async () =>
      root.render(createElement("div", null, "Another settings page")),
    );
    await act(async () => root.render(createElement(TaskImportPage)));
    expect(container.textContent).toContain("Open task: a");
    expect(container.querySelectorAll("[role=radio]")).toHaveLength(5);
    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "task_import_scan"),
    ).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
