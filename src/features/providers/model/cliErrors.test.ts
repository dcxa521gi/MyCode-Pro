import { afterEach, expect, it } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import { cliErrorMessage } from "./cliErrors";

afterEach(() => setLanguage("en"));
it("translates installation failures without losing the diagnostic path", () => {
  const message =
    "CLI installation failed (exit code: 1). Diagnostic log: C:/项目/cli/install.log";
  setLanguage("zh-CN");
  expect(cliErrorMessage(message)).toContain("C:/项目/cli/install.log");
  expect(cliErrorMessage(message)).not.toContain("Diagnostic log:");
  setLanguage("en");
  expect(cliErrorMessage(message)).toBe(message);
});
it("translates an old-version warning and preserves vendor diagnostic details", () => {
  setLanguage("zh-CN");
  expect(cliErrorMessage("Still on 0.161.0 after updating.")).toContain(
    "0.161.0",
  );
  expect(cliErrorMessage("Still on 0.161.0 after updating.")).not.toContain(
    "Still on",
  );
  expect(cliErrorMessage(new Error("npm ERR! ECONNRESET"))).toBe(
    "npm ERR! ECONNRESET",
  );
});
