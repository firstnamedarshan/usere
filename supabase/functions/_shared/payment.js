import { AppError } from "./validation.js";

export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export function verifyPaymentTransaction(order, signature, transaction, genesisHash) {
  if (genesisHash !== DEVNET_GENESIS_HASH || order.network !== "devnet" || order.asset !== "SOL") throw new AppError("Payment verification is restricted to Solana Devnet.", 503, "wrong_network");
  if (!transaction) throw new AppError("Payment is not finalized yet. Check payment again; do not pay again.", 202, "pending_confirmation");
  if (transaction.version !== "legacy") throw new AppError("Unsupported transaction format. Only legacy SOL transfer plus memo is supported.");
  if (!transaction.meta || transaction.meta.err !== null) throw new AppError("The transaction failed; no purchase was granted.");
  if (transaction.transaction?.signatures?.length !== 1 || transaction.transaction.signatures[0] !== signature) throw new AppError("Transaction signature does not match.");
  const message = transaction.transaction.message;
  const signers = message.accountKeys?.filter((account) => account.signer);
  if (signers?.length !== 1 || signers[0].pubkey !== order.buyer_wallet || message.accountKeys[0].pubkey !== order.buyer_wallet) throw new AppError("The expected buyer must be the signer and fee payer.");
  if (!Number.isSafeInteger(transaction.slot) || transaction.slot < order.minimum_slot) throw new AppError("Transaction predates this order.");
  // Inclusion must precede expiry; later verification of an on-time payment is allowed.
  const time = transaction.blockTime;
  if (!Number.isSafeInteger(time)) throw new AppError("Block timestamp is unavailable. Try verification again.", 202, "pending_confirmation");
  if (time < Math.floor(Date.parse(order.created_at) / 1000) - 30 || time > Math.floor(Date.parse(order.expires_at) / 1000)) throw new AppError("Payment was included outside the order payment window.");
  const instructions = message.instructions;
  if (instructions?.length !== 2 || transaction.meta.innerInstructions?.length) throw new AppError("Unsupported instructions. Expected one SOL transfer and one order memo.");
  const [transfer, memo] = instructions;
  if (transfer.programId !== SYSTEM_PROGRAM || transfer.parsed?.type !== "transfer") throw new AppError("Expected a native SOL transfer.");
  const info = transfer.parsed.info;
  if (info?.source !== order.buyer_wallet || info?.destination !== order.recipient_wallet || !Number.isSafeInteger(info?.lamports) || info.lamports !== Number(order.amount_lamports)) throw new AppError("Buyer, recipient or lamport amount does not match this order.");
  if (memo.programId !== MEMO_PROGRAM || memo.parsed !== order.reference) throw new AppError("Order reference does not match.");
  return { signature, slot: transaction.slot, blockTime: time };
}
