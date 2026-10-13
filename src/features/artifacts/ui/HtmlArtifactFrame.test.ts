// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import { HtmlArtifactFrame } from "./HtmlArtifactFrame";
import { setLanguage } from "../../../shared/i18n";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../artifacts", () => ({
  htmlArtifactUrl: () => "about:blank",
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage("en");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      createElement(HtmlArtifactFrame, {
        id: "visual",
        title: "Chart",
        version: 1,
      }),
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setLanguage("en");
  vi.unstubAllGlobals();
});
function post(
  data: unknown,
  source = container.querySelector("iframe")!.contentWindow,
) {
  act(() =>
    window.dispatchEvent(new MessageEvent("message", { data, source })),
  );
}
it("freezes the first page request and refuses synthetic parent authorization", () => {
  container.querySelector("iframe")!.focus();
  post({ type: "monocode:open-link", url: "https://example.test/report" });
  post({ type: "monocode:open-link", url: "https://example.test/swapped" });
  expect(container.textContent).toContain("https://example.test/report");
  expect(container.textContent).not.toContain("swapped");
  act(() => container.querySelector("button")!.click());
  expect(openUrl).not.toHaveBeenCalled();
});
it("rejects foreign windows, unfocused requests and non-web destinations", () => {
  post({ type: "monocode:open-link", url: "https://example.test/report" });
  container.querySelector("iframe")!.focus();
  post(
    { type: "monocode:open-link", url: "https://example.test/report" },
    window,
  );
  for (const url of [
    "file:///secret",
    "javascript:alert(1)",
    "mailto:test@example.test",
    "https://[",
  ])
    post({ type: "monocode:open-link", url });
  expect(container.querySelector("[role=group]")).toBeNull();
  expect(openUrl).not.toHaveBeenCalled();
});
it("updates the frozen consent labels when the language changes", () => {
  container.querySelector("iframe")!.focus();
  post({ type: "monocode:open-link", url: "https://example.test/report" });
  act(() => setLanguage("zh-CN"));
  expect(
    container.querySelector("[role=group]")?.getAttribute("aria-label"),
  ).toBe("打开外部链接");
  expect(container.textContent).toContain("打开链接");
  expect(container.textContent).toContain("https://example.test/report");
  act(() => setLanguage("en"));
  expect(container.textContent).toContain("Open link");
});
it("keeps height and theme messaging working and clears consent on artifact reload", () => {
  const frame = container.querySelector("iframe")!;
  post({ type: "monocode:height", height: 460.5 });
  expect(frame.style.height).toBe("461px");
  post({ type: "monocode:height", height: 1 });
  expect(frame.style.height).toBe("80px");
  post({ type: "monocode:height", height: Infinity });
  expect(frame.style.height).toBe("80px");
  frame.focus();
  post({ type: "monocode:open-link", url: "https://example.test/report" });
  expect(container.querySelector("[role=group]")).not.toBeNull();
  act(() =>
    root.render(
      createElement(HtmlArtifactFrame, {
        id: "visual",
        title: "Chart",
        version: 2,
      }),
    ),
  );
  expect(container.querySelector("[role=group]")).toBeNull();
  expect(frame.style.height).toBe("240px");
  const send = vi.spyOn(frame.contentWindow!, "postMessage");
  post({ type: "monocode:ready" });
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ type: "monocode:theme" }),
    "*",
  );
});
