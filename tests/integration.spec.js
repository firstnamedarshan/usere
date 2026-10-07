// Synthetic sessions and backend responses only. This does not test the live chain.
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const skill = { id: "20000000-0000-4000-8000-000000000001", title: "Transfer records to CSV", description: "Normalize supplied Solana records", category: "Solana data", expected_input: "Synthetic transfer JSON", expected_output: "CSV", requirements: "An existing agent", limitations: "Offline records only", reuse_terms: "Demo reuse", creator_wallet: "2".repeat(32), version: 1, price_lamports: 10000000 };
const wallet = "1".repeat(32);
const userId = "10000000-0000-4000-8000-000000000001";
async function session(page) {
  await page.addInitScript(({ wallet, userId }) => {
    const user = { id: userId, identities: [{ provider: "web3", identity_data: { custom_claims: { chain: "solana", address: wallet } } }] };
    localStorage.setItem("sb-mvp-test-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user }));
  }, { wallet, userId });
}
async function backend(page, responder) {
  await page.route("https://mvp-test.supabase.co/functions/v1/marketplace", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
    const action = request.headers()["content-type"]?.includes("multipart") ? "submit" : request.postDataJSON().action;
    const result = await responder(action, request);
    await route.fulfill({ status: result.status || 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(result.body || result) });
  });
}
async function authEvent(page, event, changes = {}) {
  await page.evaluate(({ event, changes }) => {
    const session = { ...JSON.parse(localStorage.getItem("sb-mvp-test-auth-token")), ...changes };
    const channel = new BroadcastChannel("sb-mvp-test-auth-token");
    channel.postMessage({ event, session: event === "SIGNED_OUT" ? null : session });
    channel.close();
  }, { event, changes });
}
test("configured listings and details show endpoint data with persisted filters", async ({ page }) => {
  await backend(page, (action) => action === "list" ? { skills: [skill] } : { skill });
  await page.goto("/marketplace");
  await expect(page.locator(".market-card")).toHaveCount(1);
  await expect(page.locator(".skill-price")).toHaveText("0.01 Devnet SOL");
  await page.getByLabel("Search skills").fill("CSV");
  await page.reload();
  await expect(page.getByLabel("Search skills")).toHaveValue("CSV");
  await page.locator(".market-card").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(skill.title);
  await expect(page.getByRole("button", { name: "Sign in to buy" })).toBeEnabled();
  await page.reload();
  await expect(page.locator(".skill-facts")).toContainText(skill.creator_wallet);
});

test("Phantom confirmation authenticates through the SDK with Supabase nested Web3 identity claims", async ({ page }) => {
  await page.addInitScript(({ wallet }) => {
    const publicKey = { toBase58: () => wallet };
    window.phantom = { solana: {
      isPhantom: true, publicKey,
      connect: async () => ({ publicKey }),
      on: () => {},
      signIn: async (input) => {
        window.testSigninInput = input;
        return { account: { address: wallet }, signedMessage: new TextEncoder().encode("Synthetic SDK sign-in fixture"), signature: new Uint8Array(64) };
      },
    } };
  }, { wallet });
  const user = { id: userId, identities: [{ provider: "web3", identity_data: { sub: `web3:solana:${wallet}`, custom_claims: { chain: "solana", address: wallet } } }] };
  let exchanges = 0;
  await page.route("https://mvp-test.supabase.co/auth/v1/token?grant_type=web3", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version" } });
    exchanges++;
    expect(route.request().postDataJSON().chain).toBe("solana");
    await route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ access_token: "signed-fixture-token", refresh_token: "fixture-refresh-token", expires_in: 3600, token_type: "bearer", user }) });
  });
  await backend(page, (action, request) => {
    if (action === "me") { expect(request.headers().authorization).toBe("Bearer signed-fixture-token"); return { wallet, id: userId, is_admin: true }; }
    return {};
  });
  await page.goto("/submit");
  await expect(page.locator("#connect-wallet")).toBeEnabled();
  await page.locator("#connect-wallet").click();
  await expect(page.locator("#connect-wallet")).toHaveAttribute("aria-label", "Wallet signed in. Open account");
  await expect(page.locator("#wallet-status")).toContainText("Wallet signed in");
  await expect(page.locator("#admin-link")).toBeVisible();
  expect(exchanges).toBe(1);
  expect(await page.evaluate(() => window.testSigninInput.domain)).toBe("127.0.0.1:5176");
});
test("pending payment survives refresh, retries verification, and downloads after server entitlement", async ({ page }) => {
  await session(page);
  const order = { id: "30000000-0000-4000-8000-000000000001", buyer_wallet: wallet, transaction_signature: "4".repeat(88) };
  let owned = false;
  let verifies = 0;
  let creates = 0;
  await backend(page, (action) => {
    if (action === "me") return { wallet, id: userId, is_admin: false };
    if (action === "details") return { skill };
    if (action === "ownership") return { owned, order: owned ? null : order };
    if (action === "verify_order") { verifies++; if (verifies === 1) return { status: 202, body: { error: "Payment is not finalized yet. Check payment again; do not pay again.", code: "pending_confirmation" } }; owned = true; return { paid: true }; }
    if (action === "create_order") { creates++; return { order }; }
    if (action === "download") return { url: "https://mvp-test.supabase.co/storage/v1/object/sign/skill-files/demo?token=fixture", version: 1 };
    return {};
  });
  await page.route("**/storage/v1/object/sign/**", (route) => route.fulfill({ contentType: "text/markdown", body: "# Purchased exact version\nSynthetic content" }));
  await page.goto(`/skill?id=${skill.id}`);
  await expect(page.locator("#check-payment")).toBeVisible();
  await expect(page.locator("#buy-skill")).toBeHidden();
  await page.reload();
  await page.locator("#check-payment").click();
  await expect(page.locator("#purchase-notice")).toContainText("not finalized yet");
  await page.locator("#check-payment").click();
  await expect(page.locator("#download-skill")).toBeVisible();
  await expect(page.locator("#buy-skill")).toBeHidden();
  const downloaded = page.waitForEvent("download");
  await page.locator("#download-skill").click();
  expect((await downloaded).suggestedFilename()).toBe("SKILL.md");
  expect(creates).toBe(0);
});
test("server ownership error never offers a new payment", async ({ page }) => {
  await session(page);
  await backend(page, (action) => {
    if (action === "me") return { wallet, id: userId, is_admin: false };
    if (action === "details") return { skill };
    return { status: 503, body: { error: "RPC unavailable" } };
  });
  await page.goto(`/skill?id=${skill.id}`);
  await expect(page.locator("#purchase-notice")).toHaveText("RPC unavailable");
  await expect(page.locator("#buy-skill")).toBeDisabled();
});

test("token refresh during signing preserves the active order and authenticated verification", async ({ page }) => {
  await session(page);
  // Replace only the wallet/chain signing boundary; session events and API calls
  // use the real application and Supabase SDK. No live payment is represented.
  await page.addInitScript(() => {
    window.testSigningGate = new Promise((resolve) => { window.finishTestSigning = resolve; });
  });
  await page.route("**/app/checkout.js", (route) => route.fulfill({ contentType: "application/javascript", body: `
    export { checkPayment, downloadSkill, savedSignature } from "/app/checkout.js?real";
    export async function payOrder(order, progress) {
      progress("Waiting for synthetic wallet signature");
      await window.testSigningGate;
      return "${"4".repeat(88)}";
    }
  ` }));
  const order = { id: "30000000-0000-4000-8000-000000000002", buyer_wallet: wallet };
  let holdRefresh = false;
  let refreshedChecks = 0;
  let creates = 0;
  let owned = false;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  await backend(page, async (action, request) => {
    if (action === "me") { if (holdRefresh) { refreshedChecks++; await refreshGate; } return { wallet, id: userId, is_admin: false }; }
    if (action === "details") return { skill };
    if (action === "ownership") return { owned, order: null };
    if (action === "create_order") { creates++; return { order }; }
    if (action === "verify_order") {
      expect(request.postDataJSON().order_id).toBe(order.id);
      expect(request.headers().authorization).toBe("Bearer refreshed-fixture-token");
      owned = true;
      return { paid: true };
    }
    return {};
  });
  await page.goto(`/skill?id=${skill.id}`);
  await expect(page.locator("#buy-skill")).toBeEnabled();
  await page.locator("#buy-skill").click();
  await expect(page.locator("#purchase-notice")).toHaveText("Waiting for synthetic wallet signature");
  holdRefresh = true;
  await authEvent(page, "TOKEN_REFRESHED", { access_token: "refreshed-fixture-token" });
  await expect.poll(() => refreshedChecks).toBe(1);
  expect(await page.evaluate(async () => (await import("/app/auth.js")).authState().wallet)).toBe(wallet);
  await expect(page.locator("#buy-skill")).toBeDisabled();
  releaseRefresh();
  await page.evaluate(() => window.finishTestSigning());
  await expect(page.locator("#download-skill")).toBeVisible();
  expect(creates).toBe(1);
});

test("sign-out during verification clears private recovery and never displays the previous entitlement", async ({ page }) => {
  await session(page);
  const order = { id: "30000000-0000-4000-8000-000000000003", buyer_wallet: wallet, transaction_signature: "4".repeat(88) };
  let verifying = false;
  let releaseVerification;
  const verificationGate = new Promise((resolve) => { releaseVerification = resolve; });
  await backend(page, async (action) => {
    if (action === "me") return { wallet, id: userId, is_admin: false };
    if (action === "details") return { skill };
    if (action === "ownership") return { owned: false, order };
    if (action === "verify_order") { verifying = true; await verificationGate; return { paid: true }; }
    return {};
  });
  await page.goto(`/skill?id=${skill.id}`);
  await expect(page.locator("#payment-recovery")).toBeVisible();
  await page.locator("#check-payment").click();
  await expect.poll(() => verifying).toBe(true);
  await authEvent(page, "SIGNED_OUT");
  await expect(page.locator("#buy-skill")).toHaveText("Sign in to buy");
  await expect(page.locator("#payment-recovery")).toBeHidden();
  releaseVerification();
  await expect(page.locator("#check-payment")).toBeEnabled();
  await expect(page.locator("#download-skill")).toBeHidden();
  await expect(page.locator("#buy-skill")).toHaveText("Sign in to buy");
});

test("authenticated submission sends the reviewed draft and shows pending, not approved", async ({ page }) => {
  await session(page);
  let submissions = 0;
  await backend(page, (action, request) => {
    if (action === "me") return { wallet, id: userId, is_admin: false };
    if (action === "submit") {
      submissions++;
      expect(request.postData()).toContain("permission_confirmed");
      expect(request.postData()).toContain("# Useful workflow");
      return { status: 201, body: { skill_id: skill.id, status: "pending" } };
    }
    return {};
  });
  await page.goto("/submit");
  for (const [label, value] of [["Title", "My workflow"], ["Description", "Useful sample"], ["Expected input / public example", "JSON"], ["Expected output / public example", "CSV"], ["Requirements", "Agent"], ["Limitations", "Offline only"], ["Price in Devnet SOL", "0.01"]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Category", { exact: true }).selectOption("Solana data");
  await page.locator("#permission-confirmed").check();
  await page.getByLabel("Upload one SKILL.md").setInputFiles({ name: "SKILL.md", mimeType: "text/markdown", buffer: Buffer.from("# Useful workflow\nUse synthetic records") });
  await page.locator("#preview-skill").click();
  await expect(page.locator("#submit-skill")).toBeEnabled();
  await page.locator("#submit-skill").click();
  await expect(page.locator("#preview-status")).toContainText("pending review");
  await expect(page.getByRole("link", { name: "View my skills" })).toHaveAttribute("href", "/account");
  expect(submissions).toBe(1);
});

test("demo helper loads the actual file locally and requires consent and preview before pending upload", async ({ page }) => {
  await session(page);
  const demoText = await readFile("public/demo/transfer-records/SKILL.md", "utf8");
  let submissions = 0;
  await backend(page, (action, request) => {
    if (action === "me") return { wallet, id: userId, is_admin: true };
    if (action === "submit") {
      submissions++;
      expect(request.postData()).toContain(demoText.trimEnd());
      expect(request.postData()).toContain("Transfer records to CSV — demo");
      return { status: 201, body: { skill_id: skill.id, status: "pending" } };
    }
    return {};
  });
  await page.goto("/submit");
  await page.locator("#permission-confirmed").check();
  await page.getByRole("button", { name: "Use tested demo draft" }).click();
  await expect(page.locator("#preview-status")).toContainText("Demo draft loaded locally");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Transfer records to CSV — demo");
  await expect(page.getByLabel("Price in Devnet SOL")).toHaveValue("0.01");
  await expect(page.getByLabel("Reuse terms")).toHaveValue(/open content/);
  await expect(page.locator("#file-preview")).toHaveText(demoText);
  await expect(page.locator("#permission-confirmed")).not.toBeChecked();
  await expect(page.locator("#submit-skill")).toBeDisabled();
  expect(await page.locator("#skill-file").evaluate((input) => input.files[0].name)).toBe("SKILL.md");
  expect(submissions).toBe(0);
  await page.locator("#permission-confirmed").check();
  await page.locator("#preview-skill").click();
  await expect(page.locator("#submit-skill")).toBeEnabled();
  expect(submissions).toBe(0);
  await page.locator("#submit-skill").click();
  await expect(page.locator("#preview-status")).toContainText("pending review");
  expect(submissions).toBe(1);
});
test("admin reads exact literal file and must confirm before review", async ({ page }) => {
  await session(page);
  const text = '# Skill\n<script>window.adminExecuted=true</script>';
  const hash = "a".repeat(64);
  let reviews = 0;
  await backend(page, (action, request) => {
    if (action === "me") return { wallet, id: userId, is_admin: true };
    if (action === "admin_list") return { skills: [skill] };
    if (action === "admin_preview") return { skill, text, file: { content_hash: hash, byte_size: text.length } };
    if (action === "review") { reviews++; expect(request.postDataJSON().content_hash).toBe(hash); return { skill: { id: skill.id, status: "approved" } }; }
    return {};
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Review exact file" }).click();
  await expect(page.locator("#admin-file")).toHaveText(text);
  await expect(page.locator("#admin-file script")).toHaveCount(0);
  await page.locator("#approve").click();
  await expect(page.locator("#review-status")).toContainText("Confirm you reviewed");
  expect(reviews).toBe(0);
  await page.locator("#review-confirm").check();
  await page.locator("#approve").click();
  await expect(page.locator("#review-status")).toContainText("approved");
  expect(reviews).toBe(1);
  expect(await page.evaluate(() => window.adminExecuted)).toBeUndefined();
});
