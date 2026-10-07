import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const skillFile = (text, name = "SKILL.md") => ({
  name, mimeType: "text/markdown", buffer: Buffer.from(text),
});

async function fillSkillForm(page) {
  await page.getByLabel("Title", { exact: true }).fill("My CSV workflow");
  await page.getByLabel("Description", { exact: true }).fill("Clean headings and flag duplicates for review.");
  await page.getByLabel("Category", { exact: true }).selectOption("Data workflows");
  await page.getByLabel("Price in SOL").fill("0.025");
}

test("search and category work together; reload and Back preserve filters", async ({ page }) => {
  await page.goto("/examples");
  await expect(page.locator(".market-card")).toHaveCount(6);
  await expect(page.locator(".sample-label")).toHaveCount(6);
  await expect(page.locator(".prototype-notice")).toContainText("SOL prices are illustrative");
  await page.getByLabel("Search skills").fill("  cSv  ");
  await expect(page.locator(".market-card")).toHaveCount(2);
  await page.getByLabel("Category", { exact: true }).selectOption("Data workflows");
  await expect(page.locator(".market-card")).toHaveCount(1);
  await expect(page.locator(".market-card h2")).toHaveText("CSV cleanup workflow");
  await page.reload();
  await expect(page.getByLabel("Search skills")).toHaveValue("cSv");
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("Data workflows");
  await page.locator(".market-card").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CSV cleanup workflow");
  await page.goBack();
  await expect(page.locator(".market-card")).toHaveCount(1);
  await page.getByLabel("Search skills").fill("nothing matches here");
  await expect(page.getByRole("heading", { name: "No matching skills." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("0 sample skills");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".market-card")).toHaveCount(6);
  await expect(page.getByLabel("Search skills")).toBeFocused();
});

test("all sample details load directly with examples, requirements, creator and unavailable Buy", async ({ page }) => {
  const errors = [];
  const sceneRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/(scene|story|homepage)\.js/.test(request.url())) sceneRequests.push(request.url());
  });
  await page.goto("/examples");
  await expect(page.locator(".market-card")).toHaveCount(6);
  const cards = await page.locator(".market-card").evaluateAll((links) => links.map((link) => ({
    url: link.getAttribute("href"),
    title: link.querySelector("h2").textContent,
    price: link.querySelector(".skill-price").textContent,
  })));
  for (const card of cards) {
    await page.goto(card.url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(card.title);
    for (const name of ["Description", "What it does", "Example input & output", "Requirements"])
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.locator(".example-block pre")).toHaveCount(2);
    await expect(page.locator(".purchase-price")).toHaveText(card.price);
    await expect(page.locator(".skill-facts")).toContainText("Creator (sample)");
    await expect(page.getByRole("button", { name: "Buy", exact: true })).toBeDisabled();
    await expect(page.locator("#purchase-notice")).toContainText("Purchases and payments are not connected");
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  expect(sceneRequests).toEqual([]);
  expect(errors).toEqual([]);
});


test("unknown routes offer a working marketplace link", async ({ page }) => {
  for (const route of ["/examples/missing-skill", "/unknown"]) {
    await page.goto(route);
    await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Explore skills", exact: true }).click();
    if (route === "/unknown") await expect(page.getByRole("alert")).toContainText("setup is incomplete");
    else await expect(page.locator(".market-card")).toHaveCount(6);
  }
});

for (const width of [1440, 820, 390, 320]) test(`sample pages retain responsive reading layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("screenshots", { recursive: true });
  for (const [name, route] of [["examples", "/examples"], ["sample-details", "/examples/wallet-history-to-csv"]]) {
    await page.goto(route);
    await expect(page.locator(".inner-shell")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    if (width === 1440 || width === 390) await page.screenshot({ path: `screenshots/${name}-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
