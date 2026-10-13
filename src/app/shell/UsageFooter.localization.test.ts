// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { UsageFooter } from "./UsageFooter";
import { setLanguage } from "../../shared/i18n";

afterEach(() => setLanguage("en"));

it.each([
  ["en", "Terminal"],
  ["zh-CN", "终端"],
] as const)("keeps the extracted footer controls in %s", (language, label) => {
  setLanguage(language);
  const markup = renderToStaticMarkup(createElement(UsageFooter, {
    providers: [], onNewTerminal: vi.fn(),
  }));
  expect(markup).toContain(`>${label}</span>`);
  if (language === "zh-CN")
    expect(markup).not.toContain('aria-label="Terminals"');
});
