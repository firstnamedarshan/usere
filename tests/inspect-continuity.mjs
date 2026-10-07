import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:5173');
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector('.scene-ready');
await page.waitForTimeout(1000);
for (const size of [{width:1440,height:900},{width:1882,height:907},{width:390,height:844}]) {
  await page.setViewportSize(size);
  await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
  await page.waitForTimeout(300);
  const top = await page.locator('#scroll-story').evaluate(s => s.getBoundingClientRect().top + scrollY);
  for (const fraction of [0, 0.25, 0.5, 0.75, 0.99, 1]) {
    await page.evaluate(y => scrollTo({top:y,behavior:'instant'}), top*fraction);
    await page.waitForTimeout(300);
    await page.screenshot({path:`screenshots/continuity-${size.width}-${fraction}.png`});
    console.log(JSON.stringify(await page.evaluate(() => ({
      width:innerWidth, scroll:scrollY,
      parent:document.querySelector('#scene-container').parentElement.className,
      bridge:document.querySelector('#scroll-story').dataset.bridge,
      labels:[...document.querySelectorAll('.agent-label')].map(l => ({text:l.textContent.trim(),x:l.getBoundingClientRect().x,y:l.getBoundingClientRect().y})),
      overflow:document.documentElement.scrollWidth-innerWidth,
    }))));
  }
}
console.log(JSON.stringify({errors}));
await browser.close();
