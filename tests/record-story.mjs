import { chromium } from "@playwright/test";
import { mkdir, copyFile } from "node:fs/promises";

// Run after starting the dev server: node tests/record-story.mjs [server URL]
const serverURL = process.argv[2] || "http://127.0.0.1:5173";
await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: "screenshots/recordings", size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(serverURL);
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector("#scene-container.scene-ready");
await page.waitForTimeout(1000);
await page.locator('.mode-label[for="hero-mode-buy"]').click();
await page.waitForTimeout(1200);
const geometry = await page.locator("#scroll-story").evaluate((section) => ({
  top: section.getBoundingClientRect().top + scrollY,
  travel: section.getBoundingClientRect().height - innerHeight,
  reverse: section.offsetTop + innerHeight * (innerWidth <= 760 ? 1.4 : 2.2) * 0.3,
}));

// Small native scroll steps make timing and reverse behavior visible in the video.
async function moveBetween(from, to, steps, delay) {
  for (let index = 0; index <= steps; index += 1) {
    const y = from + (to - from) * index / steps;
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(delay);
  }
}
await moveBetween(0, geometry.top, 16, 24);
await page.waitForTimeout(700);
// Actual wheel notches, including pauses, show the target/display damping.
await page.mouse.move(1100, 600);
for (let index = 0; index < 7; index += 1) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(280);
}
await page.waitForTimeout(600);
await moveBetween(await page.evaluate(() => scrollY), geometry.top + geometry.travel, 80, 28);
await page.waitForTimeout(750);
await moveBetween(geometry.top + geometry.travel, geometry.reverse, 45, 24);
await page.waitForTimeout(450);
await moveBetween(geometry.reverse, geometry.top + geometry.travel + 500, 50, 24);
await page.waitForTimeout(500);
await page.locator('.skill-card[data-skill="wallet"]').click();
await page.waitForTimeout(1000);
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
const video = page.video();
await context.close();
await copyFile(await video.path(), "screenshots/story-scroll.webm");
await video.delete();
await browser.close();
if (errors.length) throw new Error("Browser errors during recording: " + errors.join(" | "));
console.log("Recorded screenshots/story-scroll.webm");
