import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`provider rows toggle through mouse and keyboard and localize live in ${theme}`, async ({
    page,
  }, info) => {
    await page.goto(`/tests/browser/connections.html?providers&theme=${theme}`);
    const rows = page.locator('[role="button"][aria-expanded]');
    const first = rows.filter({ hasText: "tokendance.space" });
    const second = rows.filter({ hasText: "xiaomimimo.com" });
    await expect(rows).toHaveCount(2);
    const expanded = async (row: typeof first, on: boolean) => {
      await expect(row).toHaveAttribute("aria-expanded", String(on));
      if (on) await expect(row.locator("svg").first()).toHaveClass(/rotate-90/);
      else
        await expect(row.locator("svg").first()).not.toHaveClass(/rotate-90/);
    };
    await expanded(first, true);
    await expanded(second, false);
    await first.click();
    await expanded(first, false);
    await expect(
      page.locator("strong").filter({ hasText: /^cogevol-base$/ }),
    ).toHaveCount(0);
    await first.focus();
    await first.press("Enter");
    await expanded(first, true);
    await second.click();
    await expanded(second, true);
    await expanded(first, false);
    await expect(
      page.locator("strong").filter({ hasText: /^cogevol-base$/ }),
    ).toHaveCount(0);
    await second.click();
    await expanded(second, false);
    await first.focus();
    await first.press("Enter");
    await expanded(first, true);
    await expect(
      page.locator("strong").filter({ hasText: /^cogevol-base$/ }),
    ).toBeVisible();
    await first.press("Space");
    await expanded(first, false);
    await second.focus();
    await second.press("Space");
    await expanded(second, true);
    await expect(
      page.locator("strong").filter({ hasText: /^mimo-v2\.5$/ }),
    ).toBeVisible();
    await expanded(first, false);
    await second.press("Enter");
    await expanded(second, false);
    await first.click();
    await expanded(first, true);
    await page.locator("[data-switch-language]").click();
    await expect(
      first.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    await expanded(first, true);
    await page.screenshot({
      path: `build/021-providers-${info.project.name}-${theme}-en.png`,
      fullPage: true,
    });
    await page.locator("[data-switch-language]").click();
    await expect(
      first.getByRole("button", { name: "编辑", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `build/021-providers-${info.project.name}-${theme}-zh.png`,
      fullPage: true,
    });
    await first.getByRole("button", { name: "编辑", exact: true }).click();
    await expanded(first, false);
    await expect(page.getByRole("textbox").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.locator("section").filter({ has: page.locator("h3") }),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "关闭", exact: true })
      .click();
    await expanded(first, true);
    await first.getByRole("button", { name: "编辑", exact: true }).focus();
    await first
      .getByRole("button", { name: "编辑", exact: true })
      .press("Enter");
    await expanded(first, false);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
