import { expect, test } from "@playwright/test";
test("Magpie preset configures three runtime endpoints and keeps supplier routes distinct", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/tests/browser/connections.html?providers&theme=light");
  await page.evaluate(() => {
    const host = window as any;
    const original = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command === "local_ai_discover_models")
        return Object.fromEntries(
          ["one/chat", "two/chat"].map((id) => [
            id,
            {
              name: "Same model",
              nativeApi: "anthropic-messages",
              discoveredSource: {
                kind: "magpie",
                providerId: id.split("/")[0],
                discoveredName: "Same model",
                label: "Same model · My supplier",
              },
            },
          ]),
        );
      if (command === "local_ai_save_connection") {
        host.savedMagpie = args;
        return null;
      }
      return original(command, args);
    };
  });
  await page.getByRole("button", { name: "添加服务商", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索服务商" }).fill("Magpie");
  await page.getByRole("button", { name: /Magpie.*3425/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Claude Code · Messages")).toHaveValue(
    "http://127.0.0.1:3425",
  );
  await expect(modal.getByLabel("Codex · Responses")).toHaveValue(
    "http://127.0.0.1:3425/v1",
  );
  await expect(modal.getByLabel("Pi / OpenCode · Chat")).toHaveValue(
    "http://127.0.0.1:3425/v1",
  );
  await modal
    .getByLabel("Codex · Responses")
    .fill("https://gateway.example/codex/v1");
  await modal.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(
    modal.getByText("My supplier · one", { exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByText("My supplier · two", { exact: true }),
  ).toBeVisible();
  const choices = modal.getByRole("checkbox").filter({ visible: true });
  await choices.first().check();
  await choices.nth(1).check();
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await expect(modal).not.toBeVisible();
  const saved = await page.evaluate(() => (window as any).savedMagpie);
  expect(saved.connection.gateway).toBe("magpie");
  expect(saved.connection.models).toEqual(["one/chat", "two/chat"]);
  expect(saved.connection.magpieEndpoints.codex).toBe(
    "https://gateway.example/codex/v1",
  );
});
