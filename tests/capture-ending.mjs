import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { scrollToStoryProgress, scrollToListings } from "./story-helpers.js";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await mkdir("screenshots", { recursive: true });
for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 925 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(viewport);
  await page.goto("http://127.0.0.1:5173/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".scene-ready");
  for (const progress of [0.79, 0.8]) {
    await scrollToStoryProgress(page, progress);
    await page.waitForFunction(progress => Math.abs(Number(document.querySelector("#scroll-story").dataset.progress) - progress) < 0.001, progress);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots/ending-${viewport.width}-${Math.round(progress * 1000)}.png` });
  }
  for (const offset of [150, 350]) {
    await scrollToStoryProgress(page, 0.8);
    await page.evaluate(offset => scrollBy({ top: offset, behavior: "instant" }), offset);
    await page.waitForFunction(() => Math.abs(
      Number(document.querySelector("#scroll-story").dataset.progress) - 0.8,
    ) < 0.001);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `screenshots/ending-${viewport.width}-released-${offset}.png` });
  }
  await scrollToListings(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/ending-${viewport.width}-listings.png` });
}
console.log(JSON.stringify({ errors }));
await browser.close();
