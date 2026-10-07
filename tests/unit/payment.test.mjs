import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPaymentTransaction, DEVNET_GENESIS_HASH, SYSTEM_PROGRAM, MEMO_PROGRAM } from "../../supabase/functions/_shared/payment.js";
import * as kit from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getAddMemoInstruction } from "@solana-program/memo";

const signature = "2".repeat(88);
const order = { buyer_wallet: "buyer", recipient_wallet: "creator", amount_lamports: 10000000, reference: "reuse:test", network: "devnet", asset: "SOL", minimum_slot: 100, created_at: "2026-10-07T10:00:00Z", expires_at: "2026-10-07T10:10:00Z" };
function valid() { return { version: "legacy", slot: 101, blockTime: Date.parse("2026-10-07T10:01:00Z") / 1000, meta: { err: null, innerInstructions: [] }, transaction: { signatures: [signature], message: { accountKeys: [{ pubkey: "buyer", signer: true }, { pubkey: "creator", signer: false }], instructions: [{ programId: SYSTEM_PROGRAM, parsed: { type: "transfer", info: { source: "buyer", destination: "creator", lamports: 10000000 } } }, { programId: MEMO_PROGRAM, parsed: "reuse:test" }] } } }; }
test("on-time finalized transaction accepts delayed verification", () => {
  assert.equal(verifyPaymentTransaction(order, signature, valid(), DEVNET_GENESIS_HASH).slot, 101);
});
for (const [name, change] of [
  ["recipient", (t) => { t.transaction.message.instructions[0].parsed.info.destination = "other"; }],
  ["amount", (t) => { t.transaction.message.instructions[0].parsed.info.lamports++; }],
  ["source", (t) => { t.transaction.message.instructions[0].parsed.info.source = "other"; }],
  ["buyer signer", (t) => { t.transaction.message.accountKeys[0].pubkey = "other"; }],
  ["memo / replay for another order", (t) => { t.transaction.message.instructions[1].parsed = "reuse:other"; }],
  ["failed transaction", (t) => { t.meta.err = { InstructionError: [0, "error"] }; }],
  ["late inclusion", (t) => { t.blockTime += 600; }],
  ["early slot", (t) => { t.slot = 99; }],
  ["unsupported version", (t) => { t.version = 0; }],
  ["extra instructions", (t) => { t.transaction.message.instructions.push({}); }],
  ["inner instructions", (t) => { t.meta.innerInstructions = [{}]; }],
  ["signature", (t) => { t.transaction.signatures = ["other"]; }],
]) test(`rejects ${name}`, () => { const transaction = valid(); change(transaction); assert.throws(() => verifyPaymentTransaction(order, signature, transaction, DEVNET_GENESIS_HASH)); });
test("wrong network and pending finality grant nothing", () => {
  assert.throws(() => verifyPaymentTransaction(order, signature, valid(), "mainnet"));
  assert.throws(() => verifyPaymentTransaction(order, signature, null, DEVNET_GENESIS_HASH), (error) => error.code === "pending_confirmation");
});
test("installed official SDK builds a legacy transfer and memo and serializes unsigned bytes", async () => {
  const source = kit.createNoopSigner((await kit.generateKeyPairSigner()).address);
  const transfer = getTransferSolInstruction({ source, destination: kit.address("So11111111111111111111111111111111111111112"), amount: 1n });
  let message = kit.createTransactionMessage({ version: "legacy" });
  message = kit.setTransactionMessageFeePayer(source.address, message);
  message = kit.setTransactionMessageLifetimeUsingBlockhash({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100n }, message);
  message = kit.appendTransactionMessageInstructions([transfer, getAddMemoInstruction({ memo: "reuse:test" })], message);
  const transaction = kit.compileTransaction(message);
  const bytes = kit.getTransactionEncoder().encode(transaction);
  assert.equal(kit.getTransactionDecoder().decode(bytes).messageBytes.length, transaction.messageBytes.length);
  assert.ok(kit.getBase64Decoder().decode(bytes).length > 0);
});
