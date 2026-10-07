// Read-only checks against the configured project's actual HTTP APIs.
// No wallet, uploaded file, paid entitlement or mock backend is created here.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = await readFile(".env.local", "utf8");
function value(name) {
  const match = env.match(new RegExp(`^${name}=(.+)$`, "m"));
  assert.ok(match, `Missing ${name}`);
  return match[1].trim();
}
const url = value("VITE_SUPABASE_URL");
const publicKey = value("VITE_SUPABASE_PUBLISHABLE_KEY");
const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const origin = "http://localhost:4174";
async function endpoint(action, expected, extra = {}, requestOrigin = origin) {
  const response = await fetch(`${url}/functions/v1/marketplace`, { method: "POST", headers: { apikey: publicKey, "Content-Type": "application/json", Origin: requestOrigin }, body: JSON.stringify({ action, ...extra }), signal: AbortSignal.timeout(25000) });
  const body = await response.json();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(body)}`);
  if (requestOrigin === origin) assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  return body;
}

const listings = await endpoint("list", 200);
assert.ok(Array.isArray(listings.skills));
for (const action of ["account", "download", "admin_list", "create_order", "verify_order"]) await endpoint(action, 401);
await endpoint("list", 403, {}, "https://unconfigured.example");
const approved = await client.from("skills").select("id,status");
assert.equal(approved.error, null);
assert.ok(approved.data.every((skill) => skill.status === "approved"));
for (const table of ["profiles", "skill_files", "orders", "purchases"]) {
  const result = await client.from(table).select("*");
  assert.ok(result.error || result.data.length === 0, `Anonymous ${table} must be inaccessible`);
}
const rpc = await client.rpc("create_skill_order", { p_buyer: crypto.randomUUID(), p_skill: crypto.randomUUID(), p_slot: 0 });
assert.ok(rpc.error, "Anonymous callers must not create orders directly");
const storage = await client.storage.from("skill-files").download("unpaid/SKILL.md");
assert.ok(storage.error, "Anonymous callers must not download private storage");
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(15000) });
assert.equal(settingsResponse.status, 200);
const settings = await settingsResponse.json();
console.log(JSON.stringify({ passed: true, approvedListings: listings.skills.length, providers: settings.external, privateAccessDenied: true }, null, 2));
