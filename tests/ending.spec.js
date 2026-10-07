import { test, expect } from "@playwright/test";
import { scrollToStoryProgress, scrollToListings } from "./story-helpers.js";

async function settle(page) {
  await expect.poll(() => page.locator("#scroll-story").evaluate(section =>
    Math.abs(Number(section.dataset.progress) - Number(section.dataset.targetProgress)),
  )).toBeLessThan(0.0002);
}

async function endingGeometry(page) {
  return page.evaluate(() => {
    const box = element => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    const scene = document.querySelector("#scene-container");
    const labels = [...scene.querySelectorAll(".agent-label")];
    const chapter = document.querySelector('.story-chapter[data-chapter="3"]');
    const heading = chapter.querySelector("h2");
    const range = document.createRange();
    range.selectNodeContents(heading);
    return {
      scroll: scrollY, viewport: innerHeight,
      stage: box(document.querySelector(".story-stage")),
      chapter: box(chapter), canvas: box(scene.querySelector("canvas")),
      labels: labels.map(box),
      headingFits: [...range.getClientRects()].every(bounds =>
        bounds.left >= -1 && bounds.right <= innerWidth + 1 &&
        bounds.top >= -1 && bounds.bottom <= innerHeight + 1),
      pose: {
        progress: scene.dataset.progress, assembly: scene.dataset.assembly,
        copies: scene.dataset.copies,
        labels: labels.map(label => ({
          left: label.style.left, top: label.style.top,
          transform: label.style.transform, opacity: label.style.opacity,
        })),
      },
    };
  });
}

async function expectOrdinaryListings(page) {
  const layout = await page.locator("#skills").evaluate(section => {
    const style = getComputedStyle(section);
    const story = document.querySelector("#scroll-story");
    return {
      inert: section.inert, opacity: style.opacity, transform: style.transform,
      marginTop: parseFloat(style.marginTop),
      followsStory: section.getBoundingClientRect().top >= story.getBoundingClientRect().bottom - 1,
      icons: [...section.querySelectorAll(".skill-art")].map(icon => getComputedStyle(icon).opacity),
    };
  });
  expect(layout.inert).toBe(false);
  expect(layout.opacity).toBe("1");
  expect(layout.transform).toBe("none");
  expect(layout.marginTop).toBeGreaterThanOrEqual(0);
  expect(layout.followsStory).toBe(true);
  expect(layout.icons).toEqual(["1", "1", "1"]);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 925 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}: final chapter releases text, canvas and labels together into native scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
    await expectOrdinaryListings(page);
    await scrollToStoryProgress(page, 0.8);
    await settle(page);
    await expect(page.locator("#scroll-story")).toHaveAttribute("data-chapter", "3");
    await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "packaged");
    await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "2");
    // Let the final chapter's one-time text entrance finish before measuring.
    await page.waitForTimeout(800);
    const final = await endingGeometry(page);
    expect(final.stage.height).toBeCloseTo(viewport.height, 0);
    expect(Math.abs(final.stage.y)).toBeLessThanOrEqual(1);
    expect(final.headingFits).toBe(true);
    expect(final.labels).toHaveLength(3);
    const separate = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x ||
      a.y + a.height <= b.y || b.y + b.height <= a.y;
    final.labels.forEach((label, index) => {
      expect(separate(label, final.chapter)).toBe(true);
      expect(label.x).toBeGreaterThanOrEqual(final.canvas.x - 1);
      expect(label.x + label.width).toBeLessThanOrEqual(final.canvas.x + final.canvas.width + 1);
      expect(label.y).toBeGreaterThanOrEqual(final.canvas.y - 1);
      expect(label.y + label.height).toBeLessThanOrEqual(final.canvas.y + final.canvas.height + 1);
      final.labels.slice(index + 1).forEach(other => expect(separate(label, other)).toBe(true));
    });
    for (let tick = 0; tick < 3; tick++) {
      const before = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 100);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before + 95);
      await settle(page);
      const current = await endingGeometry(page);
      const delta = current.scroll - final.scroll;
      expect(Number(await page.locator("#scroll-story").getAttribute("data-progress"))).toBe(0.8);
      expect(Number(await page.locator("#scroll-story").getAttribute("data-target-progress"))).toBe(0.8);
      expect(current.pose).toEqual(final.pose);
      for (const [original, moved] of [
        [final.stage, current.stage], [final.chapter, current.chapter],
        [final.canvas, current.canvas], ...final.labels.map((label, index) => [label, current.labels[index]]),
      ]) {
        // CSS viewport heights and native scroll positions round independently.
        expect(Math.abs(moved.y - original.y + delta)).toBeLessThanOrEqual(1);
        expect(moved.x).toBeCloseTo(original.x, 0);
        expect(moved.width).toBeCloseTo(original.width, 0);
        expect(moved.height).toBeCloseTo(original.height, 0);
      }
      await expectOrdinaryListings(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await scrollToListings(page);
    const wallet = page.locator('.skill-card[data-skill="wallet"]');
    await expect(wallet).toBeInViewport();
    await wallet.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#dialog-title")).toHaveText("Wallet history to CSV");
    await page.keyboard.press("Escape");
    await expect(wallet).toBeFocused();
    await scrollToStoryProgress(page, 0.8);
    await settle(page);
    expect((await endingGeometry(page)).pose).toEqual(final.pose);
    await scrollToStoryProgress(page, 0.34);
    await settle(page);
    await expect(page.locator("#scene-container")).toHaveAttribute("data-assembly", "exploded");
    await expect(page.locator("#scene-container")).toHaveAttribute("data-copies", "0");
    await expect(page.locator("#story-layer-labels")).toBeVisible();
    await expectOrdinaryListings(page);
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("early choreography keeps its scroll mapping and ends at the natural stage release", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.locator("#scroll-story").evaluate(section => ({
      height: section.getBoundingClientRect().height,
      stageHeight: section.querySelector(".story-stage").getBoundingClientRect().height,
    }));
    const lead = viewport.width <= 760 ? 1.4 : 2.2;
    expect(geometry.height / viewport.height).toBeCloseTo(viewport.width <= 760 ? 2.12 : 2.76, 2);
    expect(geometry.stageHeight).toBeCloseTo(viewport.height, 0);
    const positions = [];
    for (const progress of [0, 0.25, 0.5, 0.8, 1]) {
      await scrollToStoryProgress(page, progress);
      await settle(page);
      positions.push(await page.evaluate(() => scrollY));
    }
    for (const [index, progress] of [[1, 0.25], [2, 0.5], [3, 0.8]]) {
      expect(positions[index] - positions[0]).toBeCloseTo(viewport.height * lead * progress, 0);
    }
    expect(positions[4]).toBe(positions[3]);
    expect(positions[3] - positions[0]).toBeCloseTo(geometry.height - geometry.stageHeight, 0);
    const releasedAt = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollBy({ top: 150, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(releasedAt + 149);
    await settle(page);
    expect(Number(await page.locator("#scroll-story").getAttribute("data-progress"))).toBe(0.8);
    expect(await page.locator(".story-stage").evaluate(stage => stage.getBoundingClientRect().top)).toBeLessThan(-145);
  }
});
