import { expect, it } from "vitest";
import { assertIMNotificationOwner } from "../../../../runtime/im-notification-route";

it("rejects provider wake delivery after the original bot owner changes", () => {
  expect(() =>
    assertIMNotificationOwner("original-owner", "new-owner"),
  ).toThrow();
  expect(() =>
    assertIMNotificationOwner("original-owner", "original-owner"),
  ).not.toThrow();
  expect(() =>
    assertIMNotificationOwner(undefined, "current-owner"),
  ).not.toThrow();
  expect(() =>
    assertIMNotificationOwner("original-owner", "original-owner", false),
  ).toThrow();
});
