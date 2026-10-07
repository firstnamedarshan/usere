import { test, expect } from "@playwright/test";
import { scrollToStoryProgress } from "./story-helpers.js";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1882, height: 907 },
  { width: 390, height: 844 },
  { width: 360, height: 720 },
]) {
  test(`${viewport.width}: hero agents stay painted across both canvas handoffs`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
    await page.waitForTimeout(1100);
    const geometry = await page.evaluate(() => {
      window.continuousCanvas = document.querySelector("canvas");
      const anchor = document.querySelector(".hero-scene-anchor").getBoundingClientRect();
      return {
        start: Math.max(0, anchor.top + anchor.height / 2 - innerHeight * 0.48),
        end: document.querySelector("#scroll-story").getBoundingClientRect().top,
      };
    });
    for (const edge of [geometry.start, geometry.end]) {
      const frames = [];
      for (const position of [edge - 1, edge + 1, edge - 1]) {
        await page.evaluate(top => scrollTo({ top: Math.max(0, top), behavior: "instant" }), position);
        await page.waitForTimeout(100);
        frames.push(await page.evaluate(() => ({
          sameCanvas: document.querySelector("canvas") === window.continuousCanvas,
          ready: document.querySelector("#scene-container").classList.contains("scene-ready"),
          opacity: Number(getComputedStyle(document.querySelector("canvas")).opacity),
          labels: [...document.querySelectorAll(".agent-label")].map(label => {
            const bounds = label.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, visible: getComputedStyle(label).visibility };
          }),
        })));
      }
      for (const frame of frames) {
        expect(frame.sameCanvas).toBe(true);
        expect(frame.ready).toBe(true);
        expect(frame.opacity).toBe(1);
        for (const label of frame.labels) expect(label.visible).toBe("visible");
      }
      for (let index = 1; index < frames.length; index++) {
        frames[index].labels.forEach((label, agent) => {
          expect(Math.hypot(label.x - frames[index - 1].labels[agent].x,
            label.y - frames[index - 1].labels[agent].y)).toBeLessThan(8);
        });
      }
    }
    for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
      await page.evaluate(top => scrollTo({ top, behavior: "instant" }),
        geometry.start + (geometry.end - geometry.start) * fraction);
      await page.waitForTimeout(100);
      await expect(page.locator(".scene-bridge-layer canvas")).toHaveCount(1);
      await expect(page.locator(".story-loading-composition")).toBeHidden();
      await expect(page.locator(".hero-scene-still")).toHaveCount(0);
      if (viewport.width <= 760) {
        const overlaps = await page.evaluate(() => {
          const copy = document.querySelector(".story-copy");
          if (getComputedStyle(copy).visibility === "hidden") return false;
          const bounds = copy.getBoundingClientRect();
          return [...document.querySelectorAll(".agent-label")].some(label =>
            label.getBoundingClientRect().top < bounds.bottom);
        });
        expect(overlaps).toBe(false);
      }
    }
    expect(errors).toEqual([]);
  });
}

test("chapter copy visibly reveals forward and backward and then settles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  async function go(progress) {
    await scrollToStoryProgress(page, progress);
  }
  await go(0.23);
  await expect(page.locator("#scroll-story")).toHaveAttribute("data-chapter", "0");
  for (const [progress, chapter] of [[0.3, 1], [0.55, 2], [0.83, 3], [0.55, 2], [0.3, 1]]) {
    await go(progress);
    await expect(page.locator("#scroll-story")).toHaveAttribute("data-chapter", String(chapter));
    const heading = page.locator('.story-chapter:not([hidden]) h2');
    await expect.poll(() => heading.evaluate(element => element.getAnimations().some(animation =>
      animation.playState === "running" && animation.effect.getComputedTiming().duration >= 600,
    ))).toBe(true);
    await expect(page.locator(".story-chapter:visible")).toHaveCount(1);
    await expect(heading).toHaveCSS("opacity", "1");
    await expect(heading).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  }
});
