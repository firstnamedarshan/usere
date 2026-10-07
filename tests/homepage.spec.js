import { test, expect } from "@playwright/test";

async function loadReadyScene(page) {
  await page.goto("/");
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
}

test("off-screen scenes stop scheduling animation frames", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.addInitScript(() => {
    const originalRequest = window.requestAnimationFrame;
    window.sceneFrameCount = 0;
    window.requestAnimationFrame = function (callback) {
      return originalRequest.call(window, (timestamp) => {
        window.sceneFrameCount += 1;
        callback(timestamp);
      });
    };
  });
  await loadReadyScene(page);
  await page.evaluate(() => {
    // Give this visibility test enough trailing flow to move the entire sticky
    // canvas outside the viewport, even with the marketplace's native overlap.
    const spacer = document.createElement("div");
    spacer.style.height = "100vh";
    spacer.setAttribute("aria-hidden", "true");
    document.body.appendChild(spacer);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  });
  await page.waitForTimeout(300);
  expect(
    await page
      .locator("#scene-container")
      .evaluate((element) => element.getBoundingClientRect().bottom),
  ).toBeLessThan(0);
  const before = await page.evaluate(() => window.sceneFrameCount);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.sceneFrameCount);
  expect(after - before).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.sceneFrameCount)).toBeGreaterThan(
    after,
  );
});

test("touch swipes over the canvas scroll the page", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator("#scene-container")).toHaveClass(/scene-ready/);
  const canvas = await page.locator("canvas").boundingBox();
  const session = await context.newCDPSession(page);
  const x = canvas.x + canvas.width / 2;
  const startY = Math.min(canvas.y + canvas.height - 40, 760);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  for (let step = 1; step <= 8; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY - step * 24 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await context.close();
});
