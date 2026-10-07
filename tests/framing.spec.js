import { test, expect } from "@playwright/test";
import { scrollToStoryProgress } from "./story-helpers.js";

for (const viewport of [
  { width: 1440, height: 900 }, { width: 1920, height: 925 },
  { width: 390, height: 844 }, { width: 360, height: 720 },
]) test(`${viewport.width}: agents retain symmetric spacing and scale across story chapters`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  await page.waitForTimeout(1100);
  const bridge = await page.evaluate(() => {
    const anchor = document.querySelector(".hero-scene-anchor").getBoundingClientRect();
    return { start: Math.max(0, anchor.top + anchor.height / 2 - innerHeight * 0.48),
      end: document.querySelector("#scroll-story").getBoundingClientRect().top };
  });
  async function centers(local = false) {
    return page.locator(".agent-label").evaluateAll((labels, local) => labels.map(label => {
      const box = label.getBoundingClientRect();
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      return { x: box.x + box.width / 2 - (local ? canvas.x : 0),
        y: box.y - (local ? canvas.y : 0) };
    }), local);
  }
  const samples = [];
  for (const fraction of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    await page.evaluate(top => scrollTo({ top, behavior: "instant" }),
      bridge.start + (bridge.end - bridge.start) * fraction);
    await page.waitForTimeout(100);
    samples.push(await centers());
  }
  for (let agent = 0; agent < 3; agent++) {
    const from = samples[0][agent].x;
    const to = samples.at(-1)[agent].x;
    const direction = Math.sign(to - from);
    for (let index = 1; index < samples.length; index++) {
      // A direct path must not dip left then return right (or vice versa).
      expect((samples[index][agent].x - samples[index - 1][agent].x) * direction).toBeGreaterThanOrEqual(-2);
    }
  }
  let reference;
  for (const progress of [0, 0.34, 0.55, 0.79, 0.8]) {
    await scrollToStoryProgress(page, progress);
    await expect.poll(() => page.locator("#scroll-story").evaluate(section =>
      Math.abs(Number(section.dataset.progress) - Number(section.dataset.targetProgress)),
    )).toBeLessThan(0.0002);
    const positions = await centers(true);
    reference ??= positions;
    positions.forEach((position, index) => {
      expect(Math.abs(position.x - reference[index].x)).toBeLessThan(1);
      expect(Math.abs(position.y - reference[index].y)).toBeLessThan(1);
    });
    const [creator, left, right] = positions;
    expect(Math.abs(creator.x - left.x - (right.x - creator.x))).toBeLessThan(1);
    expect(Math.abs(left.y - right.y)).toBeLessThan(1);
    const spread = right.x - left.x;
    expect(spread).toBeGreaterThan(viewport.width * (viewport.width <= 760 ? 0.2 : 0.23));
    expect(spread).toBeLessThan(viewport.width * (viewport.width <= 760 ? 0.65 : 0.35));
    expect(creator.x / viewport.width).toBeCloseTo(viewport.width <= 760 ? 0.5 : 0.72, 1);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots/framing-${viewport.width}-${Math.round(progress * 100)}.png` });
  }
});
