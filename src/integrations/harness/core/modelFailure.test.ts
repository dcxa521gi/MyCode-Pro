import { expect, it } from "vitest";
import { modelFailureMessage } from "./modelFailure";
it("distinguishes billing from routing and official login from custom authentication", () => {
  expect(modelFailureMessage("Insufficient credits. This account never purchased credits.", false)).toContain("balance");
  expect(modelFailureMessage("Not logged in · Please run /login", false)).toContain("own account");
  expect(modelFailureMessage("Not logged in · Please run /login", true)).toContain("protocol");
  expect(modelFailureMessage("401 Authentication Fails", true)).toContain("endpoint");
  expect(modelFailureMessage("Unrelated failure", false)).toBe("Unrelated failure");
});
