import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const viewportSizes = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 1280, height: 800, name: "laptop" },
  { width: 390, height: 844, name: "mobile" },
  { width: 360, height: 800, name: "narrow-mobile" },
  { width: 320, height: 720, name: "small-mobile" },
  { width: 820, height: 900, name: "tablet" },
];
const copy = {
  sell: {
    title: "Sell what your agent learned.",
    description: "Turn useful workflows into reusable skills. Get paid in SOL when they sell.",
    caption: "Package your work. Let other agents reuse it.",
    action: "Sell", destination: "/submit", story: "shared", yours: "creator",
  },
  buy: {
    title: "Buy what other agents learned.",
    description: "Find a skill for your next task. Give your agent a head start.",
    caption: "Give your agent a skill worth reusing.",
    action: "Buy", destination: "/marketplace", story: "received", yours: "a",
  },
};
async function loadReadyScene(page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await expect(page.locator("#hero-title")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-description")).toHaveCSS("opacity", "1");
}
async function selectMode(page, mode) {
  await page.locator('.mode-label[for="hero-mode-' + mode + '"]').click();
}
async function checkMode(page, mode) {
  await expect(page.getByRole("radio", { name: copy[mode].action, exact: true })).toBeChecked();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(copy[mode].title);
  await expect(page.locator('.hero-description [aria-hidden="false"]')).toHaveText(copy[mode].description);
  await expect(page.locator("#hero-action")).toHaveText(copy[mode].action);
  await expect(page.locator("#hero-action")).toHaveAttribute("href", copy[mode].destination);
  await expect(page.locator("#scene-caption")).toHaveText(copy[mode].caption);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", copy[mode].story);
  await expect(page.locator('[data-agent="' + copy[mode].yours + '"] .agent-name')).toHaveText("Your agent");
  await expect(page.locator(".agent-label.is-your-agent")).toHaveCount(1);
  await expect(page.locator(".demo-label")).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
}
async function layout(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const b = document.querySelector(selector).getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    const container = document.querySelector("#scene-container").getBoundingClientRect();
    const heading = document.querySelector("#hero-title").getBoundingClientRect();
    const action = document.querySelector("#hero-action").getBoundingClientRect();
    const toggle = document.querySelector(".mode-toggle").getBoundingClientRect();
    const modeLabels = [...document.querySelectorAll(".mode-label")];
    const lines = [...document.querySelectorAll(".hero-headline > span")];
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      toggle: rect(".mode-toggle"), description: rect(".hero-description"),
      action: rect("#hero-action"), scene: rect(".hero-scene-anchor"), heading: rect("#hero-title"),
      actionBeforeToggle: toggle.top >= action.bottom - 1 ||
        (action.right <= toggle.left + 1 && action.top < toggle.bottom && toggle.top < action.bottom),
      modeLabelsInside: modeLabels.length === 2 && modeLabels.every(label => {
        const b = label.getBoundingClientRect();
        return label.closest(".mode-toggle") && b.left >= toggle.left && b.right <= toggle.right &&
          b.top >= toggle.top && b.bottom <= toggle.bottom;
      }),
      linesInside: lines.every(line => {
        const range = document.createRange(); range.selectNodeContents(line);
        return [...range.getClientRects()].every(b => b.left >= heading.left - 1 && b.right <= heading.right + 1);
      }),
      twoLines: [...document.querySelectorAll(".hero-headline")].every(layer =>
        Math.abs(layer.offsetHeight - parseFloat(getComputedStyle(layer).lineHeight) * 2) < 2),
      labelsInside: [...document.querySelectorAll(".agent-label")].every(label => {
        const b = label.getBoundingClientRect();
        return b.left >= container.left && b.right <= container.right && b.top >= container.top && b.bottom <= container.bottom;
      }),
    };
  });
}
for (const viewport of viewportSizes) test(viewport.name + ": Sell default, Buy, reserved layout and screenshots", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize(viewport);
  await loadReadyScene(page);
  await checkMode(page, "sell");
  const before = await layout(page);
  expect(before.overflow).toBeLessThanOrEqual(0);
  expect(before.toggle.height).toBeGreaterThanOrEqual(44);
  expect(before.linesInside).toBe(true);
  expect(before.twoLines).toBe(true);
  expect(before.labelsInside).toBe(true);
  expect(before.actionBeforeToggle).toBe(true);
  expect(before.modeLabelsInside).toBe(true);
  await mkdir("screenshots", { recursive: true });
  // Capture beyond the viewport without scrolling the shared canvas into the story.
  const clip = await page.locator(".hero").evaluate(hero => ({
    x: 0, y: 0, width: innerWidth, height: Math.ceil(hero.getBoundingClientRect().bottom),
  }));
  await page.screenshot({ path: "screenshots/hero-" + viewport.name + "-sell.png", clip });
  await selectMode(page, "buy");
  await checkMode(page, "buy");
  const after = await layout(page);
  for (const key of ["toggle", "description", "action", "scene", "heading"]) expect(after[key]).toEqual(before[key]);
  expect(after.linesInside).toBe(true);
  expect(after.labelsInside).toBe(true);
  expect(after.actionBeforeToggle).toBe(true);
  expect(after.modeLabelsInside).toBe(true);
  await page.screenshot({ path: "screenshots/hero-" + viewport.name + "-buy.png", clip });
  await selectMode(page, "sell");
  await checkMode(page, "sell");
  expect(errors).toEqual([]);
});

test("rapid switching crossfades smoothly without moving content; latest mode wins", async ({ page }) => {
  await loadReadyScene(page);
  await page.evaluate(() => {
    window.heroLayoutSamples = [];
    const started = performance.now();
    function sample() {
      const selectors = [".hero-description", "#hero-action", ".hero-scene-anchor", ".mode-toggle"];
      window.heroLayoutSamples.push(selectors.map(selector => {
        const b = document.querySelector(selector).getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
      }));
      const headline = document.querySelector('.hero-headline[data-mode-copy="buy"]');
      window.heroOpacitySamples.push(Number(getComputedStyle(headline).opacity));
      if (performance.now() - started < 1400) requestAnimationFrame(sample);
    }
    window.heroOpacitySamples = [];
    requestAnimationFrame(sample);
  });
  await selectMode(page, "buy");
  const intermediate = await page.locator('.hero-headline[data-mode-copy="buy"]').evaluate(el => ({
    duration: getComputedStyle(el).transitionDuration,
  }));
  expect(intermediate.duration).toBe("0.3s, 0.3s");
  for (let i = 0; i < 12; i++) await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
  await checkMode(page, "buy");
  await expect(page.locator('.hero-headline[data-mode-copy="buy"]')).toHaveCSS("opacity", "1");
  await expect(page.locator('.hero-headline[data-mode-copy="sell"]')).toHaveCSS("opacity", "0");
  const samples = await page.evaluate(() => window.heroLayoutSamples);
  expect(await page.evaluate(() => window.heroOpacitySamples.some(opacity => opacity > 0 && opacity < 1))).toBe(true);
  for (const sample of samples) expect(sample).toEqual(samples[0]);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("action comes before the labeled toggle; keyboard navigation and both labels select modes", async ({ page }) => {
  await loadReadyScene(page);
  await expect(page.locator(".mode-toggle .mode-label")).toHaveText(["Sell", "Buy"]);
  await page.locator("#connect-wallet").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#hero-action")).toBeFocused();
  await expect(page.locator("#hero-action")).toHaveCSS("outline-style", "solid");
  await expect(page.locator("#hero-action")).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Sell", exact: true })).toBeFocused();
  await expect(page.locator(".mode-toggle")).toHaveCSS("outline-style", "solid");
  await expect(page.locator(".mode-toggle")).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Buy", exact: true })).toBeFocused();
  await checkMode(page, "buy");
  await page.keyboard.press("ArrowLeft");
  await checkMode(page, "sell");
  await page.keyboard.press("Tab");
  await expect(page.locator(".scroll-cue")).toBeFocused();
  await selectMode(page, "buy");
  await checkMode(page, "buy");
  await selectMode(page, "sell");
  await checkMode(page, "sell");
});

test("Sell opens submission; Buy reaches the live marketplace", async ({ page }) => {
  await loadReadyScene(page);
  await page.locator("#hero-action").click();
  await expect(page).toHaveURL(/\/submit$/);
  await expect(page.locator("#skill-form")).toBeVisible();
  await expect(page.locator(".prototype-notice").first()).toContainText("Devnet demo");
  await loadReadyScene(page);
  await selectMode(page, "buy");
  await page.locator("#hero-action").click();
  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(page.getByRole("alert")).toContainText("setup is incomplete");
  await page.getByRole("link", { name: "View illustrative examples" }).click();
  await expect(page.locator(".market-card")).toHaveCount(6);
  await page.locator('.market-card[href="/examples/wallet-history-to-csv"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wallet history to CSV");
});

test("wallet setup errors and skill dialogs preserve focus", async ({ page }) => {
  await loadReadyScene(page);
  await page.locator("#connect-wallet").click();
  await expect(page.locator(".homepage-wallet-status")).toContainText("Install Phantom");
  await expect(page.locator("#connect-wallet")).toBeFocused();
  await expect(page.locator('.site-header a[href="/marketplace"]')).toHaveText("Explore skills");
  await page.locator("#skills").evaluate(section => section.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator("#skills")).toHaveJSProperty("inert", false);
  for (const [id, title] of [["wallet", "Wallet history to CSV"], ["api", "API pagination helper"], ["csv", "CSV cleanup workflow"]]) {
    const button = page.locator('.skill-card[data-skill="' + id + '"]');
    await button.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("#dialog-title")).toHaveText(title);
    await expect(page.locator("#dialog-notice")).toHaveText("Example package — not available for purchase in this prototype.");
    await expect(page.locator("#dialog-close")).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.locator("#dialog-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
  }
});

test("a rendered skill opens the same details dialog", async ({ page }) => {
  await loadReadyScene(page);
  await checkMode(page, "sell");
  const label = await page.locator('[data-agent="creator"]').boundingBox();
  await page.mouse.click(label.x + label.width / 2 + 15, label.y - 80);
  await expect(page.locator("#dialog-title")).toHaveText("Wallet history to CSV");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("reduced motion and live preference changes settle to complete compositions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadReadyScene(page);
  await checkMode(page, "sell");
  await selectMode(page, "buy");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", "received", { timeout: 500 });
  await expect(page.locator('.hero-headline[data-mode-copy="buy"]')).toHaveCSS("transition-duration", "0s");
  await expect(page.locator(".toggle-thumb")).toHaveCSS("transition-duration", "0s");
  await selectMode(page, "sell");
  await checkMode(page, "sell");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await selectMode(page, "buy");
  await page.waitForTimeout(300);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", "received", { timeout: 500 });
});

test("WebGL failure preserves both modes and their accessible illustrations", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl") || kind === "experimental-webgl" ? null : getContext.call(this, kind, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-scene", "fallback");
  await expect(page.locator("#scene-caption")).toHaveText(copy.sell.caption);
  await selectMode(page, "buy");
  await expect(page.locator("#scene-caption")).toHaveText(copy.buy.caption);
  await expect(page.locator(".fallback-a b")).toHaveText("Your agent");
  await expect(page.locator("#scene-container")).toHaveAttribute("aria-label", /settles into your agent/);
  await expect(page.locator(".scene-fallback")).toHaveCSS("opacity", "1");
  await page.locator('.skill-card[data-skill="api"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("API pagination helper");
});

test("a lost WebGL context preserves the latest hero mode and recovers", async ({ page }) => {
  await loadReadyScene(page);
  await page.evaluate(() => {
    window.contextLossExtension = document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context");
    window.contextLossExtension.loseContext();
  });
  await expect(page.locator("#scene-container")).toHaveAttribute("data-scene", "fallback");
  await selectMode(page, "buy");
  await expect(page.locator("#scene-caption")).toHaveText(copy.buy.caption);
  await page.evaluate(() => window.contextLossExtension.restoreContext());
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await checkMode(page, "buy");
});
