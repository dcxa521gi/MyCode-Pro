import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
// Exercise the native server's exact policy and bridge, never a permissive test copy.
const native = readFileSync(
  new URL("../../src-tauri/src/artifacts.rs", import.meta.url),
  "utf8",
);
const cspMatch = native.match(/const HTML_CSP: &str = "([\s\S]*?)";/);
const bootstrapMatch = native.match(
  /const HTML_BOOTSTRAP: &str = r#"([\s\S]*?)"#;/,
);
if (!cspMatch || !bootstrapMatch)
  throw new Error("Native HTML policy extraction failed");
const csp = cspMatch[1].replace(/\\\r?\n\s*/g, "");
const bootstrap = bootstrapMatch[1];
const content = `<!doctype html>${bootstrap}<style>body{padding:16px}#visual{height:180px;background:var(--surface);border:1px solid var(--border)}</style><div id="visual">Visible chart: 12 completed tasks</div><a href="https://example.test/report">HTTPS report</a><a href="http://example.test/report">HTTP report</a><a href="javascript:parent.postMessage({type:'monocode:open-link',url:'file:///secret'},'*')">Unsafe link</a><script>
try{parent.document.querySelector('[data-parent-private]').textContent='Compromised';document.documentElement.dataset.parentAccess='allowed';}catch(e){document.documentElement.dataset.parentAccess='denied';}
document.addEventListener('securitypolicyviolation',e=>{if(e.violatedDirective==='connect-src')document.documentElement.dataset.cspViolation='connect-src';});
fetch('https://example.test/forbidden').then(()=>document.documentElement.dataset.fetch='allowed',()=>document.documentElement.dataset.fetch='blocked');
</script>`;

test("artifact's own unsolicited messages cannot open URLs after a normal chart click", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route(
    "**/tests/browser/artifact-frame/fixture-visual?v=1",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        headers: { "Content-Security-Policy": csp },
        body: `<!doctype html>${bootstrap}<button>View chart</button><a href="https://example.test/report">Real report</a><script>setInterval(()=>parent.postMessage({type:'monocode:open-link',url:'https://example.test/unsolicited'},'*'),100)</script>`,
      }),
  );
  await page.goto("/tests/browser/html-artifact.html", {
    waitUntil: "domcontentloaded",
    timeout: 150_000,
  });
  const iframe = page.locator("iframe[data-html-artifact]");
  await page
    .frameLocator("iframe[data-html-artifact]")
    .getByRole("button", { name: "View chart" })
    .click();
  expect(await iframe.evaluate((el) => document.activeElement === el)).toBe(
    true,
  );
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
  await expect(
    page.getByRole("group", { name: "Open external link" }),
  ).toContainText("https://example.test/unsolicited");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await iframe.evaluate((el) => document.activeElement === el)).toBe(
    false,
  );
  await page.waitForTimeout(650);
  await expect(
    page.getByRole("group", { name: "Open external link" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
});
test("HTML visual enforces opaque sandbox, exact native CSP and frame message identity", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  let outgoing = 0;
  await page.route("https://example.test/**", async (route) => {
    outgoing++;
    await route.abort();
  });
  await page.route(
    "**/tests/browser/artifact-frame/fixture-visual?v=1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        headers: { "Content-Security-Policy": csp },
        body: content,
      }),
  );
  await page.goto("/tests/browser/html-artifact.html", {
    waitUntil: "domcontentloaded",
    timeout: 150_000,
  });
  const iframe = page.locator("iframe[data-html-artifact]");
  const frame = page.frameLocator("iframe[data-html-artifact]");
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  await expect(iframe).toHaveCSS("opacity", "1", { timeout: 60_000 });
  await expect(frame.locator("#visual")).toHaveText(
    "Visible chart: 12 completed tasks",
  );
  await expect(frame.locator("html")).toHaveAttribute(
    "data-parent-access",
    "denied",
  );
  await expect(page.locator("[data-parent-private]")).toHaveText(
    "Private parent DOM",
  );
  await expect(frame.locator("html")).toHaveAttribute("data-fetch", "blocked");
  await expect(frame.locator("html")).toHaveAttribute(
    "data-csp-violation",
    "connect-src",
  );
  expect(outgoing).toBe(0);
  await expect(frame.locator("html")).toHaveCSS("color-scheme", "light");
  const light = await frame
    .locator("html")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator("[data-switch-theme]").click();
  await expect(frame.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe(light);
  await frame
    .locator("#visual")
    .evaluate((el) => ((el as HTMLElement).style.height = "460px"));
  await expect
    .poll(() =>
      iframe.evaluate((el) => parseInt((el as HTMLElement).style.height)),
    )
    .toBeGreaterThan(450);
  await frame
    .locator("#visual")
    .evaluate((el) => ((el as HTMLElement).style.height = "100px"));
  await expect
    .poll(() =>
      iframe.evaluate((el) => parseInt((el as HTMLElement).style.height)),
    )
    .toBeLessThan(250);
  const height = await iframe.evaluate(
    (el) => (el as HTMLElement).style.height,
  );
  await frame.locator("#visual").click();
  expect(await iframe.evaluate((el) => document.activeElement === el)).toBe(
    true,
  );
  // A real sibling window and the parent window cannot impersonate this frame.
  await page.evaluate(async () => {
    const other = document.createElement("iframe");
    other.id = "forged-frame";
    other.srcdoc = `<script>parent.postMessage({type:'monocode:height',height:9999},'*');parent.postMessage({type:'monocode:open-link',url:'https://example.test/forged'},'*')</script>`;
    await new Promise<void>((resolve) => {
      other.onload = () => resolve();
      document.body.append(other);
    });
    window.postMessage({ type: "monocode:height", height: 9999 }, "*");
    window.postMessage(
      { type: "monocode:open-link", url: "https://example.test/forged" },
      "*",
    );
  });
  await page.waitForTimeout(100);
  await expect(iframe).toHaveCSS("height", height);
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
  // Synthetic DOM clicks do not acquire the bootstrap's trusted-link permission.
  await frame
    .getByRole("link", { name: "HTTPS report", exact: true })
    .evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
  await frame.getByRole("link", { name: "HTTPS report", exact: true }).click();
  const consent = page.getByRole("group", { name: "Open external link" });
  await expect(consent).toContainText("https://example.test/report");
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
  // The same artifact cannot swap the displayed target or authorize itself.
  await frame.locator("html").evaluate(() => {
    parent.postMessage(
      { type: "monocode:open-link", url: "https://example.test/swapped" },
      "*",
    );
  });
  await page.waitForTimeout(100);
  await expect(consent).not.toContainText("swapped");
  await page
    .getByRole("button", { name: "Open link", exact: true })
    .evaluate((el: HTMLElement) => el.click());
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([]);
  await page.getByRole("button", { name: "Open link", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).fixtureOpens))
    .toEqual(["https://example.test/report"]);
  await frame.getByRole("link", { name: "HTTP report", exact: true }).click();
  await expect(consent).toContainText("http://example.test/report");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([
    "https://example.test/report",
  ]);
  await frame.getByRole("link", { name: "HTTP report", exact: true }).click();
  await page.getByRole("button", { name: "Open link", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => (window as any).fixtureOpens))
    .toEqual(["https://example.test/report", "http://example.test/report"]);
  await frame.getByRole("link", { name: "Unsafe link", exact: true }).click();
  await frame.locator("html").evaluate(() => {
    for (const url of [
      "file:///secret",
      "javascript:alert(1)",
      "mailto:private@example.test",
      "https://[",
    ])
      parent.postMessage({ type: "monocode:open-link", url }, "*");
  });
  await page.waitForTimeout(100);
  await expect(consent).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).fixtureOpens)).toEqual([
    "https://example.test/report",
    "http://example.test/report",
  ]);
  expect(outgoing).toBe(0);
  await page.locator("[data-switch-language]").click();
  await frame.getByRole("link", { name: "HTTPS report", exact: true }).click();
  await expect(page.getByRole("group", { name: "打开外部链接" })).toContainText(
    "https://example.test/report",
  );
  await expect(
    page.getByRole("button", { name: "打开链接", exact: true }),
  ).toBeVisible();
  await expect(frame.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.screenshot({
    path: `build/021-html-artifact-${info.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const original = tauri.invoke;
    tauri.invoke = (command: string, args: unknown) =>
      command === "plugin:opener|open_url"
        ? Promise.reject(new Error("private native detail"))
        : original(command, args);
  });
  await page.getByRole("button", { name: "打开链接", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("无法打开此链接。");
  await page.locator("[data-switch-language]").click();
  await expect(page.getByRole("status")).toHaveText(
    "Could not open this link.",
  );
  await expect(page.getByRole("status")).not.toContainText(
    "private native detail",
  );
});
