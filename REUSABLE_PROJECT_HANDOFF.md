# Reusable Network — project context and MVP execution brief

Prepared October 7, 2026. Original target: a working Devnet demo by October 8, 2026, India time. Treat this as a scope target, not permission to skip payment or access checks. If that date has passed, continue from the actual repository state.

**Scope updated October 8, 2026:** automatic skill drafting for one agent client is now part of the MVP. This supersedes the earlier decision to defer all automatic drafting. Keep the existing marketplace work and finish its purchase/download acceptance journey first, then implement the agent integration. Draft creation stays local; uploading requires the creator's explicit review and approval. Manual upload remains available.

## 1. Your assignment

You are my coding agent working inside the existing Reusable Network repository. Read this entire document, inspect the local project, and implement the next unfinished milestone. Continue through the MVP milestones in order, verifying each meaningful step. Do not stop after producing a plan. Do not ask me to send the project ZIP to another chat.

The latest local code and my subsequent instructions take precedence over the historical snapshot in this document. Read applicable AGENTS.md instructions first. Preserve unrelated changes. Never overwrite working features merely to match a suggested folder layout.

I am a beginner, have a small budget, and use one coding agent at a time. I need readable code that I can explain in an interview. Make routine implementation decisions yourself. Ask only when an essential credential, account action, consequential product choice, or required authorization is missing. Group necessary setup questions into one short checklist; continue all independent work while waiting. Do not deploy publicly, spend real funds, or launch a token solely because this brief mentions those eventual goals.

## 2. Product and audience

- Product: **Reusable Network**.
- Domain already purchased: **reusable.network**.
- Intended future token name/ticker: **REUSE / $REUSE**.
- Initial audience: developers and agent users working with Solana and Web3.
- Product: a marketplace for reusable AI-agent skills. A creator packages useful instructions from a successful workflow; another user buys that skill and gives it to their own agent.
- Value proposition: creators can sell useful work; buyers get a tested starting point for a specific task.
- The product is broader than research. Examples include organizing Solana transfer data, understanding common transaction errors, and following a documented developer integration workflow.
- A skill is an instruction package, not a trained model, guaranteed answer, or proof that an agent learned something autonomously.
- Drafting, uploading, and approval do not create earnings. A creator earns only when another user purchases the skill. This Devnet MVP transfers test SOL only, with no real earnings.

Use original application code. Auxilo and EvoMap were inspiration during discussion, not codebases to fork. Ordinary open-source dependencies with compatible licenses are fine. Do not claim this product invented agent skills or guarantees income.

## 3. Settled decisions — do not reopen these without a concrete blocker

1. Keep the existing **Vite + plain JavaScript + CSS + Three.js** project.
2. Preserve the existing 3D homepage, Sell/Buy toggle, scroll story, typography, colors, and responsive behavior.
3. **Do not migrate to Next.js, React, TypeScript, or Tailwind for this MVP.** An earlier plan used these; it was explicitly superseded to avoid losing time and preserve the existing work.
4. Use **Supabase** for authentication, Postgres, private file storage, and small server-side functions.
5. Target **Cloudflare Workers with Static Assets** for frontend hosting. Verify current official deployment instructions when implementing. Do not introduce a second backend platform unnecessarily.
6. Wallet-only sign-in. Start with Phantom on Solana Devnet. No email/password flow.
7. Anyone with a verified wallet session may submit a skill. A small admin approval step controls public publication.
8. MVP uploads are **one UTF-8 Markdown file named SKILL.md**, not ZIPs, executables, or arbitrary agent logs.
9. MVP payments use **Devnet SOL**. No real funds and no custom smart contract.
10. Token launch and $REUSE checkout are later work. Do not create fake REUSE balances, invented mint addresses, staking, rewards, or tokenomics.
11. Finish manual upload, purchase, and download first. Then complete the MVP with automatic local skill drafting for one agent client and a creator review/submission flow. Keep manual upload as a fallback. Do not replace the working marketplace or start this integration before the purchase/download journey passes.

Keep product branding as Reusable Network. Solana is the underlying network, SOL is the first payment asset, and REUSE is the planned token. A pump.fun launch does not itself integrate a token into the marketplace.

## 4. Historical code snapshot — inspect before assuming this is current

The reviewed ZIP was named `threejs-source.zip`. At that point:

- `index.html`: homepage markup, example skill cards, modal dialogs.
- `main.js`: Sell/Buy toggle, example dialogs, lazy loading the 3D scene.
- `scene.js`: substantial procedural Three.js animation implementation.
- `story.js`: scroll-story coordination.
- `styles.css`: existing visual system and responsive styling.
- `skills.js`: three hardcoded illustrative examples.
- `tests/`: Playwright tests for homepage behavior and visual/animation regressions.
- `README.md`, `HANDOFF.md`, `VERIFICATION.md`: previous frontend documentation.
- Fonts: Manrope through `@fontsource/manrope`.
- Dependencies then included Three.js 0.180.0, Vite 7.3.7, Playwright 1.63.0.
- A fresh dependency install and production build passed during review. That review did not verify live-browser animation smoothness.

At that point Connect Wallet only opened an explanation. Sell opened a preview dialog. Buy scrolled to sample cards. No real wallet login, uploads, database, checkout, or connector existed. This may have changed: inspect local files and test before calling anything missing.

Existing 3D safeguards include lazy loading, reduced-motion/static fallbacks, scroll coordination, and disposal behavior. Preserve these. Do not add more visual features to the homepage while the transactional flow is unfinished.

## 5. The smallest complete product

The acceptance journey is:

1. Creator connects a Devnet wallet and signs in.
2. Creator submits a useful SKILL.md with listing information.
3. Creator sees its pending status. Admin reviews the exact file and approves it.
4. Another user browses the listing and understands its inputs, output, requirements, and limits.
5. Buyer signs in and pays the displayed price in Devnet SOL.
6. Backend independently verifies the on-chain transaction and records ownership.
7. Buyer downloads the purchased version of SKILL.md from private storage.
8. Buyer gives that file to a compatible existing agent and demonstrates the task using safe sample data.

The website does not need to run an LLM, train an agent, read private conversation history, or execute uploaded instructions. No paid model API is required for the core marketplace.

After this marketplace journey passes, verify the added drafting journey: a supported existing agent prepares a local reusable draft after a useful task; the creator reviews and edits it in **Drafts from your agent**, sets a price, and explicitly submits it to the existing pending-review flow. Creation or editing of a draft must produce no remote upload.

## 6. Pages and interface

Use the existing white/navy/pastel design, Manrope font, generous spacing, and consistent button styles. Marketplace pages should be straightforward and lightweight. Use simple multi-page Vite entries or another small routing solution appropriate to the actual repo; do not add a framework just for routes. Ensure direct navigation and refresh work on deployed URLs.

### Homepage `/`

Preserve its design and animation. Wire existing navigation into the real pages.

- Sell H1: **Sell what your agent learned.**
- Sell supporting copy: **Turn useful workflows into reusable skills. Get paid when they sell.**
- Sell CTA: **Sell** → submission page; require login when needed.
- Buy H1: **Buy what other agents learned.**
- Buy supporting copy: **Find a skill for your next task. Give your agent a head start.**
- Buy CTA: **Buy** → marketplace.
- Connect wallet must reflect actual connection and authentication states.
- Show a clear **Devnet demo — test SOL only** notice throughout payment-related flows.
- Do not promise $REUSE earnings until that integration actually works.

### Marketplace `/marketplace`

Approved listings only. Cards show title, short description, category, and price labeled Devnet SOL. Add basic title/description search and category filtering. Use a few categories such as Solana data, transaction debugging, and developer tools. Include loading, empty, and error states. No complex ranking, infinite scroll, ratings, or fake sales counters.

### Skill details

Use a clean slug route if straightforward, or `/skill?id=...` for speed. Include purpose, example input/output, requirements, limitations, creator wallet, version, reuse terms, and price. Public examples must be separate from the full paid file. Show Buy, purchasing state, pending confirmation, retry verification, and Download/Already owned as appropriate. A wallet rejection is not a successful purchase.

### Submission `/submit`

Fields: title, short description, category, price, expected input/output, requirements, limitations, reuse terms, and one SKILL.md file. Defaults may simplify optional fields. Suggested maximum file size: 100 KB, enforced server-side too. Use a fixed maximum price and text lengths documented in validation code.

Show the exact file in a safe plain-text preview. Require the creator to confirm they have permission to share/sell it and removed private information. Submit to pending review, not immediate public publication. Clearly explain that submitting is not a sale and the Devnet demo earns no real money.

### Account `/account`

Keep My skills (pending/approved/rejected, with review reason) and My purchases (download purchased version). Add **Drafts from your agent** in the agent-integration milestone. Creators can review and edit the complete local SKILL.md and listing fields, set a price, discard a draft, and explicitly submit for publication. Submission uses the existing sharing confirmation and pending admin review; it does not publish immediately. Clearly distinguish local drafts from uploaded submissions. Avoid an elaborate dashboard.

### Admin `/admin`

Small pending-review list with metadata, full safe text preview, approve, and reject with reason. Admin authorization must be enforced in the backend, never merely hidden in the UI. Use an explicitly configured admin identity; never make the first visitor admin automatically.

## 7. Collecting a skill without collecting private history

The MVP includes automatic local drafting through one agent client, implemented after the marketplace purchase/download gate. After a useful task, the user's existing agent should prepare a standalone reusable SKILL.md from the selected workflow: instructions, requirements, inputs and expected output, a synthetic example, limitations, and available evidence that it worked. Evidence must describe checks actually performed and their results; label missing or incomplete verification honestly. Use sanitized summaries or synthetic results, not raw conversations or project files.

Keep the draft on the user's device until the creator reviews its complete contents and explicitly approves uploading it. The **Drafts from your agent** section must allow review, editing, pricing, and explicit submission through the existing marketplace rules. Automatic drafting is not authorization to upload or publish. Never automatically upload raw conversations, project files, or credentials. Do not send local drafts to Supabase, analytics, or a screening model before upload approval.

Keep manual creation/export and one-file upload as a fallback. Provide a copyable prompt in the submission form:

> Create a standalone SKILL.md for the useful workflow I choose. Describe its purpose, when to use it, required tools, inputs, clear steps, expected output, a synthetic example, and limitations. Include available evidence of checks we actually performed and state anything unverified. Use placeholders for credentials and environment-specific values. Do not include chat logs, seed phrases, private keys, API tokens, personal data, private URLs, proprietary material I cannot share, or unrelated files. Keep the complete draft local and show it to me for review before I approve any upload. Do not claim the workflow is tested unless we actually tested it.

Suggested file structure: title, purpose, prerequisites, input, steps, output, synthetic example, verification evidence, limitations. Accept readable Markdown without implementing a complicated parser or mandatory packaging standard.

Add basic local checks for common credential patterns before upload and equivalent backend rejection for obvious secrets. Do not claim these detect every secret or guarantee privacy. Restrict previews to text or use properly sanitized Markdown; do not inject raw HTML. Explain to the reviewer that uploaded instructions are untrusted. The website must never execute them.

No background log reading, automatic folder scanning, local daemon, or automatic upload in this release. The selected agent can draft from its current useful task without harvesting unrelated history or files. Do not send uploaded files to a third-party model for screening. Keep full file contents out of ordinary request logs and analytics.

## 8. Backend and data rules

Use a small, explicit schema with SQL migrations. A reasonable starting point:

- Profiles: authenticated user ID and verified Solana wallet address.
- Skills: creator, public listing fields, integer lamport price, review status, version, timestamps.
- Private skill files: skill/version, storage path and content hash; protected from public reads.
- Orders: buyer, skill/version, server-generated reference, snapshotted recipient/amount/network, creation/expiry, status, unique transaction signature when verified.
- Purchases: buyer, skill/version, verified order, timestamp; enforce one entitlement per buyer/version.

Adapt names to existing code; keep the design small. Do not allow edits to an approved file in place: a purchase must keep referring to the exact reviewed version. For MVP, freeze approved listings and files; version editing can wait.

Enable row-level security on exposed tables and private storage. Public visitors can read only approved public metadata. Creators can access their own submissions. Buyers can see their own purchases. Clients cannot approve listings, set admin roles, change payment snapshots, or create paid entitlements directly.

Keep service-role credentials and private backend configuration server-side. Vite's public environment variables are bundled into the browser; no secrets belong there. Public Supabase URL and publishable/anon key are allowed only with properly configured authorization policies.

Download endpoint: validate the session and entitlement, look up the exact purchased file, return a short-lived signed URL or stream it. Do not accept an arbitrary storage path supplied by the client. Direct unpaid access must fail. A downloaded file can be copied; do not claim DRM or guaranteed prevention of resale.

### Wallet authentication

Prefer Supabase's officially supported Solana Web3 sign-in if available in the selected SDK/version; verify the current official documentation. Connecting Phantom is not authentication. Require a wallet signature and a backend-validated session. Do not invent a custom authentication scheme to save a few lines. Never ask for a seed phrase or private key. Invalidate account-specific UI when the wallet/session changes.

## 9. Devnet payment design

Use wallet-approved direct SOL transfer to the creator for this MVP. No platform fee, custody, escrow, automated payouts, or custom on-chain program. Seller earnings here are test SOL only.

Implement the simplest reliable order flow:

1. Authenticated buyer requests an order for a skill ID.
2. Server loads the approved listing and creates a payment intent with a unique reference, buyer wallet, recipient wallet, exact integer lamports, skill version, Devnet network, and bounded expiry. Never trust price or recipient from browser input.
3. Browser builds the intended Devnet transaction using that order, with an on-chain order reference such as a memo, and asks the buyer's wallet to sign/send. Use a current official Solana SDK with the smallest appropriate dependency surface.
4. Client submits order ID and signature for verification. The server fetches the transaction from its configured Devnet RPC and independently verifies it.
5. Verify transaction success and the required commitment, expected buyer signer, matching order reference, native SOL transfer source/destination/lamports, and order validity. Reject failed, wrong-network, unrelated, malformed, or mismatched transactions. Use a simple supported transaction format; reject unsupported cases rather than guess.
6. Store verification and grant entitlement atomically. Enforce a database uniqueness constraint for used signatures and idempotency for repeated verification of the same order. One transaction cannot unlock unrelated orders or another buyer's purchase.
7. If confirmation is slow or the response is lost, preserve the order/signature and offer Check payment again. Do not ask the user to pay again just because one network request timed out. The server should safely recheck existing pending orders; resolve expiry using documented on-chain timing rules so a valid payment isn't discarded just because verification was delayed.

Use integer lamports for all payment comparisons; avoid floating-point amounts. Explain the skill price separately from network fees. Handle insufficient balance, wallet cancellation, expired order, RPC outage, and pending finality clearly. Do not label an order paid from a client-side success callback alone.

Provide a manual recovery note for unresolved payments. A real-money release will need further operational review; completing Devnet tests does not automatically make mainnet checkout production-ready.

## 10. Agent drafting integration and future $REUSE payments

### Later: REUSE payments

No token launch is authorized by this document. Once I explicitly ask for it and supply the verified mint, inspect the actual token program, decimals, network, and transfer behavior. Implement token-aware verification and recipient token accounts then. Do not silently reinterpret SOL amounts as REUSE amounts. Keep payment asset and mint unambiguous in the data model without building a generic multichain engine now.

### In this MVP: one agent client and local drafts

After the complete marketplace purchase/download journey passes, integrate one supported agent client first. Verify its current official integration documentation and record the selected client and setup in README.md and PROJECT_STATUS.md. Use the user's existing agent for drafting; do not add a hosted model API or a general agent runtime. Implement the smallest supported local handoff into **Drafts from your agent** without a background scanner or remote draft staging.

The agent prepares a draft after a useful task; it must contain reusable instructions, requirements, a synthetic example, and honest available evidence. Local review and edits come before explicit upload approval. Approval sends only the reviewed SKILL.md and listing fields to the existing submission endpoint. Admin publication remains a separate review. Keep manual upload usable when the integration is unavailable. Earnings happen only when another user purchases, and Devnet payments are test funds.

### Optional retrieval tools for the same client

If MCP is the appropriate supported integration, use the official MCP SDK and current docs. The existing desired marketplace retrieval tools are `search_skills`, `get_skill_details`, `get_owned_skill`; do not let a broader connector delay the required local drafting/review flow.

Public search returns approved metadata. Paid content requires a scoped, revocable token associated with the user and checked against ownership on every retrieval. Tokens grant read access only, no spending or admin permissions. Hash stored tokens, display the secret only when issued, and avoid logging it. Purchase approval stays in the website/wallet.

No general agent runtime, automatic spending, background harvesting, arbitrary local execution, or support for every agent framework. Demonstrate the agent actually following one purchased skill; retrieval alone is not evidence of successful reuse.

## 11. Build order and completion gates

### Milestone 0 — inspect and preserve

Read package.json, entry points, existing docs, tests, and actual git state. Run the existing build. Identify what is already implemented. Preserve the homepage and isolate new marketplace code from the 3D modules. Keep changes reversible. If using git, do not discard unrelated modifications or commit secrets.

### Milestone 1 — usable frontend pages

Build marketplace, details, submission, and account layouts. Wire homepage links. Match existing design. Clearly mark sample data and simulated states; no fake successful purchases. Build and check navigation, forms, responsive layouts, and homepage regressions.

### Milestone 2 — real listings and authentication

Implement SQL migrations, private storage policies, wallet sign-in, submission, admin review, and real listing reads. Create setup documentation and .env.example with placeholders. If credentials are unavailable, finish all code/migrations and document the exact blocking setup actions. Do not silently fall back to mock mode in a deployed app.

### Milestone 3 — real Devnet checkout and download

Implement server-created orders, wallet payment, backend verification, ownership, and protected download. Test with two distinct wallets and one genuinely useful skill. Use the official Solana faucet for free Devnet funds; never buy real SOL to fund this test.

### Milestone 4 — demonstration and deployment preparation

Prepare Cloudflare static deployment configuration, direct-route behavior, server function setup, and allowed origins. Verify current official docs instead of assuming old commands still apply. Keep live credentials out of the repo. Record exact setup/deploy commands. If publishing is explicitly authorized and access is available, deploy and smoke-test the real environment; otherwise leave a deploy-ready build with a short action list.

Do not stop at a UI milestone if the remaining work is authorized and unblocked. Do not add the connector before the core journey passes. A user-facing blocker should name exactly what is needed and what work is already complete.

### Milestone 5 — automatic local drafting for one agent client

Implement the selected-client integration and **Drafts from your agent** after the real purchase/download journey passes. Demonstrate a useful task producing a local reusable SKILL.md with instructions, requirements, synthetic input/output, and truthful evidence. Demonstrate local review/editing, setting a price, explicit upload approval, and submission to pending admin review. Verify no automatic upload during draft creation, import, editing, or discard. Keep manual upload working. This milestone is now required for MVP completion; it is not deferred future scope.

## 12. Meaningful verification

Prioritize access and payment correctness over broad cosmetic testing:

- Existing production build and relevant homepage tests still pass.
- Marketplace links, direct URLs, refresh, keyboard use, phone layouts, and error states work.
- Invalid/oversized uploads fail; raw HTML does not execute in previews.
- Logged-out users and other creators cannot read pending/private files.
- Non-admin users cannot approve listings or alter entitlements.
- Unpaid users cannot download even if they know a file ID/path.
- Wrong recipient, amount, buyer, order reference, failed transaction, and wrong network do not unlock a file.
- Replaying a transaction for another order fails; retrying the same successful verification is safe.
- Wallet rejection creates no purchase; successful payment survives a retry without a second charge.
- Two-wallet end-to-end test grants only the buyer access to the purchased version.
- One supported agent client produces a local draft after a useful task, with requirements, synthetic examples, and evidence distinguished from unverified claims.
- Draft creation/import/editing/discard cause no upload; only explicit approval sends the reviewed file and listing fields. Raw conversations, project files, and credentials are not automatically uploaded.
- Creators can review/edit/set a price and submit agent drafts for pending review; manual upload remains usable without the integration. No earnings appear from drafting or submission.
- No backend secret appears in the production browser bundle.

Use focused automated tests where meaningful and one real Devnet end-to-end check when accounts/network access are available. Mocked tests are not a substitute for the real chain check. Report what actually ran, what passed, and what remains unverified. Do not copy historical verification claims as new results.

## 13. Coding style and budget

- Straightforward JavaScript functions, descriptive names, explicit conditionals, and readable loops.
- Prefer ten understandable lines over two clever lines.
- Small modules organized by purpose: auth, listings, submissions, checkout, downloads.
- Comments should explain decisions and security boundaries, not narrate every line.
- Keep CSS scoped so new pages do not accidentally change the homepage.
- Add only dependencies that solve a real current need. Keep the lockfile.
- No state-management framework, microservices, queue, vector database, embeddings, or custom design system.
- No paid APIs for the core product. Use Supabase/Cloudflare free tiers within current limits; ask before enabling paid plans or services.
- Do not ask me to choose routine filenames, libraries, button spacing, or folder organization.
- Browser Wallet UI may require my interaction. Give precise short steps when it does.

## 14. Seed content and scope exclusions

Prepare 1–3 genuine example skills with synthetic sample inputs and verified outputs. Start with one narrow Solana-data workflow that transforms supplied transfer records into a consistent CSV. State supported input shape and limitations; it need not crawl every wallet's complete history. Mark examples as demo listings. Never invent users, sales, testimonials, audit results, or success rates.

Automatic local drafting for one client and creator review/submission are in MVP scope after checkout/download acceptance. Out of scope for the first MVP: own-token launch, mainnet payments, staking, rewards, automatic token purchases, ratings/reviews, chat, social profiles, subscriptions, refunds/escrow automation, AI skill scoring, private-log extraction, automatic execution of uploaded skills, automatic upload/publication, ZIP packages, and broad agent compatibility.

## 15. Maintain continuity inside this repository

Create or update `PROJECT_STATUS.md` after each meaningful milestone and before ending a session. Keep it concise with:

- Date and current milestone.
- Implemented and actually verified functionality.
- Key files and commands.
- Database migration/deployment state.
- Tests run and results.
- Required environment variable names only, never secret values.
- Exact blockers and user setup actions.
- Next concrete task.

Update the existing README instead of producing contradictory setup guides. Include a short plain-language explanation of the frontend, backend, database, authentication, and payment flow that I can use to understand the codebase.

If permitted by existing repo instructions, add a short reference to this brief and PROJECT_STATUS.md in AGENTS.md without deleting or overriding existing instructions. This gives future sessions a reliable entry point.

Start now: inspect the local repository, briefly tell me which milestone is next, and implement it. Keep moving through unblocked milestones. When account access is the only blocker, show one concise setup checklist and clearly distinguish finished code from unverified integrations.
