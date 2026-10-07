import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Decode the actual recording into a chronological contact sheet for visual QA.
// Optional numeric arguments review a shorter interval: URL startSeconds endSeconds.
const url = process.argv[2] || "http://127.0.0.1:5173/screenshots/story-scroll.webm";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && Number.isFinite(video.duration) && video.readyState >= 2;
  });
  const metadata = await page.evaluate(() => {
    const video = document.querySelector("video");
    video.pause();
    const canvas = document.createElement("canvas");
    canvas.id = "review-frames";
    canvas.width = 2160;
    canvas.height = 1896;
    canvas.hidden = true;
    document.body.append(canvas);
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  });
  const start = Number(process.argv[3] || 0);
  const end = Math.min(Number(process.argv[4] || metadata.duration), metadata.duration);
  const times = [];
  for (let index = 0; index < 12; index += 1) {
    const time = start + (end - start) * (index + 0.5) / 12;
    times.push(Number(time.toFixed(2)));
    await page.evaluate((time) => new Promise((resolve) => {
      const video = document.querySelector("video");
      video.addEventListener("seeked", resolve, { once: true });
      video.currentTime = time;
    }), time);
    await page.evaluate(({ index, time }) => {
      const canvas = document.querySelector("#review-frames");
      const context = canvas.getContext("2d");
      const x = (index % 3) * 720;
      const y = Math.floor(index / 3) * 474;
      context.fillStyle = "#172941";
      context.fillRect(x, y, 720, 474);
      context.drawImage(document.querySelector("video"), x, y, 720, 450);
      context.fillStyle = "#ffffff";
      context.font = "13px sans-serif";
      context.fillText(time.toFixed(2) + " s", x + 12, y + 467);
    }, { index, time });
  }
  const dataURL = await page.evaluate(() => document.querySelector("#review-frames").toDataURL("image/png"));
  const output = process.argv[5] || "screenshots/story-motion-review.png";
  await writeFile(output, Buffer.from(dataURL.split(",")[1], "base64"));
  console.log(JSON.stringify({ ...metadata, times, output }));
} finally {
  await browser.close();
}
