import { test } from "node:test";
import assert from "node:assert/strict";
import { createMarketplaceHandler } from "../../supabase/functions/marketplace/handler.js";

function service(user) {
  let storageReads = 0;
  const query = { upsert: () => Promise.resolve({ error: null }), select: () => query, eq: () => query,
    single: async () => ({ data: { wallet_address: "1".repeat(32) } }), then: (resolve) => resolve({ data: [], error: null }) };
  return { auth: { getUser: async () => ({ data: { user }, error: user ? null : new Error("invalid") }) }, from: () => query,
    storage: { from: () => { storageReads++; throw new Error("Should not access storage"); } }, reads: () => storageReads };
}
const user = { id: "10000000-0000-4000-8000-000000000001", identities: [{ provider: "web3", identity_data: { custom_claims: { chain: "solana", address: "1".repeat(32) } } }] };
const config = { origins: ["http://localhost:5173"], adminWallet: "2".repeat(32), rpcUrl: "https://api.devnet.solana.com" };
const request = (body, token = "valid", origin = "http://localhost:5173") => new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
test("logged-out private actions require a validated session", async () => {
  const db = service(null);
  const handler = createMarketplaceHandler({ db, config });
  for (const action of ["download", "admin_list", "review", "create_order", "account", "verify_order"]) assert.equal((await handler(request({ action }, null))).status, 401);
  assert.equal(db.reads(), 0);
});
test("non-admin cannot approve or inspect pending file, unpaid buyer cannot download arbitrary paths", async () => {
  const db = service(user);
  const handler = createMarketplaceHandler({ db, config });
  for (const action of ["admin_list", "admin_preview", "review"]) assert.equal((await handler(request({ action }))).status, 403);
  const response = await handler(request({ action: "download", skill_id: "20000000-0000-4000-8000-000000000001", storage_path: "private/SKILL.md" }));
  assert.equal(response.status, 403);
  assert.equal(db.reads(), 0);
});
test("unknown origins and oversized chunked bodies are rejected", async () => {
  const handler = createMarketplaceHandler({ db: service(user), config });
  assert.equal((await handler(request({ action: "list" }, null, "https://other.example"))).status, 403);
  const oversized = request({ action: "list", text: "a".repeat(123000) });
  assert.equal((await handler(oversized)).status, 413);
});
