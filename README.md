# Reusable Network

A Solana Devnet skill marketplace built with the existing Vite, plain JavaScript, CSS and Three.js homepage. Read REUSABLE_PROJECT_HANDOFF.md completely, then PROJECT_STATUS.md for the current verified state and next task.

## How the pieces work

The browser displays listings and asks Phantom to sign in or approve a test SOL transfer. Supabase Auth validates the signed Solana login and issues a session. One Supabase Edge Function checks that session for every private operation. Postgres stores listings, immutable file versions, orders and purchases; row-level security prevents browser writes or private reads. SKILL.md lives in a private Storage bucket. The function independently reads finalized Devnet transactions, checks the order memo, signer, recipient and exact lamports, and atomically records ownership. Downloads use the exact purchased version and a 60-second signed URL. The website never executes uploaded instructions or calls an LLM.

Database mutation functions use `SECURITY INVOKER`, have a fixed empty search path, and are executable only by the backend service role. That role has only the table read/insert/update permissions needed for the flow; no delete permissions on marketplace tables. Authentication and admin authorization remain in the Edge Function.

Verified wallet identity comes from Supabase's `web3` identity `identity_data.custom_claims.chain/address` (with flat identity compatibility), never editable `user_metadata`. Your existing Phantom account can sign in without SOL; free Devnet funds are needed only when buying. If the website was open during a rebuild, reload it before retrying so it loads the current authentication code.

The homepage retains its Sell/Buy toggle, shared lazy renderer, scroll story, static/reduced-motion fallbacks and disposal behavior. New pages never import scene.js or story.js. Sell opens `/submit`; Buy opens `/marketplace`. `/examples` preserves the former illustrative marketplace separately. A missing or failed backend shows an explicit error; live listings never silently become sample data.

## Updated MVP scope — 8 October 2026

Automatic skill drafting is now required MVP work, replacing the earlier decision to defer it. Finish the live creator submission/admin approval and two-wallet purchase/download journey first, then integrate one supported agent client. This integration is **not yet implemented**; the current **Use tested demo draft** button only loads a fixed open sample locally.

After a useful task, the user's existing agent will prepare a reusable SKILL.md with instructions, requirements, a synthetic example, and available evidence from checks actually performed. The draft stays on the user's device until reviewed and explicitly approved for upload. The website does not need a hosted model API to generate it.

Add **Drafts from your agent** for creators to review and edit the complete draft/listing fields, set a price, discard it, and explicitly submit through existing sharing consent and pending admin review. No automatic upload of raw conversations, project files, or credentials. Keep manual file upload as a fallback. Drafting and submission do not create earnings; another user's purchase is required, and this Devnet demo transfers test SOL only.

## Run locally

Use Node.js 22.20+ and npm:

```powershell
npm ci
npm run dev
```

Open **http://localhost:5173** for wallet authentication. Supabase's Solana sign-in permits HTTP localhost; use HTTPS elsewhere. The project's old `127.0.0.1` URL still works for visual development but is not the supported HTTP wallet sign-in origin. Development and preview both support direct route navigation and refresh.

Without Supabase configuration, the homepage, examples and local submission preview work. Authentication, uploading and checkout remain unavailable. No simulated purchase succeeds.

```powershell
npm run build
npm run preview -- --port 4174 --strictPort
```

Open http://localhost:4174. Vite has the existing 500 KB advisory for the lazy Three.js bundle; the production build still succeeds.

## Free Supabase setup, step by step

1. Sign in at [Supabase Dashboard](https://supabase.com/dashboard). Create a **free** project named Reusable Network in your chosen organization. Generate a database password and save it privately. Mumbai (`ap-south-1`) is suitable for India. Do not upgrade a plan for this demo.
2. Under **Authentication → Sign In / Providers**, enable **Web3 → Solana**. Disable email/password signup for this wallet-only demo. Set Site URL to `http://localhost:5173`. Add `http://localhost:5173/**` and `http://localhost:4174/**` under Redirect URLs. Add the exact HTTPS site domain and `https://your-domain/**` when hosting. The domain root must be allowed too.
3. Under **Project settings → API** (or Connect), obtain the project URL and the public **publishable** key. A legacy anon key also works. Copy `.env.example` to `.env.local` and replace those two placeholders. Restart Vite. Only public keys belong in VITE_ variables.
4. Apply `supabase/migrations/20261007191453_marketplace.sql` once via the dashboard SQL Editor or the connected Supabase integration. This creates five tables, RLS, service-only mutation functions, freeze triggers and the private `skill-files` bucket. It is a migration for a new project, not an idempotent script to run repeatedly.
5. Choose one Phantom public address for admin review. In Phantom select **Receive → Solana → Copy address**. Every wallet has a public receive address; a new wallet is optional. Copy `supabase/.env.example` to `supabase/.env.local`, replace `ADMIN_WALLET_ADDRESS`, and set `ALLOWED_ORIGINS` to the comma-separated exact frontend origins. The function defaults to local development/preview origins (`http://localhost:5173` and `http://localhost:4174`) and keeps admin review disabled until an admin address is explicitly configured. This file contains nonsecret function configuration; Supabase supplies its service-role key server-side. Never send seed phrases, private keys, database passwords or service-role keys in chat.
6. Deploy the `marketplace` function with the connected integration or the CLI commands below. The entry is a tiny conventional Supabase Deno `index.ts`; application/frontend code remains JavaScript. The handler, validation and verifier are testable JavaScript.
7. In Phantom enable test networks and select **Solana Devnet**. Use two distinct wallets for creator and buyer. Get free test funds from the [official Solana faucet](https://faucet.solana.com). Do not buy real SOL. Wallet login proves ownership but does not by itself select the payment network; checkout explicitly enforces Devnet on both browser and server RPCs.

If using the CLI, its login requires your own account interaction:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy marketplace --no-verify-jwt --use-api
```

Use **either** SQL Editor/integration **or** `db push` for the initial schema; do not apply the same migration twice. If migrating with another tool, first reconcile the migration history before using `db push` later. `--use-api` bundles the function server-side without Docker. `--no-verify-jwt` is intentional: the function checks private requests with `auth.getUser(token)`, supporting current Supabase signing keys, while public listing requests require no session. It never trusts decoded JWT claims or user-editable metadata. Admin authority comes only from the configured wallet and the validated Web3 identity. Run Supabase's security advisors after applying the schema, and resolve findings before the live acceptance test.

For CLI local development, install Docker and run `npx supabase start`, then `npx supabase functions serve marketplace --env-file supabase/.env.local --no-verify-jwt`. Do not install Docker merely to run the frontend or unit tests. Local database tests use PGlite without a server.

Official references checked during implementation: [Supabase Web3 auth](https://supabase.com/docs/guides/auth/auth-web3), [signInWithWeb3](https://supabase.com/docs/reference/javascript/auth-signinwithweb3), [Solana JavaScript SDK](https://solana.com/docs/frontend/client), [getTransaction](https://solana.com/docs/rpc/http/gettransaction), and [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/).

## Pages and limits

| Route | Behavior |
| --- | --- |
| `/` | Existing 3D homepage, real wallet button, Sell/Buy navigation |
| `/marketplace` | Approved listings from the backend, search and category filters; up to 250 newest listings for this demo |
| `/skill?id=UUID` | Public purpose, examples, requirements, limits, terms and price; ownership, checkout, retries and downloads |
| `/submit` | Full local file preview, public metadata, sharing consent and pending submission |
| `/account` | Own submission status/rejection reason, purchased files and saved pending payment references |
| `/admin` | Configured admin only; exact text/hash preview, approve or reject with reason |
| `/examples` | Explicitly illustrative old sample marketplace; purchase disabled |

One nonempty UTF-8 Markdown file named `SKILL.md`, maximum **100 KB**. No ZIP or executable upload. Basic secret-pattern checks run in browser and server; they cannot detect all private information. Previews use literal text. Reviewers must treat uploaded instructions as untrusted.

Price is **1 lamport through 10 Devnet SOL**, up to nine decimal places, parsed into an integer without floating-point multiplication. Title: 100 characters; description: 600; inputs, outputs, requirements and limitations: 2,000 each; reuse terms/rejection reason: 1,000. Categories and bounds live in `supabase/functions/_shared/validation.js` and SQL constraints. Maximum 20 submissions per account per day. Approval freezes metadata and the file; version editing is deferred. Creators can retrieve their own submissions through the protected endpoint. Buyers retrieve only their purchased version.

Public examples are listing metadata, separate from the full private file. A copyable drafting prompt is in the submission form. The open demo skill at `public/demo/transfer-records/SKILL.md` transforms a defined supplied transfer-record shape to CSV. Its synthetic fixture, exact expected output and reference converter are in `examples/transfer-records/`; unit tests verify those outputs. This open file is intentionally public and is not a leaked paid upload.

## First live demo journey

Use the browser where Phantom is connected. Reload http://localhost:4174/submit after a rebuild, then click **Use tested demo draft**. It loads the existing open `SKILL.md` and all listing fields at **0.01 Devnet SOL** locally. Read the file and fields, check the sharing confirmation, click **Preview skill**, then **Submit skill**. Account should show **pending**. Loading the draft never uploads or publishes it.

With the configured admin wallet, open http://localhost:4174/admin, choose **Review exact file**, read the metadata/file, check the review confirmation, and click **Approve**. The listing should then appear in Marketplace. The demo's reuse terms say it is open content; the test price exercises checkout and does not make this file exclusive.

For buying, switch to a second Phantom account with a different public Solana address, sign in again, and fund only that account with free **Devnet** SOL from the official faucet. Buy the listing, confirm the Devnet transfer, and use **Check payment again** until finalized if needed. Download the purchased version and apply its instructions to `examples/transfer-records/input.json`; compare the CSV with `expected.csv`. The live journey is complete only after these actual results are recorded in PROJECT_STATUS.md.

## Payment rules and recovery

The server creates a 10-minute order snapshot using the approved skill and verified buyer. Each order fixes buyer, creator recipient, lamports, version, Devnet network and a unique `reuse:UUID` memo. An advisory database lock reuses pending orders and prevents parallel payment intents for the same buyer/skill. There is no fee, custody, escrow, custom on-chain program or real-money payment.

The browser builds a **legacy transaction with exactly one native SOL transfer followed by one memo**, using the official Kit/system/memo SDKs and Phantom Wallet Standard signing. Unsupported transaction formats or extra instructions fail verification. The browser checks available balance against price plus the RPC-provided network fee. The signature and signed public transaction bytes are saved locally before broadcast; the signature is also saved in the buyer's server order. Only the signature is kept server-side, not a wallet key.

The verifier first checks the configured RPC's Devnet genesis hash and fetches the transaction at `finalized`. It checks success, one buyer signer/fee payer, signature, minimum slot, transfer source/recipient/integer amount, exact memo and supported instruction shape. One transaction signature can belong to only one order. Retrying a successful verification returns the same purchase; the database writes payment and entitlement atomically.

**Expiry uses chain inclusion time, not verification request time.** Block time must be at most the order expiry; a 30-second allowance before creation handles RPC/block clock skew, and a minimum finalized slot prevents prior-slot transactions. The unpredictable memo binds it to a newly created intent. An on-time transaction can be verified after expiry. Missing block time/finality is pending, not paid. A payment included after the window needs operator resolution and does not unlock automatically.

If a response is lost, use **Check payment again**. The website may resend the identical locally saved signed bytes, which cannot charge twice. Account lists server-saved pending signatures. Do not create another payment while one has a signature. If the original transaction never landed before its blockhash/order expired, keep the order ID/signature and ask the operator to inspect Devnet. The MVP deliberately has no automatic clearing of signed orders: an operator must prove no transfer landed (finalized signature status and expired blockhash), or locate/verify the original payment, before permitting a replacement. Never grant an entitlement solely on a screenshot or client callback. Downloaded Markdown can be copied; this is access control, not DRM.

## Cloudflare preparation

The frontend uses **Workers with Static Assets**, not Pages or a second backend. `wrangler.jsonc` serves `dist` and uses `not_found_handling: single-page-application` for direct URL refresh. `_headers` adds basic response headers. Supabase remains the backend.

```powershell
npm run build
npm run deploy:check
```

The dry run validates packaging without publishing. When you explicitly authorize public deployment, sign in with `npx wrangler login`, then run `npm run deploy`. Add the resulting HTTPS origin to Supabase Redirect URLs and `ALLOWED_ORIGINS`, redeploy the function config, and test direct `/marketplace`, `/skill?id=...`, `/submit`, `/account`, `/admin` refresh. Add reusable.network as a Worker custom domain only with authorization and the domain's Cloudflare access. Rebuild frontend assets after changing public VITE_ configuration.

## Verification

```powershell
npm run test:unit
npm test
npm run test:integration
npm run build
npm run deploy:check
```

Chromium tests cover original animation/focus/fallbacks, navigation, literal previews, limits, mobile layouts and explicit backend errors. Synthetic integration tests cover configured listing/detail reads, saved-payment retries and protected download UI. They run separate Vite servers on ports 5175/5176 and never use live credentials. Unit tests use actual local Postgres SQL/RLS through PGlite and focused backend authorization/payment checks. These are not a live blockchain acceptance test.

For production smoke checks, run the preview on port 4174, then `node tests/production-smoke.mjs`. Screenshots are ignored generated artifacts. Run the real journey with two Phantom wallets after setup: creator upload, exact admin review, buyer Devnet payment, retry after finality, buyer-only version download, then demonstrate the agent applying it to the synthetic sample. Record actual IDs/signatures/results in PROJECT_STATUS.md without private credentials. Start the required local drafting integration only after that journey passes. Verify that drafting/import/editing/discard do not upload anything, that evidence reflects actual checks, and that explicit approval submits only the reviewed SKILL.md and listing fields. Token launch, mainnet, REUSE checkout and automatic execution of uploaded skills remain future work.

## Key files

| File | Responsibility |
| --- | --- |
| main.js / homepage.js | Page dispatch and existing homepage behavior/wallet binding |
| scene.js / story.js | Preserved 3D choreography, lazy renderer and scroll coordination |
| pages.js / pages.css | Live marketplace, details, submission, account and review pages |
| sample-pages.js / skills.js | Former illustrative example pages and data |
| app/auth.js / app/api.js | Supabase wallet session and function calls |
| app/checkout.js | Wallet Standard payment, signature recovery and authorized download |
| supabase/functions/marketplace/handler.js | Server session, uploads, admin, orders, verification and entitlement checks |
| supabase/functions/_shared/ | Validation bounds and independent transaction verifier |
| supabase/migrations/20261007191453_marketplace.sql | Tables, constraints, RLS, freeze triggers and atomic mutation functions |
| wrangler.jsonc | Static Worker deployment/direct routes |

Manrope's SIL Open Font License is in `public/licenses/manrope-OFL.txt`. npm dependencies retain their distributions' licenses. Runtime dependencies are pinned. The sharp override applies the patched version used by Wrangler's local tooling.
