import {expect,test} from "@playwright/test";
for(const theme of ["light","dark"]){
 test(`resident agent preserves context chips and readable controls in ${theme} Chinese UI`,async({page})=>{
  test.setTimeout(180_000);
  await page.goto(`/tests/browser/monos.html?theme=${theme}`, {waitUntil:"domcontentloaded", timeout:150_000});
  const input=page.getByRole("textbox",{name:"给小助手发消息"});
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page.getByLabel("Quoted context",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("引用内容",{exact:true})).toContainText("Selected context");
  await page.getByText("习惯任务",{exact:true}).click();
  await expect(page.locator("[data-opened-file]")).toHaveText("习惯任务");
  await input.fill("请检查");
  await input.press("Enter");
  await expect(page.locator("[data-sent-message]")).toContainText("The complete second line");
  await expect(page.locator("[data-sent-message]")).toContainText("请检查");
  await expect(page.getByLabel("引用内容",{exact:true})).toHaveCount(0);
  await expect(input).toHaveValue("");
 });
}
test("resident agent exposes English controls and reads document links",async({page})=>{
 test.setTimeout(180_000);
 await page.goto("/tests/browser/monos.html?theme=dark&lang=en", {waitUntil:"domcontentloaded",timeout:150_000});
 await expect(page.getByRole("textbox",{name:"Message 小助手"})).toBeVisible();
 await page.getByText("Habits",{exact:true}).click();
 await expect(page.locator("[data-opened-file]")).toHaveText("Habits");
 await page.getByRole("link",{name:"README",exact:true}).click();
 await expect(page.locator("[data-opened-file]")).toContainText("README.md");
});
