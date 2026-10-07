import { api } from "./api.js";
import { config } from "./config.js";
import { authState, phantomProvider } from "./auth.js";
import { DEVNET_GENESIS_HASH } from "../supabase/functions/_shared/payment.js";

function recoveryKey(order) { return `reuse-payment:${order.buyer_wallet}:${order.id}`; }
export function savedSignature(order) {
  return order.transaction_signature || localStorage.getItem(recoveryKey(order));
}

async function rebroadcastSavedPayment(order) {
  const wire = localStorage.getItem(recoveryKey(order) + ":wire");
  if (!wire || order.buyer_wallet !== authState().wallet) return;
  await api("attach_signature", { order_id: order.id, signature: savedSignature(order) });
  const kit = await import("@solana/kit");
  const rpc = kit.createSolanaRpc(config.rpcUrl);
  if (await rpc.getGenesisHash().send() !== DEVNET_GENESIS_HASH) throw new Error("Browser RPC is not Devnet.");
  // Resending identical signed bytes cannot charge twice. Always check the chain
  // even if this reports an expired/already processed transaction.
  try { await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 3n }).send(); }
  catch { /* Verification determines whether the transfer succeeded. */ }
}

export async function payOrder(order, onProgress) {
  const account = authState();
  if (order.network !== "devnet" || order.asset !== "SOL") throw new Error("Only Devnet SOL checkout is supported.");
  if (account.wallet !== order.buyer_wallet) throw new Error("Sign in with the wallet that created this order.");
  if (savedSignature(order)) throw new Error("This order already has a signed payment. Check it again before paying again.");
  if (Date.parse(order.expires_at) <= Date.now()) throw new Error("Order expired. Refresh before preparing a payment.");
  const provider = phantomProvider();
  if (!provider) throw new Error("Open Phantom to sign your Devnet payment.");
  await provider.connect();
  if (provider.publicKey.toBase58() !== order.buyer_wallet) throw new Error("Phantom changed wallets. Sign in again with the intended buyer.");
  const [kit, system, memo, walletApp] = await Promise.all([
    import("@solana/kit"), import("@solana-program/system"), import("@solana-program/memo"), import("@wallet-standard/app"),
  ]);
  const rpc = kit.createSolanaRpc(config.rpcUrl);
  if (await rpc.getGenesisHash().send() !== DEVNET_GENESIS_HASH) throw new Error("Browser RPC is not Devnet. Payment is disabled.");
  const balance = await rpc.getBalance(kit.address(order.buyer_wallet), { commitment: "confirmed" }).send();
  const lifetime = await rpc.getLatestBlockhash({ commitment: "finalized" }).send();
  const source = kit.createNoopSigner(kit.address(order.buyer_wallet));
  let message = kit.createTransactionMessage({ version: "legacy" });
  message = kit.setTransactionMessageFeePayer(source.address, message);
  message = kit.setTransactionMessageLifetimeUsingBlockhash(lifetime.value, message);
  message = kit.appendTransactionMessageInstructions([
    system.getTransferSolInstruction({ source, destination: kit.address(order.recipient_wallet), amount: BigInt(order.amount_lamports) }),
    memo.getAddMemoInstruction({ memo: order.reference }),
  ], message);
  const transaction = kit.compileTransaction(message);
  const fee = await rpc.getFeeForMessage(kit.getBase64Decoder().decode(transaction.messageBytes), { commitment: "confirmed" }).send();
  if (fee.value === null) throw new Error("Network fee unavailable. Retry before signing.");
  if (balance.value < BigInt(order.amount_lamports) + fee.value) throw new Error("Insufficient Devnet SOL for the skill and network fee. Get free test funds from the Solana faucet.");
  const wallet = walletApp.getWallets().get().find((item) => item.name === "Phantom" && item.features["solana:signTransaction"]);
  if (!wallet) throw new Error("Phantom Wallet Standard signing is unavailable. Update Phantom or use its supported browser.");
  const connected = await wallet.features["standard:connect"].connect();
  const walletAccount = connected.accounts.find((item) => item.address === order.buyer_wallet);
  if (!walletAccount) throw new Error("Phantom does not have the signed-in buyer account connected.");
  onProgress("Approve the Devnet SOL transfer in Phantom. The network fee is separate from the skill price.");
  const [signed] = await wallet.features["solana:signTransaction"].signTransaction({
    account: walletAccount, chain: "solana:devnet", transaction: kit.getTransactionEncoder().encode(transaction),
  });
  const signedTransaction = kit.getTransactionDecoder().decode(signed.signedTransaction);
  if (signedTransaction.messageBytes.length !== transaction.messageBytes.length ||
      signedTransaction.messageBytes.some((byte, index) => byte !== transaction.messageBytes[index])) {
    throw new Error("Wallet changed the requested transaction. Payment was not sent.");
  }
  const signature = kit.getSignatureFromTransaction(signedTransaction);
  // Save before broadcasting, including on the server. A lost RPC response must
  // leave a recovery path, never an invitation to pay twice.
  localStorage.setItem(recoveryKey(order), signature);
  localStorage.setItem(recoveryKey(order) + ":wire", kit.getBase64Decoder().decode(signed.signedTransaction));
  onProgress("Saving payment reference before sending…");
  await api("attach_signature", { order_id: order.id, signature });
  onProgress("Sending Devnet payment. Keep this order for verification.");
  try {
    await rpc.sendTransaction(kit.getBase64Decoder().decode(signed.signedTransaction), { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 3n }).send();
  } catch { throw new Error(`Sending was interrupted. Check this payment before doing anything else. Signature: ${signature}`); }
  return signature;
}

export async function checkPayment(order, signature = savedSignature(order)) {
  if (!signature) throw new Error("No payment signature is saved for this order.");
  try {
    const result = await api("verify_order", { order_id: order.id, signature });
    if (result.paid) {
      localStorage.removeItem(recoveryKey(order));
      localStorage.removeItem(recoveryKey(order) + ":wire");
    }
    return result;
  } catch (error) {
    if (error.code === "pending_confirmation") await rebroadcastSavedPayment(order);
    throw error;
  }
}

export async function downloadSkill(skillId) {
  const result = await api("download", { skill_id: skillId });
  const response = await fetch(result.url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Download link expired or failed. Request a fresh download.");
  const url = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "SKILL.md";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
