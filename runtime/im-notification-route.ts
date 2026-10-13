/** Wake notifications retain the sender authority of their original IM turn. */
export function assertIMNotificationOwner(
  expected: unknown,
  current: string,
  connected = true,
): void {
  if (
    expected !== undefined &&
    (typeof expected !== "string" ||
      !expected ||
      expected !== current ||
      !connected)
  )
    throw Error("The original IM owner is no longer connected");
}
