import { test, expect } from "@playwright/test";
import { scrollToStoryProgress } from "./story-helpers.js";

const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow", width: 360, height: 800 },
];

async function load(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-scene", "ready");
  return errors;
}

async function go(page, progress) {
  await scrollToStoryProgress(page, progress);
  await expect.poll(async () => {
    const { progress: displayed, targetProgress: target } = await page.locator("#scroll-story").evaluate((s) => s.dataset);
    return Math.abs(Number(displayed) - Number(target));
  }).toBeLessThan(0.0002);
}

for (const size of sizes) test(size.name + ": prepared composition at 25/50/75% visible and readable type", async ({ page }) => {
  await page.setViewportSize(size);
  const errors = await load(page);
  for (const visible of [0.25, 0.5, 0.75]) {
    await page.locator("#scroll-story").evaluate((section, fraction) => {
      scrollTo({ top: section.offsetTop - innerHeight * (1 - fraction), behavior: "instant" });
    }, visible);
    await expect(page.locator(".scene-bridge-layer > #scene-container")).toHaveCount(1);
    await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
    await page.waitForTimeout(700);
    await expect(page.locator(".story-loading-composition")).toBeHidden();
    await expect(page.locator(".hero-scene-still")).toHaveCount(0);
    await page.screenshot({ path: "screenshots/polish-" + size.name + "-entry-" + visible * 100 + ".png" });
  }
  await go(page, 0.34);
  const type = await page.evaluate(() => {
    const px = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return { body: px(".story-description"), labels: px(".story-layer-labels > span"), buttons: px(".story-progress button"), heading: px(".story-chapter h2"), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(type.body).toBeGreaterThanOrEqual(16);
  expect(type.labels).toBeGreaterThanOrEqual(14);
  expect(type.buttons).toBeGreaterThanOrEqual(14);
  expect(type.heading).toBeGreaterThanOrEqual(size.width <= 760 ? 28 : 36);
  expect(type.overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("one wheel notch eases through intermediate poses and settles quickly in both directions", async ({ page }) => {
  const errors = await load(page);
  await go(page, 0.35);
  // A new notch after an idle pause must still damp, rather than being
  // mistaken for a suspended tab's long frame gap.
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.polishSamples = [];
    const section = document.querySelector("#scroll-story");
    function sample(time) {
      window.polishSamples.push({ time, displayed: Number(section.dataset.progress), target: Number(section.dataset.targetProgress), chapter: section.dataset.chapter });
      if (window.polishSamples.length < 60) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.mouse.move(1100, 600);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(750);
  const samples = await page.evaluate(() => window.polishSamples);
  const start = samples[0].displayed;
  const end = samples.at(-1).target;
  expect(end - start).toBeGreaterThan(0.03);
  expect(end - start).toBeLessThan(0.07);
  expect(samples.some((s) => s.displayed > start + 0.001 && s.displayed < s.target - 0.001)).toBe(true);
  expect(Math.abs(samples.at(-1).displayed - end)).toBeLessThan(0.0002);
  for (let i = 1; i < samples.length; i++) expect(samples[i].displayed).toBeGreaterThanOrEqual(samples[i - 1].displayed - 0.0001);
  // Text always matches the currently rendered chapter, not the wheel target.
  for (const s of samples) expect(Number(s.chapter)).toBe(s.displayed < 0.25 ? 0 : s.displayed < 0.5 ? 1 : s.displayed < 0.8 ? 2 : 3);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => Number(await page.locator("#scroll-story").getAttribute("data-progress"))).toBeCloseTo(start, 2);
  expect(errors).toEqual([]);
});

test("keyboard scroll and a paused midpoint preserve native control", async ({ page }) => {
  await load(page);
  await go(page, 0.41);
  await page.locator("body").click({ position: { x: 50, y: 500 } });
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await page.waitForTimeout(600);
  const settled = await page.locator("#scroll-story").getAttribute("data-progress");
  await page.waitForTimeout(300);
  expect(await page.locator("#scroll-story").getAttribute("data-progress")).toBe(settled);
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
});

test("a frozen-page frame gap resumes at the current pose without replaying old motion", async ({ page }) => {
  const errors = await load(page);
  await go(page, 0.62);
  const session = await page.context().newCDPSession(page);
  await session.send("Page.setWebLifecycleState", { state: "frozen" });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await session.send("Page.setWebLifecycleState", { state: "active" });
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => page.locator("#scroll-story").evaluate((s) => Math.abs(Number(s.dataset.progress) - Number(s.dataset.targetProgress)))).toBeLessThan(0.0002);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "story");
  expect(errors).toEqual([]);
});

test("zoom-equivalent short viewport uses readable ordinary flow and working dialogs", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  const errors = await load(page);
  await expect(page.locator("body")).toHaveClass(/story-static/);
  await expect(page.locator(".story-chapter:visible")).toHaveCount(4);
  expect(await page.locator(".story-stage").evaluate((s) => getComputedStyle(s).position)).not.toBe("sticky");
  await page.locator('.skill-card[data-skill="csv"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("CSV cleanup workflow");
  await expect(page.locator("#dialog-close")).toBeInViewport();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "screenshots/polish-short-viewport.png" });
  expect(errors).toEqual([]);
});

test("an unavailable scene module shows normal-flow static compositions", async ({ page }) => {
  await page.route("**/scene.js*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/webgl-unavailable/);
  await expect(page.locator(".story-chapter:visible")).toHaveCount(4);
  await page.getByRole("heading", { name: "Same task. Separate effort." }).scrollIntoViewIfNeeded();
  await expect(page.locator(".story-chapter .static-repeat")).toBeVisible();
});

test("short phones keep readable story text and illustrations in ordinary flow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const errors = await load(page);
  await expect(page.locator("body")).toHaveClass(/story-static/);
  await expect(page.locator(".story-chapter:visible")).toHaveCount(4);
  expect(await page.locator(".story-stage").evaluate(stage => getComputedStyle(stage).position)).not.toBe("sticky");
  await page.getByRole("heading", { name: "Same task. Separate effort." }).scrollIntoViewIfNeeded();
  const chapter = page.locator('.story-chapter[data-chapter="0"]');
  const readable = await chapter.evaluate(chapter => ({
    bodySize: parseFloat(getComputedStyle(chapter.querySelector(".story-description")).fontSize),
    headingLeft: chapter.querySelector("h2").getBoundingClientRect().left,
    stationWidth: chapter.querySelector(".static-station").getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));
  expect(readable.bodySize).toBeGreaterThanOrEqual(18);
  expect(readable.headingLeft).toBeGreaterThanOrEqual(24);
  expect(readable.stationWidth).toBeGreaterThanOrEqual(70);
  expect(readable.overflow).toBeLessThanOrEqual(1);
  await chapter.evaluate(chapter => chapter.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.screenshot({ path: "screenshots/story-short-phone.png" });
  await page.locator('.skill-card[data-skill="wallet"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("Wallet history to CSV");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 360, height: 720 });
  await expect(page.locator("body")).not.toHaveClass(/story-static/);
  await go(page, 0.34);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "story");
  const restored = await page.evaluate(() => ({
    copyBottom: document.querySelector(".story-copy").getBoundingClientRect().bottom,
    controlsTop: document.querySelector(".story-bottom").getBoundingClientRect().top,
    labelBottoms: [...document.querySelectorAll(".agent-label")].map(label => label.getBoundingClientRect().bottom),
  }));
  expect(restored.copyBottom + 150).toBeLessThan(restored.controlsTop);
  restored.labelBottoms.forEach(bottom => expect(bottom + 10).toBeLessThan(restored.controlsTop));
  await page.screenshot({ path: "screenshots/story-restored-phone.png" });
  expect(errors).toEqual([]);
});

test("delayed scene loading already has a composed stage before the canvas paints", async ({ page }) => {
  await page.route("**/scene.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#scroll-story").evaluate((section) =>
    scrollTo({ top: section.offsetTop - innerHeight * 0.5, behavior: "instant" }),
  );
  await expect(page.locator(".scene-bridge-layer .scene-fallback")).toBeVisible();
  await page.screenshot({ path: "screenshots/polish-loading.png" });
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await expect(page.locator(".story-loading-composition")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(1);
});
