import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"])
  for (const lang of ["zh-CN", "en"]) {
    test(`resident overview, settings and quoted composer in ${theme} ${lang}`, async ({
      page,
    }, info) => {
      await page.goto(`/tests/browser/monos.html?theme=${theme}&lang=${lang}`);
      const zh = lang === "zh-CN";
      const label = (en: string, cn: string) => (zh ? cn : en);
      const input = page.getByRole("textbox", {
        name: label("Message 小助手", "给小助手发消息"),
      });
      await expect(input).toBeVisible();
      await expect(input).toHaveValue("");
      const quote = page.getByLabel(label("Quoted context", "引用内容"), {
        exact: true,
      });
      await expect(quote).toContainText("Selected context");
      const tabs = page.getByRole("tablist");
      await expect(tabs).toBeVisible();
      await page
        .getByRole("tab", { name: label("Habits", "习惯任务"), exact: true })
        .click();
      await expect(page.locator('[data-mono-overview="habits"]')).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: label("New habit", "新建习惯任务"),
          exact: true,
        }),
      ).toBeEnabled();
      await page
        .getByRole("tab", { name: label("Documents", "文档"), exact: true })
        .click();
      await page.getByRole("button", { name: /发布检查/ }).click();
      await expect(page.locator('[data-artifact-reader="doc"]')).toContainText(
        "项目与模型配置已保留",
      );
      await page.getByRole("link", { name: "README", exact: true }).click();
      await expect(page.locator("[data-opened-file]")).toContainText(
        "README.md",
      );
      await page.keyboard.press("Escape");
      await expect(
        page.locator('[data-mono-overview="documents"]'),
      ).toBeVisible();
      await input.fill("请检查");
      await input.press("Enter");
      await expect(page.locator("[data-sent-message]")).toContainText(
        "The complete second line",
      );
      await expect(page.locator("[data-sent-message]")).toContainText("请检查");
      await expect(quote).toHaveCount(0);
      await expect(input).toHaveValue("");
      await page.screenshot({
        path: `build/021-overview-${info.project.name}-${theme}-${lang}.png`,
      });
      await page.locator("[data-open-settings]").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("textbox", {
          name: label("Name", "名称"),
          exact: true,
        }),
      ).toHaveValue("小助手");
      await expect(
        dialog.getByText(
          label("Show sessions in sidebar", "在侧边栏显示会话"),
          { exact: true },
        ),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: label("Soul", "角色指令"), exact: true })
        .click();
      await expect(dialog.locator("[data-mono-soul]")).toContainText(
        "Preserve project context.",
      );
      await dialog
        .getByRole("button", { name: label("Memory", "记忆"), exact: true })
        .click();
      await expect(dialog.locator("[data-mono-memory]")).toContainText(
        "Remember fixture context",
      );
      await page
        .locator("[data-switch-language]")
        .evaluate((button: HTMLElement) => button.click());
      await expect(
        dialog.getByRole("button", {
          name: label("记忆", "Memory"),
          exact: true,
        }),
      ).toBeVisible();
    });
  }

test("resident sidebar and Connections switch Chinese and English while mounted", async ({
  page,
}) => {
  await page.goto("/tests/browser/connections.html");
  await expect(page.getByText("常驻智能体", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加电脑", exact: true }).click();
  await expect(page.getByText("通过 SSH 连接", { exact: true })).toBeVisible();
  await page
    .locator("[data-switch-language]")
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.getByText("Monos", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Connect through SSH", { exact: true }),
  ).toBeVisible();
  await page
    .locator("[data-switch-language]")
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.getByText("常驻智能体", { exact: true })).toBeVisible();
  await expect(page.getByText("通过 SSH 连接", { exact: true })).toBeVisible();
});
