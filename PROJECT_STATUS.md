# Project status

Updated: 8 October 2026 (India time).

Current gate: finish milestone 2 live wallet login/admin setup, then milestone 3 two-wallet Devnet acceptance. Marketplace implementation and Cloudflare preparation are present. Agent drafting integration is now required for MVP completion after purchase/download acceptance; it is not yet implemented. No token launch, mainnet, or public frontend deployment.

## Scope update — 8 October 2026

- User explicitly replaced the old decision to defer automatic drafting. Keep all existing marketplace work and finish the real purchase/download flow first, then implement milestone 5 for one supported agent client.
- After a useful task, the existing agent prepares a local reusable skill with instructions, requirements, a synthetic example, and truthful available evidence. Do not invent test results.
- Add **Drafts from your agent** for local review/editing, pricing, and explicit submission to the existing pending-review flow. Keep drafts on the user's device until upload approval; never automatically upload raw conversations, project files, or credentials. Manual upload stays available.
- Drafting/uploading/publication create no earnings. Only another user's purchase transfers payment; this MVP uses test SOL with no real earnings.
- This session updated REUSABLE_PROJECT_HANDOFF.md and README.md to match. No application, database, or deployment change was made for this scope update. The existing demo-draft button is a local sample helper, not the new agent integration.

## Implemented

- Existing Vite/plain JS/CSS stack and 3D homepage preserved. scene.js/story.js unchanged. Real wallet button and Sell/Buy/marketplace navigation.
- Live marketplace/details, plain-text SKILL.md submission, account, explicit-admin review, server-created orders, finalized legacy SOL transfer+memo verification, atomic ownership and exact-version private download.
- 100 KB UTF-8 file/obvious-secret checks, sharing consent, immutable reviewed content, integer lamport prices capped at 10 test SOL. No fake successful purchases or automatic sample fallback.
- Former examples retained at /examples. Tested open transfer-records-to-CSV demo in public/demo/transfer-records/SKILL.md and examples/transfer-records/.
- Submission now offers **Use tested demo draft**: existing open sample file and listing metadata loaded locally at 0.01 Devnet SOL, consent unchecked, manual preview and upload still required. No automatic listing or approval. Fields/reuse terms explicitly identify open demo content. Metadata: app/demo-draft.js.
- Cloudflare Workers Static Assets config/direct-route fallback; beginner setup and payment recovery in README.md. No deployment authorization yet.

## Live Supabase state

- User chose Tools organization and created **Reusable Network** on Free in Mumbai.
- Dedicated project: faeogcjqtktqbgwmzhim, ACTIVE_HEALTHY; URL https://faeogcjqtktqbgwmzhim.supabase.co.
- Unrelated Supabase projects remain untouched.
- Migration marketplace applied via MCP; remote version **20261007191453**. Local file renamed to match: supabase/migrations/20261007191453_marketplace.sql. Do not apply it twice.
- All five public tables have RLS. skill-files bucket is private, 102400-byte bound. Browser roles cannot execute mutation RPCs. RPCs use SECURITY INVOKER/fixed search path and minimum service-role table grants.
- Security advisor: only informational rls_enabled_no_policy for skill_files, intentional because client access is prohibited. Performance advisor: unused indexes on the new empty tables; retained for queries/FKs. No security warnings/errors reported.
- marketplace Edge Function initially deployed ACTIVE version 1, id 4fd9d98d-ee8c-4eb8-8f83-c3a8c8af1d86, then redeployed through dashboard Code → Deploy updates on 8 October for the nested Web3 identity fix. Reloaded deployed _shared/validation.js and verified its entire source matches the local file. Legacy JWT verification remains OFF; handler checks private requests with auth.getUser(token). Localhost origins default to 5173/4174. MCP payload packages handler/shared files under the function root; local sources retain standard sibling _shared layout.
- Public .env.local written (gitignored) with enabled publishable key and project URL; production build rebuilt. No service-role key/database password/private wallet key was read or saved.
- Signed-in in-app dashboard is user-owned tab 3. Solana Web3 enabled and saved in provider UI; Ethereum remains disabled. Email disabled and verified via public Auth settings. Anonymous sign-in remains disabled.
- Authentication URL configuration saved and verified: Site URL http://localhost:5173; four redirects allow both localhost:5173 and localhost:4174 roots and /** paths. Screenshot: screenshots/supabase-login-urls.jpg.
- User supplied their public Phantom receive address and requested continuation. ADMIN_WALLET_ADDRESS saved in hosted Edge Function secrets, verified by matching its SHA-256 digest to the supplied address. Public configuration also saved in gitignored supabase/.env.local. Screenshot: screenshots/supabase-admin-config.jpg. No credential was requested/read. Live admin authorization still needs the user's signed Phantom session.
- Supabase MCP tools were removed from the active tool catalog during this turn; the signed-in dashboard remains accessible. Configuration continued through documented browser UI.

## Actually verified

- Unit: 24/24 passed, including real local Postgres/RLS, writes as service_role, immutable files, payment mismatch/replay/idempotency and backend authorization. Repassed after migration rename.
- Browser: 66 unique current checks passed across full/targeted runs (all 51 original homepage/animation checks, eight MVP checks and seven sample checks). One obsolete assertion was corrected and rerun. Synthetic integration expanded to 9/9 passed: full Phantom confirmation → actual SDK → token exchange → server me with nested Web3 identity, listing/detail, payment retry/download, submission/admin, token refresh during signing, sign-out during verification, and loading exact demo bytes without auto consent/upload. Fixed same-wallet token refresh so it preserves account/token/order during payment; true sign-out clears private UI and late verification cannot display another account's entitlement. Active order captured across awaits.
- Production build, Deno entry check, Cloudflare dry run and original Chromium production smoke passed. Build and production smoke passed again after session-refresh fix; smoke now uses the configured localhost origin. Existing Three.js chunk advisory remains. Desktop/mobile screenshots inspected. No backend secret names/mutation functions/test tokens in the browser assets. Both local env files confirmed gitignored.
- **Actual live HTTP smoke** passed using public credentials: approved listing read returns empty array; logged-out private actions return 401; unknown origin returns 403; raw private tables/storage and mutation RPC are inaccessible to anonymous callers. Script: tests/live-supabase-smoke.mjs.
- Rebuilt production marketplace at http://localhost:4174/marketplace verified in browser: live request resolves to 0 skills, no setup-incomplete error, no console errors. Screenshot: screenshots/live-marketplace-ready.jpg. Live HTTP smoke passed again after URL setup (network access required outside the restricted shell sandbox).
- User reported Phantom Confirm returning to Connect wallet. Live Auth logs proved successful /token (200), grant_type web3, and the correct public wallet. Root cause: app read identity_data.chain/address, but hosted Supabase stores identity_data.custom_claims.chain/address. Shared validator corrected in browser and deployed backend, retaining flat identity compatibility and rejecting editable user_metadata. Unit security assertions now cover nested claims, wrong provider/network, duplicate identity and metadata spoofing. 24 unit tests and 8 integration tests passed; production rebuilt and live anonymous-access smoke passed after deploy.
- Real Phantom signature and Supabase Auth login are verified by server logs. Post-fix marketplace profile/admin session still awaits user reload confirmation. Creator upload/review, two-wallet transfer/purchase/download and agent reuse are **not yet verified**. No approved listings or purchases exist yet. No actual wallet transfer has been attempted.
- User acknowledged the fix and asked for the next step. Rebuilt demo helper; browser verified actual local metadata/file load, consent remains unchecked, Submit disabled while guest. Root's in-app tab 5 is separate from the user's Phantom browser and has no signed-in session; user must submit in their connected browser. Screenshot: screenshots/demo-submission-helper.jpg.

## Commands and configuration

- npm ci; npm run dev (open http://localhost:5173 for wallet auth); npm run build; npm run preview -- --port 4174 --strictPort.
- npm run test:unit; npm test (isolated port 5175); npm run test:integration (synthetic session/API on 5176); node tests/live-supabase-smoke.mjs; npm run deploy:check.
- Backend: supabase/functions/marketplace/index.ts and handler.js; shared validation/payment JS beside it. SQL: supabase/migrations/20261007191453_marketplace.sql.
- Env names only: frontend VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, optional VITE_SOLANA_DEVNET_RPC_URL; function ADMIN_WALLET_ADDRESS, ALLOWED_ORIGINS, optional SOLANA_DEVNET_RPC_URL. Hosted function receives SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY automatically. Never put server secrets in VITE_ vars.
- All repository files were untracked at task start. Initial reviewed source snapshot is now committed locally; preserve existing work.

## GitHub handoff

- User requested a GitHub push on 8 October. Initial commit **6d49385** created on the existing master branch: 64 source/test/migration/example/documentation files. User subsequently selected the public repository **firstnamedarshan/usere** and explicitly authorized pushing all project code there.
- .gitignore excludes local environment files, dependencies, builds, test artifacts, and the entire generated screenshots directory. Files remain available locally. Staged secret-format review found only synthetic test fixtures; git diff --cached --check passed after two whitespace-only test-file cleanups. Unrelated project details and the live Auth user identifier were removed from this document before committing. No runtime code change or new test run was needed for this push preparation.
- GitHub publication does not deploy the website or complete the outstanding live marketplace/agent-drafting milestones. Record the actual remote and commit result after a successful push.
- GitHub connector authenticates as `firstnamedarshan`. Initial repository listings were empty, but direct access to the supplied repository succeeded and confirmed public visibility and push permission. Branch lookup and native git ls-remote both confirmed the destination is empty. Source publication is being prepared for remote main; final push result will be recorded after verification.
- Tracked-file credential review found only the literal private-key header used by a rejection test, with no key material. Only placeholder .env.example files are tracked; both local environment files, screenshots, dependencies and builds are ignored. No local environment files appear in commit history.
- Local production build passed again during GitHub inspection. The first sandboxed run failed with Windows `EPERM` resolving styles.css; the same build passed outside the restricted sandbox. Existing Three.js chunk-size advisory remains. This verifies the local build only; no live wallet/payment checks were repeated.

## Next concrete tasks

1. User opens http://localhost:4174/submit in the connected Phantom browser, Ctrl+Shift+R, clicks Use tested demo draft, reads fields/file, confirms sharing rights, Preview skill, Submit skill. Confirm actual pending result or capture error. No new wallet/funds needed for this step.
2. Configured admin opens /admin, reviews exact content and approves. Second distinct wallet obtains free Devnet faucet funds, pays, retries finalized verification, downloads its reviewed version, and applies it to synthetic records. README now has the concrete first live demo journey.
3. Record real IDs/signatures/results and remaining limitations. The real purchase/download journey is the gate before agent integration. No paid plan, real SOL, token or public frontend deployment without explicit authorization.
4. After that gate passes, verify current official integration support and select one agent client. Implement milestone 5: local automatic drafting after a useful task, Drafts from your agent review/edit/price/explicit submission, honest evidence, and checks proving no upload before approval. Preserve manual upload and admin review. Record actual client/setup/results here and in README.md; this is required MVP work, not deferred scope.
