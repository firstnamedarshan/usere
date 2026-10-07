import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { scrollToStoryProgress, scrollToListings } from "./story-helpers.js";

const CHAPTER_BOUNDARIES = [0, 0.25, 0.5, 0.8];
const CHAPTER_HEADINGS = [
  "Same task. Separate effort.",
  "Turn what worked into a skill.",
  "One solution. New starting points.",
  "Find your agent’s next skill.",
];

function chapterAt(progress) {
  return CHAPTER_BOUNDARIES.filter((boundary) => progress >= boundary).length - 1;
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function loadStory(page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await expect(page.locator("#scroll-story")).toBeAttached();
}

async function currentGeometryProgress(page) {
  return page.locator("#scroll-story").evaluate((section, boundaries) => {
    const bounds = section.getBoundingClientRect();
    const lead = innerHeight * (innerWidth <= 760 ? 1.4 : 2.2);
    const progress = Math.max(0, Math.min(0.8, -bounds.top / lead));
    // The controller snaps chapter boundaries within one native scroll pixel.
    return boundaries.find(boundary => Math.abs(boundary - progress) * lead < 1) ?? progress;
  }, CHAPTER_BOUNDARIES);
}

async function scrollToProgress(page, progress, settle = 90) {
  await scrollToStoryProgress(page, progress);
  await expect.poll(async () => {
    return Number(await page.locator("#scroll-story").getAttribute("data-progress"));
  }).toBeCloseTo(Math.max(0, Math.min(0.8, progress)), 2);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "story");
  await expect(page.locator("#story-canvas-slot > #scene-container")).toHaveCount(1);
  if (settle) await page.waitForTimeout(settle);
}

async function checkChapter(page, progress) {
  const expectedChapter = chapterAt(progress);
  await expect(page.locator("#scroll-story")).toHaveAttribute("data-chapter", String(expectedChapter));
  await expect(page.locator(".story-chapter:visible")).toHaveCount(1);
  await expect(page.locator('.story-chapter[data-chapter="' + expectedChapter + '"]')).toContainText(CHAPTER_HEADINGS[expectedChapter]);
  const accessibility = await page.locator(".story-chapter").evaluateAll((chapters, active) => {
    return chapters.every((chapter, index) => index === active ? !chapter.hidden : chapter.hidden || chapter.getAttribute("aria-hidden") === "true");
  }, expectedChapter);
  expect(accessibility).toBe(true);
  await expect(page.locator("#scroll-story [aria-live]:not([aria-live=off])")).toHaveCount(0);
}

async function assertNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("slow forward and reverse scroll use one scene and deterministic chapter states", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await page.locator("canvas").evaluate((canvas) => { window.originalStoryCanvas = canvas; });
  const stage = await page.locator(".story-stage").evaluate((element) => ({
    position: getComputedStyle(element).position,
    height: element.getBoundingClientRect().height,
    viewport: innerHeight,
    storyHeight: document.querySelector("#scroll-story").getBoundingClientRect().height,
  }));
  expect(stage.position).toBe("sticky");
  expect(stage.height).toBeCloseTo(stage.viewport, -1);
  expect(stage.storyHeight / stage.viewport).toBeCloseTo(2.76, 2);

  await scrollToProgress(page, 0);
  const beforeWheel = await page.evaluate(() => scrollY);
  await page.mouse.move(1000, 600);
  await page.mouse.wheel(0, 140);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeWheel + 100);

  for (const progress of [0, 0.06, 0.13, 0.21, 0.28, 0.34, 0.42, 0.48, 0.56, 0.64, 0.72, 0.79, 0.8]) {
    await scrollToProgress(page, progress);
    await checkChapter(page, progress);
    await assertNoOverflow(page);
  }
  await scrollToProgress(page, 0.34);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
  await expect(page.locator("#story-layer-labels")).toBeVisible();
  for (const layer of ["instructions", "script", "examples"]) {
    await expect(page.locator('#story-layer-labels [data-layer="' + layer + '"]')).toBeVisible();
  }
  await scrollToProgress(page, 0.49);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "packaged");
  await scrollToProgress(page, 0.79);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "2");

  for (const progress of [0.8, 0.74, 0.61, 0.51, 0.44, 0.34, 0.26, 0.19, 0.07, 0]) {
    await scrollToProgress(page, progress);
    await checkChapter(page, progress);
  }
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "separate");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "0");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector("canvas") === window.originalStoryCanvas)).toBe(true);
  expect(errors).toEqual([]);
});

test("fast scroll reaches the final state and reverses without delayed writes", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await scrollToProgress(page, 0, 0);
  await scrollToProgress(page, 1, 0);
  await checkChapter(page, 1);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "packaged");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "2");
  await expect(page.locator("#skills")).toHaveJSProperty("inert", false);
  await expect(page.locator("#skills")).toHaveCSS("opacity", "1");
  await scrollToListings(page);
  for (const skill of ["wallet", "api", "csv"]) {
    await expect(page.locator('.skill-card[data-skill="' + skill + '"] .skill-art')).toBeInViewport();
  }
  const marketplaceCard = page.locator('.skill-card[data-skill="wallet"]');
  await marketplaceCard.click();
  await expect(page.locator("#dialog-title")).toHaveText("Wallet history to CSV");
  await page.keyboard.press("Escape");
  await expect(marketplaceCard).toBeFocused();
  await scrollToProgress(page, 0.34, 0);
  await checkChapter(page, 0.34);
  await expect(page.locator("#skills")).toHaveJSProperty("inert", false);
  await page.locator('[data-story-jump="1"]').focus();
  await marketplaceCard.evaluate(button => button.focus({ preventScroll: true }));
  await expect(marketplaceCard).toBeFocused();
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "0");
  await page.waitForTimeout(350);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
  expect(errors).toEqual([]);
});

test("mode selection followed immediately by scrolling restores the selected hero preview", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await page.locator('.mode-label[for="hero-mode-buy"]').click();
  await scrollToProgress(page, 0.36, 0);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
  await expect(page.getByRole("radio", { name: "Buy", exact: true })).toBeChecked();
  await page.waitForTimeout(400);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "hero");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", "received");
  await expect(page.locator("body")).not.toHaveClass(/story-active/);
  await expect(page.getByRole("radio", { name: "Buy", exact: true })).toBeChecked();
  await expect(page.locator("#scene-caption")).toHaveText("Give your agent a skill worth reusing.");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.locator('.mode-label[for="hero-mode-sell"]').click();
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", "shared");
  expect(errors).toEqual([]);
});

test("hero mode changes leave an active scroll pose under the scroll controller", async ({ page }) => {
  await loadStory(page);
  await scrollToProgress(page, 0.36);
  await expect.poll(() => page.locator("#scene-container").evaluate(container =>
    container.dataset.progress === container.dataset.targetProgress,
  )).toBe(true);
  const pose = await page.locator("#scene-container").evaluate(container => ({
    progress: container.dataset.progress,
    assembly: container.dataset.assembly,
    labels: [...container.querySelectorAll(".agent-name")].map(label => label.textContent),
  }));
  // Change the native radio without moving the viewport back to the off-screen hero.
  await page.locator("#hero-mode-buy").evaluate(input => {
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  expect(await page.locator("#scene-container").evaluate(container => ({
    progress: container.dataset.progress,
    assembly: container.dataset.assembly,
    labels: [...container.querySelectorAll(".agent-name")].map(label => label.textContent),
  }))).toEqual(pose);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "story");
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator("#scene-container")).toHaveAttribute("data-story", "received");
  await expect(page.locator('[data-agent="a"] .agent-name')).toHaveText("Your agent");
});

test("midstory resize recomputes progress and framing from current layout", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await scrollToProgress(page, 0.37);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 800 }, { width: 360, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const actual = Number(await page.locator("#scroll-story").getAttribute("data-progress"));
      return Math.abs(actual - await currentGeometryProgress(page));
    }).toBeLessThan(0.01);
    await scrollToProgress(page, 0.37);
    await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
    await assertNoOverflow(page);
    const labelsFit = await page.locator("#story-layer-labels [data-layer]").evaluateAll((labels) => {
      const bounds = labels.map((label) => label.getBoundingClientRect());
      const copyBottom = document.querySelector(".story-chapter:not([hidden])").getBoundingClientRect().bottom;
      return bounds.every((box, index) => box.left >= -1 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight && (innerWidth > 760 || box.top > copyBottom) && bounds.every((other, otherIndex) => index === otherIndex || box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom));
    });
    expect(labelsFit).toBe(true);
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas.width).toBeGreaterThan(250);
    expect(canvas.height).toBeGreaterThan(250);
    await expect(page.locator("canvas")).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test("reload while scrolled down recovers the current chapter and scene", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await scrollToProgress(page, 0.69);
  await page.reload();
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await expect.poll(() => currentGeometryProgress(page)).toBeCloseTo(0.69, 2);
  await expect(page.locator("#scene-container")).toHaveAttribute("data-mode", "story");
  await checkChapter(page, 0.69);
  await expect.poll(async () => Number(await page.locator("#scene-container").getAttribute("data-progress"))).toBeCloseTo(0.69, 2);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("chapter navigation uses normal scroll and ordinary listings share accessible details", async ({ page }) => {
  await loadStory(page);
  await scrollToProgress(page, 0);
  for (const chapter of [1, 2, 3, 0]) {
    const jump = page.locator('[data-story-jump="' + chapter + '"]');
    await jump.focus();
    await page.evaluate(() => {
      window.storyNavigationSettled = false;
      window.addEventListener("scrollend", () => { window.storyNavigationSettled = true; }, { once: true });
    });
    await page.keyboard.press("Enter");
    await expect(page.locator("#scroll-story")).toHaveAttribute("data-chapter", String(chapter));
    await expect.poll(() => page.evaluate(() => window.storyNavigationSettled)).toBe(true);
    await expect.poll(async () => Number(await page.locator("#scroll-story").getAttribute("data-progress"))).toBeCloseTo(Math.min(0.8, CHAPTER_BOUNDARIES[chapter] + 0.004), 2);
  }
  await scrollToProgress(page, 0.8);
  await expect(page.locator("#story-skill-controls")).toBeHidden();
  await scrollToListings(page);
  const titles = { wallet: "Wallet history to CSV", api: "API pagination helper", csv: "CSV cleanup workflow" };
  for (const [skill, title] of Object.entries(titles)) {
    const control = page.locator('.skill-card[data-skill="' + skill + '"]');
    await control.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#dialog-title")).toHaveText(title);
    await expect(page.locator("#dialog-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // The native dialog queues its close event after removing the open state.
    // Wait for the page to unlock before focusing the next listing.
    await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
    await expect(control).toBeFocused();
  }
  // Native navigation reaches ordinary listings beyond the released stage.
  await scrollToProgress(page, 0.34);
  await page.locator('.site-header a[href="#skills"]').evaluate((anchor) => anchor.click());
  await expect(page.locator("#skills")).toHaveJSProperty("inert", false);
  await page.locator('.skill-card[data-skill="api"]').click();
  await expect(page.locator("#dialog-title")).toHaveText(titles.api);
});

test("mobile touch moves the shorter sticky story through native page scroll", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = collectBrowserErrors(page);
  await loadStory(page);
  await scrollToProgress(page, 0.34);
  const storyRatio = await page.locator("#scroll-story").evaluate((section) => section.getBoundingClientRect().height / innerHeight);
  expect(storyRatio).toBeCloseTo(2.12, 2);
  const canvas = await page.locator("canvas").boundingBox();
  const chapter = await page.locator(".story-chapter:visible").boundingBox();
  // A full-stage canvas may have empty space above its mobile 3D composition.
  // Check that readable chapter copy stays in the upper part of the stage.
  expect(chapter.y).toBeGreaterThanOrEqual(0);
  expect(chapter.y + chapter.height).toBeLessThan(844 * 0.45);
  const before = await page.evaluate(() => window.scrollY);
  const session = await context.newCDPSession(page);
  const x = canvas.x + canvas.width / 2;
  const startY = Math.min(canvas.y + canvas.height - 55, 760);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY }] });
  for (let step = 1; step <= 9; step += 1) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: startY - step * 25 }] });
    await page.waitForTimeout(16);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await assertNoOverflow(page);
  expect(errors).toEqual([]);
  await context.close();
});

test("reduced motion presents all chapters in normal flow and keeps skills usable", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadStory(page);
  await expect(page.locator(".story-chapter:visible")).toHaveCount(4);
  const reducedLayout = await page.locator(".story-stage").evaluate((stage) => {
    const chapters = [...document.querySelectorAll(".story-chapter")].map((chapter) => chapter.getBoundingClientRect());
    return {
      position: getComputedStyle(stage).position,
      ordered: chapters.every((bounds, index) => index === 0 || bounds.top >= chapters[index - 1].bottom),
      stageHeight: stage.getBoundingClientRect().height,
      storyHeight: document.querySelector("#scroll-story").getBoundingClientRect().height,
    };
  });
  expect(reducedLayout.position).not.toBe("sticky");
  expect(reducedLayout.ordered).toBe(true);
  expect(reducedLayout.storyHeight - reducedLayout.stageHeight).toBeLessThan(100);
  for (const heading of CHAPTER_HEADINGS) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await page.locator('.skill-card[data-skill="wallet"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("Wallet history to CSV");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await scrollToProgress(page, 0.34);
  await expect(page.locator(".story-chapter:visible")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("WebGL unavailable presents normal-flow diagrams and keeps skill details usable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(kind)) return null;
      return originalGetContext.call(this, kind, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#scene-container")).toHaveAttribute("data-scene", "fallback");
  await expect(page.locator("body")).toHaveClass(/webgl-unavailable/);
  await expect(page.locator("#scene-fallback")).toBeVisible();
  await expect(page.locator(".story-chapter:visible")).toHaveCount(4);
  expect(await page.locator(".story-stage").evaluate((stage) => getComputedStyle(stage).position)).not.toBe("sticky");
  for (const heading of CHAPTER_HEADINGS) {
    await page.getByRole("heading", { name: heading, exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.locator('#story-skill-controls [data-skill="csv"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("CSV cleanup workflow");
  await page.keyboard.press("Escape");
  await assertNoOverflow(page);
  expect(errors).toEqual([]);
});

test("captures the five desktop moments and two mobile compositions", async ({ page }) => {
  await mkdir("screenshots", { recursive: true });
  await loadStory(page);
  for (const progress of [0, 0.25, 0.34, 0.5, 0.75, 0.8]) {
    await scrollToProgress(page, progress, 200);
    await page.screenshot({ path: "screenshots/story-desktop-" + String(Math.round(progress * 100)).padStart(3, "0") + ".png" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const progress of [0.35, 0.7, 0.8]) {
    await scrollToProgress(page, progress, 200);
    await page.screenshot({ path: "screenshots/story-mobile-" + Math.round(progress * 100) + ".png" });
  }
  await page.setViewportSize({ width: 360, height: 720 });
  await scrollToProgress(page, 0.34, 200);
  await page.screenshot({ path: "screenshots/story-mobile-360x720-34.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Start a full-page capture at the top so the paused hero renderer can paint
  // and the fixed, offscreen skip link stays outside the image.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/story-reduced-motion.png", fullPage: true });
});
