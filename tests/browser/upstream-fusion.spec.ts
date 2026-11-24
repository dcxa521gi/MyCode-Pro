import { test, expect } from "@playwright/test";
import path from "node:path";
for (const theme of ["light", "dark"]) {
  test(`model groups and plugin forms in ${theme}`, async ({ page }, info) => {
    await page.goto(`/tests/browser/connections.html?providers&theme=${theme}`);
    await page.getByText("模型组与账号池", { exact: true }).click();
    await page.getByRole("button", { name: "添加模型组", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "选择策略", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "添加模型来源", exact: true })
      .click();
    await page.getByText("星期与时段例外", { exact: true }).click();
    await page
      .getByRole("button", { name: "添加时段例外", exact: true })
      .click();
    await expect(
      page.getByLabel("Start time").or(page.getByLabel("开始时间")),
    ).toBeVisible();
    await page.screenshot({
      path: `build/fusion-groups-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByRole("checkbox", { name: "用于新会话" }).check();
    await page.reload();
    await page.getByText("模型组与账号池", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "用于新会话" }),
    ).toBeChecked();
    await page.goto(`/tests/browser/connections.html?plugins&theme=${theme}`);
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("docs/examples/project-review.plugin.json"));
    await page.getByRole("button", { name: "安装插件", exact: true }).click();
    await page.locator("summary").filter({ hasText: "项目审查" }).click();
    await page.getByRole("button", { name: "启用", exact: true }).click();
    await page.locator("[data-request-plugin]").click();
    await page.getByLabel("审查范围").fill("src/features/providers");
    await page.getByRole("button", { name: /关注点/ }).click();
    await page.getByRole("option", { name: "功能正确性", exact: true }).click();
    await page.screenshot({
      path: `build/fusion-plugin-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "确认并继续", exact: true }).click();
    await expect(page.locator("[data-plugin-result]")).toContainText(
      '"status":"completed"',
    );
    await page.goto(
      `/tests/browser/connections.html?plugins&theme=${theme}&lang=en`,
    );
    await expect(
      page.getByRole("heading", { name: "Local workflow plugins" }),
    ).toBeVisible();
    await expect(
      page.locator("summary").filter({ hasText: "Project review" }),
    ).toBeVisible();
  });
}
