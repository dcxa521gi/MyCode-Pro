import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1360, height: 900 } });
test("workbench stays reachable across themes and uses the selected provider without duplicate submissions", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("pageerror", (error) => console.error("PAGE ERROR", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER", message.text()); });
  await page.addInitScript(() => localStorage.setItem("monocode.insetLayout", "1"));
  await page.goto("/tests/browser/workspace-performance.html");
  await expect(page.getByRole("button", { name: "Workbench", exact: true })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(async () => {
    const i18n = await import("/src/shared/i18n/index.ts"); i18n.setLanguage("zh-CN");
    const host = window as any; host.mediaRequests = [];
    const invoke = host.__TAURI_INTERNALS__.invoke;
    host.__TAURI_INTERNALS__.invoke = async (command: string, args: any) => {
      if (command === "default_workspace") return "D:/creative-project";
      if (command === "local_ai_config") return { connections: [{ id: "magpie", name: "Magpie", enabled: true, hasKey: false, gateway: "magpie", api: "openai-completions", baseUrl: "http://127.0.0.1:3425/v1", models: ["vendor/draw", "vendor/chat"], modelMetadata: { "vendor/draw": { name: "绘画模型", mode: "image", modalities: ["text", "image"], outputModalities: ["image"] }, "vendor/chat": { mode: "chat", outputModalities: ["text"] } } }], memory: "", projectMemories: {}, mcpServers: null };
      if (command === "workbench_request") { host.mediaRequests.push(args.request); await new Promise((resolve) => setTimeout(resolve, 400)); return { status: "completed", paths: [], text: "测试接口已完成" }; }
      if (command === "workbench_result") return null;
      return invoke(command, args);
    };
  });
  await page.getByRole("button", { name: "工作台", exact: true }).click();
  const workbench = page.getByRole("region", { name: "工作台", exact: true });
  await expect(workbench.getByRole("heading", { name: "工作台", exact: true })).toBeVisible();
  const sidebar = page.getByRole("button", { name: "工作台", exact: true });
  await sidebar.click({ trial: true, timeout: 15_000 });
  for (const theme of ["default", "studio", "harbor", "moss", "ember", "orchid", "tidepool", "dune", "rosewood", "glacier", "arcade", "ink"]) {
    for (const scheme of ["light", "dark"]) {
      await page.evaluate(async ({ theme, scheme }) => {
        const appearance = await import("/src/features/settings/model/appearance.ts");
        appearance.applyWorkspaceTheme(theme); appearance.applyThemePreference(scheme);
      }, { theme, scheme });
      await expect(workbench).toBeVisible();
      expect(await workbench.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  }
  await workbench.getByPlaceholder("描述主题、风格、受众和成品要求……").fill("画一座安静的图书馆");
  await workbench.getByRole("button", { name: "模型", exact: true }).click();
  await expect(page.getByRole("option", { name: /vendor\/chat/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Magpie.*绘画模型/ }).click();
  const start = workbench.getByRole("button", { name: "开始创作", exact: true });
  await start.click();
  await expect(workbench.getByRole("button", { name: "正在提交……", exact: true })).toBeDisabled();
  await expect(workbench.getByText("测试接口已完成", { exact: true })).toBeVisible();
  const requests = await page.evaluate(() => (window as any).mediaRequests);
  expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ model: "vendor/draw", connectionId: "magpie", cwd: "D:/creative-project", kind: "image" });
  expect(requests[0].reference).toBeUndefined();
  await page.screenshot({ path: "test-results/workbench-dark.png", fullPage: true });
  await page.evaluate(async () => {
    const appearance = await import("/src/features/settings/model/appearance.ts");
    appearance.applyWorkspaceTheme("studio"); appearance.applyThemePreference("light");
  });
  await page.screenshot({ path: "test-results/workbench-light.png", fullPage: true });
  await workbench.getByRole("button", { name: "关闭", exact: true }).click();
  await page.evaluate(async () => {
    const appearance = await import("/src/features/settings/model/appearance.ts");
    appearance.saveInsetLayout(false);
    localStorage.setItem("monocode.projectRailOpen", "1");
  });
  await page.reload();
  const classicEntry = page.getByRole("button", { name: /^(工作台|Workbench)$/, exact: true });
  await expect(classicEntry).toBeVisible({ timeout: 60_000 });
  await classicEntry.click();
  await expect(page.getByRole("region", { name: /^(工作台|Workbench)$/ })).toBeVisible();
});
