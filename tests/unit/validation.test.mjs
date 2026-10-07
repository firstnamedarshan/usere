import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSkillFile, validateListing, priceToLamports, formatLamports, verifiedWallet } from "../../supabase/functions/_shared/validation.js";
import { transferRecordsToCsv } from "../../examples/transfer-records/convert.mjs";

test("prices use exact lamports, bound cost, and reject floating-point notation", () => {
  assert.equal(priceToLamports("0.000000001"), 1);
  assert.equal(priceToLamports("10"), 10000000000);
  assert.equal(priceToLamports("0.123456789"), 123456789);
  assert.equal(formatLamports(123456789), "0.123456789 Devnet SOL");
  for (const value of ["0", "-1", "10.000000001", "0.0000000001", "1e-3", "NaN"]) assert.throws(() => priceToLamports(value));
});
test("file validation rejects size, invalid UTF-8, binary, wrong filename and obvious credentials", () => {
  const bytes = (text) => new TextEncoder().encode(text);
  assert.equal(validateSkillFile(bytes("# Skill\n<script>literal</script>"), "SKILL.md"), "# Skill\n<script>literal</script>");
  for (const value of [bytes(""), bytes("\u0000binary"), new Uint8Array([0xff]), new Uint8Array(102401), bytes("api_key=" + "A".repeat(30)), bytes("-----BEGIN PRIVATE KEY-----"), bytes("mnemonic: " + "word ".repeat(12))]) assert.throws(() => validateSkillFile(value, "SKILL.md"));
  assert.throws(() => validateSkillFile(bytes("# Skill"), "notes.md"));
  assert.doesNotThrow(() => validateSkillFile(bytes("api_key: <YOUR_API_KEY>"), "SKILL.md"));
});
test("wallet authority uses signed identities instead of editable user metadata", () => {
  const wallet = "11111111111111111111111111111111";
  assert.throws(() => verifiedWallet({ user_metadata: { address: wallet, chain: "solana" } }));
  assert.throws(() => verifiedWallet({ user_metadata: { custom_claims: { address: wallet, chain: "solana" } } }));
  const identity = { provider: "web3", identity_data: { sub: `solana:${wallet}`, custom_claims: { chain: "solana", address: wallet, domain: "localhost:4174" } } };
  assert.equal(verifiedWallet({ identities: [identity] }), wallet);
  assert.throws(() => verifiedWallet({ identities: [identity, identity] }));
  assert.throws(() => verifiedWallet({ identities: [{ ...identity, provider: "email" }] }));
  assert.throws(() => verifiedWallet({ identities: [{ provider: "web3", identity_data: { chain: "solana", address: wallet, custom_claims: { chain: "ethereum", address: wallet } } }] }));
  assert.throws(() => verifiedWallet({ identities: [{ provider: "web3", identity_data: { custom_claims: { chain: "solana", address: "not an address" } } }] }));
  assert.equal(verifiedWallet({ identities: [{ provider: "web3", identity_data: { chain: "solana", address: wallet } }] }), wallet);
});
test("listing requires all public fields, permission and supported category", () => {
  const listing = { title: "Demo", description: "Description", expected_input: "JSON", expected_output: "CSV", requirements: "An agent", limitations: "Supplied data only", reuse_terms: "No warranty", category: "Solana data", price: "0.01", permission_confirmed: true };
  assert.equal(validateListing(listing).price_lamports, 10000000);
  assert.throws(() => validateListing({ ...listing, permission_confirmed: false }));
  assert.throws(() => validateListing({ ...listing, limitations: " " }));
  assert.throws(() => validateListing({ ...listing, title: "x".repeat(101) }));
});
test("demo skill synthetic fixture matches the expected CSV; duplicate conflicts and injection handled", async () => {
  const records = JSON.parse(await readFile("examples/transfer-records/input.json", "utf8"));
  const output = transferRecordsToCsv(records);
  assert.equal(output.csv, await readFile("examples/transfer-records/expected.csv", "utf8"));
  assert.equal(transferRecordsToCsv([...records, ...records]).duplicates, 1);
  assert.throws(() => transferRecordsToCsv([...records, { ...records[0], lamports: "1" }]));
  assert.match(transferRecordsToCsv([{ ...records[0], source: "=SUM(1,2)" }]).csv, /"'=SUM\(1,2\)"/);
  assert.match(transferRecordsToCsv([{ ...records[0], lamports: "900719925474099312345" }]).csv, /900719925474\.099312345/);
  assert.throws(() => transferRecordsToCsv([{ ...records[0], lamports: 1 }]));
});
