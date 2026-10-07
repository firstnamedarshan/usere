export async function scrollToStoryProgress(page, progress) {
  const target = Math.max(0, Math.min(0.8, progress));
  await page.locator("#scroll-story").evaluate((section, progress) => {
    const lead = innerHeight * (innerWidth <= 760 ? 1.4 : 2.2);
    scrollTo({ top: section.offsetTop + progress * lead, behavior: "instant" });
  }, target);
  // scrollTo changes document position immediately, but the native scroll
  // callback updates the renderer's target on the next event turn.
  await page.waitForFunction(progress => Math.abs(
    Number(document.querySelector("#scroll-story").dataset.targetProgress) - progress,
  ) < 0.001, target);
}

// Listings follow the released story in ordinary document flow. Reaching the
// final choreography pose does not scroll the listings into the viewport.
export async function scrollToListings(page) {
  await page.locator("#skills").evaluate(section =>
    section.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.waitForFunction(() => {
    const bounds = document.querySelector("#skills").getBoundingClientRect();
    return bounds.top >= -1 && bounds.top < innerHeight;
  });
}
