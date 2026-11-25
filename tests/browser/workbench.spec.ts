import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1360, height: 900 } });
test("workbench stays reachable across themes and uses the selected provider without duplicate submissions", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("pageerror", (error) => console.error("PAGE ERROR", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER", message.text()); });
  await page.addInitScript(() => localStorage.setItem("monocode.insetLayout", "1"));
  await page.goto("/tests/browser/workspace-performance.html");
  await expect(page.getByRole("button", { name: "Media Workbench", exact: true })).toBeVisible({ timeout: 60_000 });
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
  await page.getByRole("button", { name: "媒体工作台", exact: true }).click();
  const workbench = page.getByRole("region", { name: "媒体工作台", exact: true });
  await expect(workbench.getByRole("heading", { name: "媒体工作台", exact: true })).toBeVisible();
  const sidebar = page.getByRole("button", { name: "媒体工作台", exact: true });
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
  const nav = workbench.getByRole("navigation", {name:"创作工具"});
  await expect(nav.getByRole("heading")).toHaveText(["写作","图片","视频","设计"]);
  await nav.getByRole("button", {name:"生成小说", exact:true}).click();
  await workbench.getByLabel("故事梗概").fill("一位钟表匠的冒险");
  await workbench.getByLabel("章节数", {exact:true}).fill("6");
  await nav.getByRole("button", {name:"生成 PPT", exact:true}).click();
  await expect(workbench.getByText("页面规划 · 仅结构预览，并非生成成品")).toBeVisible();
  await expect(workbench.getByLabel("目标受众")).toBeVisible();
  await nav.getByRole("button", {name:"文生视频", exact:true}).click();
  await expect(workbench.getByText("制作流程", {exact:true})).toBeVisible();
  await nav.getByRole("button", {name:"生成小说", exact:true}).click();
  await expect(workbench.getByLabel("故事梗概")).toHaveValue("一位钟表匠的冒险");
  await expect(workbench.getByLabel("章节数", {exact:true})).toHaveValue("6");
  await nav.getByRole("button", {name:"文生图", exact:true}).click();
  await workbench.getByLabel("生成数量").fill("2");
  await workbench.getByPlaceholder("描述主体、环境、光线与构图……").fill("画一座安静的图书馆");
  await workbench.getByRole("button", { name: "模型", exact: true }).click();
  await expect(page.getByRole("option", { name: /vendor\/chat/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Magpie.*绘画模型/ }).click();
  const start = workbench.getByRole("button", { name: "开始创作", exact: true });
  await start.click();
  await expect(workbench.getByRole("button", { name: "正在提交……", exact: true })).toBeDisabled();
  await expect(workbench.getByText("测试接口已完成", { exact: true })).toBeVisible();
  const requests = await page.evaluate(() => (window as any).mediaRequests);
  expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ model: "vendor/draw", connectionId: "magpie", cwd: "D:/creative-project", kind: "image", options:{n:2} });
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
  const classicEntry = page.getByRole("button", { name: /^(媒体工作台|Media Workbench)$/, exact: true });
  await expect(classicEntry).toBeVisible({ timeout: 60_000 });
  await classicEntry.click();
  await expect(page.getByRole("region", { name: /^(媒体工作台|Media Workbench)$/ })).toBeVisible();
});
