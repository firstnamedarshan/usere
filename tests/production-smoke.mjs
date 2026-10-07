// Run after `npm run build` and `npm run preview -- --port 4174 --strictPort`.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { scrollToStoryProgress, scrollToListings } from "./story-helpers.js";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.goto("http://localhost:4174");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".scene-ready");
  await page.waitForSelector('[data-story="shared"]');
  assert.equal(
    await page.locator("#scene-caption").textContent(),
    "Package your work. Let other agents reuse it.",
  );
  await page.locator("#hero-action").click();
  await page.waitForSelector("#skill-form");
  assert.equal(new URL(page.url()).pathname, "/submit");
  assert.equal(await page.locator("canvas").count(), 0);
  await page.goto("http://localhost:4174");
  await page.waitForSelector(".scene-ready");
  await page.locator('.mode-label[for="hero-mode-buy"]').click();
  await page.waitForSelector('[data-story="received"]');
  assert.equal(await page.locator("#hero-action").getAttribute("href"), "/marketplace");
  await page.locator("#hero-action").click();
  await page.waitForSelector('#marketplace-results');
  await page.getByRole('link', { name: 'View illustrative examples' }).click();
  await page.waitForSelector(".market-card");
  assert.equal(await page.locator(".market-card").count(), 6);
  await page.locator('.market-card[href="/examples/wallet-history-to-csv"]').click();
  await page.waitForSelector(".purchase-panel");
  assert.equal(await page.getByRole("button", { name: "Buy", exact: true }).isDisabled(), true);
  await page.reload();
  await page.waitForSelector(".purchase-panel");
  assert.equal(await page.locator("canvas").count(), 0);
  await page.goto("http://localhost:4174/#skills");
  await page.waitForSelector(".scene-ready");
  await page.waitForFunction(() => !document.querySelector("#skills").inert);
  await page.locator('.skill-card[data-skill="wallet"]').click();
  assert.equal(
    await page.locator("#dialog-title").textContent(),
    "Wallet history to CSV",
  );
  await page.screenshot({ path: "screenshots/package-details.png" });
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .locator('.skill-card[data-skill="wallet"]')
      .evaluate((button) => button === document.activeElement),
    true,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator('.mode-label[for="hero-mode-sell"]').click();
  await page.waitForSelector('[data-story="shared"]');
  for (const [progress, chapter, assembly] of [
    [0.34, "1", "exploded"], [0.75, "2", "packaged"], [0.8, "3", "packaged"],
  ]) {
    await scrollToStoryProgress(page, progress);
    await page.waitForFunction((chapter) =>
      document.querySelector("#scroll-story").dataset.chapter === chapter,
    chapter);
    await page.waitForFunction((progress) =>
      Math.abs(Number(document.querySelector("#scene-container").dataset.progress) - progress) < 0.0002,
    progress);
    assert.equal(await page.locator("#scene-container").getAttribute("data-mode"), "story");
    assert.equal(await page.locator("#scene-container").getAttribute("data-assembly"), assembly);
    assert.equal(await page.locator("canvas").count(), 1);
  }
  const final = await page.locator("canvas").evaluate(canvas => ({ y: canvas.getBoundingClientRect().y, scroll: scrollY }));
  await page.evaluate(() => scrollBy({ top: 150, behavior: "instant" }));
  await page.waitForFunction(scroll => scrollY >= scroll + 149, final.scroll);
  const released = await page.locator("canvas").evaluate(canvas => ({ y: canvas.getBoundingClientRect().y, scroll: scrollY }));
  assert.ok(Math.abs(released.y - (final.y - released.scroll + final.scroll)) < 1);
  assert.equal(Number(await page.locator("#scroll-story").getAttribute("data-progress")), 0.8);
  assert.equal(await page.locator("#skills").evaluate((section) => section.inert), false);
  assert.equal(await page.locator("#skills").evaluate(section => getComputedStyle(section).opacity), "1");
  assert.equal(await page.locator("#skills").evaluate(section => getComputedStyle(section).transform), "none");
  await scrollToListings(page);
  await page.locator('.skill-card[data-skill="api"]').click();
  assert.equal(await page.locator("#dialog-title").textContent(), "API pagination helper");
  await page.keyboard.press("Escape");
  await scrollToStoryProgress(page, 0.34);
  await page.waitForFunction(() => document.querySelector("#scene-container").dataset.assembly === "exploded");
  assert.equal(await page.locator("#skills").evaluate(section => section.inert), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.equal(
    (
      await page.request.get("http://localhost:4174/licenses/manrope-OFL.txt")
    ).status(),
    200,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Production smoke passed: Sell/Buy destinations, submission page, sample marketplace, direct details reload and disabled Buy, story assembly/copies/native stage release and reverse restore, homepage details/focus, mobile resize, bundled font license, one homepage canvas, no browser errors.",
  );
} finally {
  await browser.close();
}
