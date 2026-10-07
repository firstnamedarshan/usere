import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const file = (text, name = "SKILL.md") => ({ name, mimeType: "text/markdown", buffer: Buffer.from(text) });
async function fill(page) {
  for (const [label, value] of [["Title", "My CSV skill"], ["Description", "Normalize supplied records"], ["Expected input / public example", "Synthetic JSON"], ["Expected output / public example", "CSV"], ["Requirements", "An agent"], ["Limitations", "Offline only"], ["Price in Devnet SOL", "0.025"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Category", { exact: true }).selectOption("Solana data");
  await page.locator("#permission-confirmed").check();
}

test("unconfigured marketplace does not silently fall back to examples", async ({ page }) => {
  await page.goto("/marketplace");
  await expect(page.getByRole("alert")).toContainText("setup is incomplete");
  await expect(page.locator(".market-card")).toHaveCount(0);
  await page.getByRole("link", { name: "View illustrative examples" }).click();
  await expect(page.locator(".market-card")).toHaveCount(6);
});
test("safe local preview, bounded prices, private-information consent and no fake submissions", async ({ page }) => {
  const writes = [];
  page.on("request", (r) => { if (r.method() === "POST") writes.push(r.url()); });
  await page.goto("/submit");
  await fill(page);
  const text = '# Skill\n<script>window.uploadExecuted=true</script>\n<img src=x onerror="window.uploadExecuted=true">';
  await page.getByLabel("Upload one SKILL.md").setInputFiles(file(text));
  await expect(page.locator("#file-preview")).toHaveText(text);
  await expect(page.locator("#file-preview script,#file-preview img")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill('<img src=x onerror="window.uploadExecuted=true">');
  await page.getByRole("button", { name: "Preview skill" }).click();
  await expect(page.locator("#preview-title")).toHaveText('<img src=x onerror="window.uploadExecuted=true">');
  await expect(page.locator("#preview-price")).toHaveText("0.025 Devnet SOL");
  await expect(page.locator("#submit-skill")).toBeDisabled();
  expect(await page.evaluate(() => window.uploadExecuted)).toBeUndefined();
  for (const price of ["0", "-1", "10.000000001", "1e-3"]) {
    await page.getByLabel("Price in Devnet SOL").fill(price);
    await page.getByRole("button", { name: "Preview skill" }).click();
    await expect(page.locator("#listing-preview")).toBeHidden();
  }
  expect(writes).toEqual([]);
});
test("invalid file and obvious credentials cannot be previewed", async ({ page }) => {
  await page.goto("/submit");
  await fill(page);
  for (const [upload, error] of [[file("# Skill", "notes.md"), "named SKILL.md"], [file("a".repeat(102401)), "100 KB"], [file("\u0000binary"), "plain text"], [file("api_key=" + "A".repeat(30)), "Possible credential"], [{ name: "SKILL.md", mimeType: "text/plain", buffer: Buffer.from([0xff]) }, "UTF-8"]]) {
    await page.getByLabel("Upload one SKILL.md").setInputFiles(upload);
    await expect(page.locator("#file-error")).toContainText(error);
    await expect(page.locator("#submit-skill")).toBeDisabled();
  }
});
for (const width of [1440, 820, 390, 320]) test(`MVP pages navigate and fit ${width}px without loading the 3D scene`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = [];
  const scenes = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (/\/(scene|story|homepage)\.js/.test(r.url())) scenes.push(r.url()); });
  await mkdir("screenshots", { recursive: true });
  for (const route of ["/marketplace", "/submit", "/account", "/admin"]) {
    await page.goto(route);
    await expect(page.locator(".inner-shell")).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Account", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    if (width === 1440 || width === 390) await page.screenshot({ path: `screenshots/mvp-${route.slice(1)}-${width}.png`, fullPage: true });
  }
  expect(scenes).toEqual([]);
  expect(errors).toEqual([]);
});
test("logged-out account and admin require wallet sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page.locator("#account-content")).toContainText("sign in with Phantom");
  await page.goto("/admin");
  await expect(page.locator("#admin-content")).toContainText("configured admin wallet");
  await expect(page.locator("#admin-link")).toBeHidden();
});
