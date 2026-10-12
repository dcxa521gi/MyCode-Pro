import { expect, test } from "@playwright/test";

test("emoji picker searches, picks, remembers and jumps to categories", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/tests/browser/emoji-picker.html", {
    waitUntil: "domcontentloaded",
    timeout: 150000,
  });
  const picker = page.locator("[data-emoji-picker]");
  await expect(picker.getByRole("gridcell").first()).toBeVisible();
  await expect(picker.getByRole("searchbox")).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("open.png") });

  await picker.getByRole("searchbox").fill("rocket");
  await expect(picker.getByRole("gridcell", { name: "Rocket" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("search.png") });
  await picker.getByRole("gridcell", { name: "Rocket" }).click();
  await expect(page.locator("[data-picked]")).toHaveText("🚀");
  await expect(picker).toHaveCount(0);

  // Reopened, the pick leads the recents and the flags are a jump away.
  await page.getByRole("button", { name: "Open" }).click();
  await expect(picker.getByRole("button", { name: "🚀" })).toBeVisible();
  await picker.getByRole("button", { name: "Jump to category 9" }).click();
  await expect(picker.getByText("Flags", { exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("flags.png") });

  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
});

test("emoji picker uses bundled Chinese labels, remembers picks and switches languages while open", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/tests/browser/emoji-picker.html?lang=zh-CN", {
    waitUntil: "domcontentloaded",
    timeout: 150000,
  });
  const picker = page.locator("[data-emoji-picker]");
  const search = picker.getByRole("searchbox", { name: "搜索表情" });
  await expect(search).toBeFocused();
  await search.fill("火箭");
  await expect(
    picker.getByRole("gridcell", { name: "火箭", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("emoji-search-zh.png") });
  await picker.getByRole("gridcell", { name: "火箭", exact: true }).click();
  await expect(page.locator("[data-picked]")).toHaveText("🚀");
  await page.getByRole("button", { name: "打开", exact: true }).click();
  await expect(picker.getByText("最近使用", { exact: true })).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "🚀", exact: true }),
  ).toBeVisible();
  // Use the preference handler without an outside pointerdown, which would correctly dismiss the picker.
  await page
    .locator("[data-switch-language]")
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(
    picker.getByRole("searchbox", { name: "Search emoji" }),
  ).toBeVisible();
  await picker.getByRole("searchbox").fill("rocket");
  await expect(
    picker.getByRole("gridcell", { name: "Rocket", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("emoji-search-en.png") });
  await picker.getByRole("searchbox").fill("");
  // Use the preference handler without an outside pointerdown, which would correctly dismiss the picker.
  await page
    .locator("[data-switch-language]")
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(
    picker.getByRole("searchbox", { name: "搜索表情" }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "跳转至第 9 类", exact: true })
    .click();
  await expect(picker.getByText("旗帜", { exact: true })).toBeInViewport();
});
