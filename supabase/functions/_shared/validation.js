// Shared by browser and backend. Database constraints provide another boundary.
export const MAX_FILE_BYTES = 100 * 1024;
export const MAX_PRICE_LAMPORTS = 10_000_000_000; // 10 Devnet SOL
export const CATEGORIES = ["Solana data", "Transaction debugging", "Developer tools", "Data workflows"];
export const FIELD_LIMITS = { title: 100, description: 600, expected_input: 2000, expected_output: 2000, requirements: 2000, limitations: 2000, reuse_terms: 1000 };

export class AppError extends Error {
  constructor(message, status = 400, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function priceToLamports(value) {
  const text = String(value).trim();
  if (!/^\d{1,2}(\.\d{1,9})?$/.test(text)) throw new AppError("Use a decimal SOL price with at most 9 decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const amount = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
  if (amount < 1n || amount > BigInt(MAX_PRICE_LAMPORTS)) throw new AppError("Price must be greater than zero and at most 10 Devnet SOL.");
  return Number(amount);
}

export function formatLamports(value) {
  const amount = BigInt(value);
  const whole = amount / 1_000_000_000n;
  const fraction = String(amount % 1_000_000_000n).padStart(9, "0").replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""} Devnet SOL`;
}

export function validateSkillFile(bytes, name) {
  if (name !== "SKILL.md") throw new AppError("Choose exactly one file named SKILL.md.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new AppError("SKILL.md must be 100 KB or smaller.");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new AppError("Choose a UTF-8 plain-text SKILL.md."); }
  if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new AppError("SKILL.md must contain readable, non-empty plain text.");
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    /(?:api[_ -]?key|secret[_ -]?key|private[_ -]?key|access[_ -]?token)\s*[:=]\s*["']?[A-Za-z0-9_+/=-]{24,}/i,
    /(?:seed phrase|recovery phrase|mnemonic)\s*[:=]\s*(?:[a-z]+\s+){11}[a-z]+/i,
    /(?:private[_ -]?key|secret[_ -]?key)\s*[:=]\s*\[\s*(?:\d{1,3}\s*,\s*){31,}\d{1,3}\s*\]/i,
  ];
  if (secretPatterns.some((pattern) => pattern.test(text))) throw new AppError("Possible credential or recovery phrase found. Remove it and use a placeholder before uploading.");
  return text;
}

export function validateListing(input) {
  const listing = {};
  for (const [name, max] of Object.entries(FIELD_LIMITS)) {
    const value = input[name];
    if (typeof value !== "string" || !value.trim() || value.length > max || /\u0000/.test(value)) throw new AppError(`${name.replaceAll("_", " ")} is required (maximum ${max} characters).`);
    listing[name] = value.trim();
  }
  if (!CATEGORIES.includes(input.category)) throw new AppError("Choose a supported category.");
  if (input.permission_confirmed !== true) throw new AppError("Confirm your sharing rights and that you removed private information.");
  listing.category = input.category;
  listing.price_lamports = priceToLamports(input.price);
  return listing;
}

export function requireUuid(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError("Invalid ID.");
  return value;
}

export function requireSignature(value) {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)) throw new AppError("Invalid transaction signature.");
  return value;
}

export function verifiedWallet(user) {
  // user_metadata is user-editable: never use it for wallet or admin authority.
  // Supabase stores provider-specific Web3 fields under custom_claims. Keep
  // older flat identity data compatible, without falling back to user metadata.
  const wallets = (user?.identities || [])
    .filter((identity) => identity.provider === "web3")
    .map((identity) => identity.identity_data?.custom_claims ?? identity.identity_data)
    .filter((claims) => claims?.chain === "solana");
  if (wallets.length !== 1) throw new AppError("Sign in with one verified Solana wallet.", 401, "sign_in_required");
  const wallet = wallets[0].address;
  if (typeof wallet !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) throw new AppError("Verified wallet address is missing.", 401);
  return wallet;
}
