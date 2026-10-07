# Verification — 7 October 2026

> Historical verification record. Current implementation checks, setup blockers, and live integration status are recorded in PROJECT_STATUS.md (8 October 2026). The preview-only claims below describe the earlier frontend, not the current backend code.

## Readability update

Softened the main background to `#f6f7f9`, darkened body text to `#344054`, and switched reading copy to Segoe UI/system fonts while keeping Manrope headings and the logo. Detail paragraphs/lists are 18 px with 1.75 line height and limited reading widths. Secondary labels, help text, inputs and code examples are larger. Disabled actions retain readable labels. Homepage animation JavaScript is unchanged.

Body/background contrast increased from approximately 4.93:1 to 9.76:1. Sidebar notes are approximately 6.69:1; disabled-button labels are approximately 5.99:1. These are color-pair measurements, not a claim of full-site accessibility conformance.

`npm run build` passed. All 21 targeted browser checks passed: homepage hero layouts at six sizes, keyboard mode navigation and action destinations, steady scene framing at four sizes, plus the nine marketplace/submission tests. Inner pages fit 1440, 820, 390 and 320 px widths. Updated screenshots and the production detail page were inspected. Chromium’s rendered-font inspection confirmed that paragraph text uses the installed Segoe UI font.

## Marketplace milestone

Implemented `/marketplace`, `/marketplace/:skill-slug` and `/submit` with the homepage’s Manrope typography, white/navy palette, pastel skill icons, spacing and buttons. The homepage Buy action now opens the marketplace, and Sell opens submission. Homepage design and scene/story animations are preserved.

Six sample skills include category, summary, sample creator, sample SOL price, requirements and illustrative input/output. Search combines with category filtering, handles empty results, and restores filters after reload or browser Back. Every details page works at its direct URL and keeps Buy disabled with an explicit payment limitation.

Submission reads one local UTF-8 `SKILL.md` (up to 1 MB), shows literal plain text, validates the required listing fields and positive SOL price, and builds a local preview. Invalid filenames, empty/binary/non-UTF-8/oversized files and invalid prices are rejected. Editing fields or replacing/removing the file clears stale listing previews. File and form text never becomes HTML. Submit skill is disabled; there are no write requests, backend actions or draft persistence.

Verified:

- `npm test`: all 60 Chromium browser tests passed, including the existing 51 homepage/animation checks and nine new marketplace/submission/responsive checks.
- `npm run build`: passed. The existing lazy Three.js chunk retains its 500 kB advisory; inner routes do not load that module.
- `node tests/production-smoke.mjs`: passed against the production preview on port 4174, including homepage action destinations, marketplace/details, direct detail reload, disabled Buy, preserved story behavior and zero browser errors.
- Inner pages fit 1440, 820, 390 and 320 px widths with visible navigation and no horizontal overflow. Desktop/mobile screenshots and the in-app production preview were inspected.

Review URLs: http://127.0.0.1:4174/marketplace, http://127.0.0.1:4174/marketplace/wallet-history-to-csv and http://127.0.0.1:4174/submit. New screenshots: `screenshots/marketplace-{1440,390}.png`, `screenshots/skill-details-{1440,390}.png` and `screenshots/submit-{1440,390}.png`.

Production hosting needs an `index.html` fallback for these routes. Physical-phone and non-Chromium behavior remain unverified.

## Earlier homepage update (historical record)

Sell/Buy modes retain the exact requested hero copy, default Sell state, one semantic H1, native radio accessibility, 300 ms crossfades and reserved layout. The primary action precedes the toggle, both mode labels are inside it, and hero typography is larger. Sell opens the labeled frontend submission preview; Buy reaches the listings.

The scroll story now uses a steady camera and constant agent scale/positions across its chapters. The two receiving stations are symmetrical around the creator. Desktop framing centers the scene beside the larger copy; mobile reserves space below the tallest explanation. Direct interpolation of the scene’s screen center removes the sideways dip during the hero bridge. Mobile fitting uses the destination stage’s dimensions to prevent size overshoot. Static-to-animated changes measure copy after applying the destination layout, and agent labels keep clear space above the chapter controls.

Story typography reaches 72 px on desktop and 36–40 px on mobile, with 20–22 px / 18 px descriptions. The palette, Manrope and glossy 3D materials remain. Short phones at or below 700 px viewport height use the existing readable normal-flow story layout; other short windows at or below 620 px, reduced motion and unavailable WebGL use that same fallback.

Choreography ends at progress 0.8, when “Find your agent’s next skill” begins. The completed pose freezes; the native sticky stage releases and text, canvas and all three agent labels scroll upward together. The earlier pacing remains 1.76 viewport heights desktop / 1.12 mobile. The section is 276dvh / 212dvh with a 100dvh stage.

“A little less from scratch” is a normal listings section. It has no scroll transforms, overlap, opacity reveal, icon handoff or card movement. Listings stay fully interactive, and reverse scrolling restores the earlier assembly and copying scenes.

## Checks

All 51 unique Chromium browser checks passed across the regression and final targeted runs. They cover:

- Exact copy, default mode, six responsive hero sizes, repeated keyboard switching, visible focus, stable text geometry and correct action destinations.
- Steady agent spacing and scale at 1440×900, 1920×925, 390×844 and 360×720; symmetrical receiving positions and a direct bridge path without horizontal reversal.
- The final native exit at 1440×900, 1920×925 and390×844: text, canvas and all three labels move together while their local pose and progress stay fixed. Listings remain opaque, untransformed, non-overlapping and interactive.
- Earlier forward/reverse and fast scrolling, shared canvas identity, chapter changes, active-story mode ownership, resize/reload restoration, keyboard/touch input and details/focus.
- Reduced motion, module loading failure/delay, WebGL context loss/recovery, off-screen rendering, frozen-page recovery and readable short-phone flow with restoration after resizing taller.

The final production build and production smoke check passed. The smoke check covered both hero modes/actions, assembly and copies, native final release, ordinary listings, reverse restoration, dialogs/focus, mobile resize, local font licensing and one canvas, with zero page or console errors. Vite’s existing advisory remains for the lazy-loaded Three.js chunk (517.08 kB / 132.52 kB gzip).

The result was inspected in the in-app browser and in desktop/mobile PNG captures. A new native-scroll recording shows the completed interaction. Chromium mobile emulation does not establish physical-phone performance; other browser engines remain untested.

## Review

- Live homepage: http://127.0.0.1:5173/
- Production preview: http://127.0.0.1:4174/
- Screenshots and native scroll recording: http://127.0.0.1:5173/screenshots/review.html
- Hero: screenshots/hero-desktop-sell.png and screenshots/hero-desktop-buy.png; mobile equivalents use hero-mobile-sell.png /hero-mobile-buy.png.
- Story: screenshots/framing-1440-{0,34,55,80}.png and framing-390-{0,34,55,80}.png.
- Native exit/listings: screenshots/ending-1440-released-150.png, ending-1440-released-350.png and ending-1440-listings.png.
- Short phones: screenshots/story-short-phone.png.

```powershell
npm test
npm run build
node tests/production-smoke.mjs
node tests/capture-ending.mjs
node tests/record-story.mjs http://127.0.0.1:5173
```

The smoke check expects the preview server on port 4174. Capture scripts use the development server on 5173. This remains a frontend prototype; no submissions, wallet transactions or backend were added.
