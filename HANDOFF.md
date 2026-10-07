# Reusable Network source handoff

> Historical frontend snapshot. Current MVP setup and behavior are documented in README.md and PROJECT_STATUS.md. Read REUSABLE_PROJECT_HANDOFF.md first. This document's preview-only statements and old upload bounds describe earlier work, not the current implementation.

This ZIP contains the complete editable frontend, locked npm dependencies, public assets, browser checks and four current screenshots. Dependencies and generated output are recreated locally; the large development folder is unnecessary.

## Start

Extract the ZIP into a folder. Open a terminal in that folder (beside package.json). Use Node.js 22.20+ or 24.12+ with npm, then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. npm ci requires an internet connection to download the dependencies. Serve through Vite over HTTP; opening index.html directly is insufficient.

For a production build and preview:

```sh
npm run build
npm run preview -- --port 4174 --strictPort
```

Open http://127.0.0.1:4174/. The preview command stays running; use a second terminal for checks.

## Verify changes

Install the test browser once:

```sh
npx playwright install chromium
npm test
```

On Linux, Chromium may need system libraries; use npx playwright install --with-deps chromium if required. npm test starts the development server when needed. With the production preview running on port 4174, run:

```sh
node tests/production-smoke.mjs
```

## Current implementation

- Vanilla JavaScript, Vite, Three.js and Manrope. The agents are procedural geometry; no separate model downloads are required.
- The hero uses one heroMode state, sell or buy. Sell is the default. The primary button comes before the glossy two-option radio control, with both mode labels inside it. Exact copy, accessible keyboard selection, stable text space, 300 ms transitions and reduced motion are implemented.
- Sell links to /submit. Buy links to /marketplace. Sell retains the creator's original skill and shares copies; Buy shows Your agent receiving a skill.
- The marketplace has six labeled sample skills, search and category filtering. Cards link to standalone details with requirements, examples, sample creators and SOL prices; Buy is disabled.
- The submission form previews one local SKILL.md as plain text and validates the listing fields. Submit skill is disabled. Drafts stay in tab memory and are not saved, uploaded or published.
- The reading theme uses a soft grey-white background, dark body text, Segoe UI/system reading fonts and Manrope headings. Detail text is 18 px with limited line widths; labels and disabled-button text are clearer. Homepage animation code is preserved.
- New pages share the homepage colors, spacing and buttons without importing its Three.js scene. Hosting must fall back to index.html for direct /marketplace, detail and /submit URLs.
- Four scroll chapters use constant agent positions, scale and a symmetrical scene. The animation settles at Find your agent's next skill. Then the text and all three agents scroll upward together through normal document flow.
- A little less from scratch is a normal listings section. Short screens, reduced motion and unavailable WebGL use readable static story content.
- This is a frontend prototype. Wallets, publishing, purchases, submissions and payments have no backend or real transactions.

## Files to edit

| File | Purpose |
| --- | --- |
| index.html | Hero, chapter and listings markup/copy. |
| styles.css | Responsive layout, typography, glossy control and transitions. |
| main.js | Shared fonts and pathname-based page loading. |
| homepage.js | heroMode, homepage navigation, dialogs and focus. |
| pages.js | Marketplace, details and local submission preview. |
| pages.css | Lightweight responsive page styles. |
| scene.js | Three.js geometry, materials, camera and hero/story scenes. |
| story.js | Scroll progress, chapter timing, canvas bridge and sticky release. |
| skills.js | Illustrative package data and icons. |
| public/ | Favicon and font license. |
| tests/ | Browser regression checks and capture scripts. |

README.md explains the implementation. VERIFICATION.md records checks from the original workspace; those historical results should be rechecked after changes. Their localhost URLs refer to the machine running the server.

## Included visual references

- screenshots/hero-desktop-sell.png
- screenshots/hero-desktop-buy.png
- screenshots/framing-1440-80.png
- screenshots/framing-390-80.png

Only these four captures are included. Other screenshots, the review gallery and videos mentioned in older documents are generated local review artifacts and are omitted to keep the ZIP small. Test and capture scripts can generate new captures.

node_modules, .git, dist, logs, browser profiles, test results and raw recordings are intentionally excluded. Keep package.json and package-lock.json together; npm ci restores the pinned dependencies. No Git history is required to run or edit this project.
