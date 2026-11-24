import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`Studio preset and IM controls localize in ${theme}`, async ({
    page,
  }, info) => {
    await page.goto(
      `/tests/browser/connections.html?appearance&theme=${theme}`,
    );
    await page
      .getByRole("button", { name: "使用工作室主题", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-workspace-theme",
      "studio",
    );
    await expect(
      page.getByRole("button", { name: "使用工作室主题" }),
    ).toBeVisible();
    await page.screenshot({
      path: `build/studio-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.goto(`/tests/browser/connections.html?im-bots&theme=${theme}`);
    await expect(page.getByText("IM 插件更新", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "检查更新", exact: true })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "自动检查并下载兼容的 IM 插件更新" }),
    ).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "IM 机器人对话命令教程" }),
    ).toBeVisible();
    await page.screenshot({
      path: `build/im-plugin-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
  });
}
