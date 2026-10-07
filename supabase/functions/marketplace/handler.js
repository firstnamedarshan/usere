import { AppError, validateSkillFile, validateListing, verifiedWallet, requireUuid, requireSignature } from "../_shared/validation.js";
import { DEVNET_GENESIS_HASH, verifyPaymentTransaction } from "../_shared/payment.js";

export function createMarketplaceHandler({ db, config, fetchImpl = fetch }) {
  async function rpc(method, params = []) {
    let response;
    try {
      response = await fetchImpl(config.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (body.error) throw new Error();
      return body.result;
    } catch { throw new AppError("Devnet RPC is unavailable. Retry verification later; do not pay again.", 503, "rpc_unavailable"); }
  }

  async function requireDevnet() {
    const hash = await rpc("getGenesisHash");
    if (hash !== DEVNET_GENESIS_HASH) throw new AppError("Server RPC is not Solana Devnet. Checkout is disabled.", 503, "wrong_network");
    return hash;
  }

  function checked(result) {
    if (result.error) throw new AppError("Database operation failed. Check setup or retry; no new payment is required.", 503, "database_error");
    return result.data;
  }

  async function signedIn(request) {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new AppError("Sign in with Phantom to continue.", 401, "sign_in_required");
    const { data, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !data?.user) throw new AppError("Your session expired. Sign in again.", 401, "sign_in_required");
    const wallet = verifiedWallet(data.user);
    const id = data.user.id;
    checked(await db.from("profiles").upsert({ id, wallet_address: wallet }, { onConflict: "id", ignoreDuplicates: true }));
    const profile = checked(await db.from("profiles").select("wallet_address").eq("id", id).single());
    if (profile.wallet_address !== wallet) throw new AppError("Session wallet does not match the account.", 403);
    return { id, wallet, isAdmin: Boolean(config.adminWallet) && wallet === config.adminWallet };
  }

  async function readFile(skillId) {
    const file = checked(await db.from("skill_files").select("*").eq("skill_id", skillId).single());
    const blob = checked(await db.storage.from("skill-files").download(file.storage_path));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await contentHash(bytes);
    if (hash !== file.content_hash) throw new AppError("Stored file does not match the reviewed version. Contact the operator.", 409, "file_integrity_error");
    return { file, text: validateSkillFile(bytes, "SKILL.md") };
  }

  async function ownedOrder(user, orderId) {
    const { data, error } = await db.from("orders").select("*").eq("id", requireUuid(orderId)).eq("buyer_id", user.id).maybeSingle();
    if (error || !data) throw new AppError("Order not found for this account.", 404);
    return data;
  }

  return async function handle(request) {
    const origin = request.headers.get("Origin");
    const allowed = config.origins.includes(origin);
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (allowed) headers["Access-Control-Allow-Origin"] = origin;
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed) return json({ error: "This origin is not configured.", code: "origin_denied" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    try {
      const bytes = await readLimitedBody(request, 120 * 1024);
      let body;
      if (request.headers.get("Content-Type")?.startsWith("multipart/form-data")) {
        const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("Content-Type") } }).formData();
        const user = await signedIn(request);
        if (form.getAll("file").length !== 1) throw new AppError("Upload exactly one SKILL.md.");
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") throw new AppError("Upload SKILL.md.");
        let input;
        try { input = JSON.parse(form.get("listing")); } catch { throw new AppError("Invalid listing metadata."); }
        const listing = validateListing(input);
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        validateSkillFile(fileBytes, file.name);
        const count = await db.from("skills").select("id", { count: "exact", head: true }).eq("creator_id", user.id).gte("created_at", new Date(Date.now() - 86400000).toISOString());
        if (count.error) checked(count);
        if (count.count >= 20) throw new AppError("Daily submission limit reached. Try tomorrow.", 429);
        const id = crypto.randomUUID();
        const hash = await contentHash(fileBytes);
        const path = `${user.id}/${id}/v1/${hash}/SKILL.md`;
        checked(await db.storage.from("skill-files").upload(path, fileBytes, { contentType: "text/markdown", upsert: false }));
        const result = await db.rpc("submit_skill", { p_id: id, p_creator: user.id, p_listing: listing, p_path: path, p_hash: hash, p_size: fileBytes.byteLength });
        if (result.error) {
          await db.storage.from("skill-files").remove([path]);
          checked(result);
        }
        return json({ skill_id: id, status: "pending" }, 201);
      }
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("Invalid JSON request."); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("Invalid request.");
      const action = body.action;
      if (action === "list") {
        const skills = checked(await db.from("skills").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(250));
        return json({ skills });
      }
      if (action === "details") {
        const skill = checked(await db.from("skills").select("*").eq("id", requireUuid(body.skill_id)).eq("status", "approved").maybeSingle());
        if (!skill) throw new AppError("Approved skill not found.", 404);
        return json({ skill });
      }
      const user = await signedIn(request);
      if (action === "me") return json({ id: user.id, wallet: user.wallet, is_admin: user.isAdmin });
      if (action === "account") {
        const skills = checked(await db.from("skills").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }));
        const purchases = checked(await db.from("purchases").select("*,skills(title)").eq("buyer_id", user.id).order("purchased_at", { ascending: false }));
        const orders = checked(await db.from("orders").select("*").eq("buyer_id", user.id).eq("status", "pending").not("transaction_signature", "is", null));
        return json({ skills, purchases, orders });
      }
      if (action === "ownership") {
        const id = requireUuid(body.skill_id);
        const purchases = checked(await db.from("purchases").select("id,version").eq("buyer_id", user.id).eq("skill_id", id));
        const creator = checked(await db.from("skills").select("id").eq("creator_id", user.id).eq("id", id));
        const orders = checked(await db.from("orders").select("*").eq("buyer_id", user.id).eq("skill_id", id).eq("status", "pending").order("created_at", { ascending: false }));
        return json({ owned: purchases.length > 0 || creator.length > 0, order: orders.find((order) => order.transaction_signature || Date.parse(order.expires_at) > Date.now()) || null });
      }
      if (action === "download") {
        const id = requireUuid(body.skill_id);
        const purchases = checked(await db.from("purchases").select("version").eq("buyer_id", user.id).eq("skill_id", id));
        const creator = checked(await db.from("skills").select("version").eq("creator_id", user.id).eq("id", id));
        const entitlement = purchases[0] || creator[0];
        if (!entitlement) throw new AppError("Purchase this skill before downloading.", 403, "not_owned");
        const { file } = await readFile(id);
        if (file.version !== entitlement.version) throw new AppError("Purchased version does not match the file.", 409);
        const signed = checked(await db.storage.from("skill-files").createSignedUrl(file.storage_path, 60, { download: "SKILL.md" }));
        return json({ url: signed.signedUrl, version: file.version, expires_in: 60 });
      }
      if (action === "admin_list" || action === "admin_preview" || action === "review") {
        if (!user.isAdmin) throw new AppError("Only the configured admin wallet can review submissions.", 403, "admin_required");
        if (action === "admin_list") return json({ skills: checked(await db.from("skills").select("*").eq("status", "pending").order("created_at")) });
        const id = requireUuid(body.skill_id);
        const skill = checked(await db.from("skills").select("*").eq("id", id).eq("status", "pending").maybeSingle());
        if (!skill) throw new AppError("Pending submission not found.", 404);
        const { file, text } = await readFile(id);
        if (action === "admin_preview") return json({ skill, file: { content_hash: file.content_hash, byte_size: file.byte_size }, text });
        if (!["approved", "rejected"].includes(body.status)) throw new AppError("Choose approve or reject.");
        if (body.content_hash !== file.content_hash) throw new AppError("Preview the exact file before reviewing it.", 409);
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (reason.length > 1000 || (body.status === "rejected" && !reason)) throw new AppError("Rejection requires a reason (maximum 1000 characters).");
        const updated = checked(await db.from("skills").update({ status: body.status, review_reason: reason || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id,status"));
        if (!updated.length) throw new AppError("This submission was already reviewed.", 409);
        return json({ skill: updated[0] });
      }
      if (action === "create_order") {
        await requireDevnet();
        const slot = await rpc("getSlot", [{ commitment: "finalized" }]);
        const result = await db.rpc("create_skill_order", { p_buyer: user.id, p_skill: requireUuid(body.skill_id), p_slot: slot });
        if (result.error) throw new AppError("Order could not be created. Refresh ownership and retry, or check an existing payment.", 409);
        return json({ order: result.data });
      }
      if (action === "attach_signature") {
        const order = await ownedOrder(user, body.order_id);
        const result = await db.rpc("attach_order_signature", { p_order: order.id, p_buyer: user.id, p_signature: requireSignature(body.signature) });
        if (result.error) throw new AppError("Signature could not be saved. This order may be expired or already have a payment. Check payment before trying again.", 409);
        return json({ order: result.data });
      }
      if (action === "verify_order") {
        const order = await ownedOrder(user, body.order_id);
        const signature = requireSignature(body.signature || order.transaction_signature);
        if (order.transaction_signature && signature !== order.transaction_signature) throw new AppError("Use the saved signature for this order.", 409);
        const genesis = await requireDevnet();
        const transaction = await rpc("getTransaction", [signature, { commitment: "finalized", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const verified = verifyPaymentTransaction(order, signature, transaction, genesis);
        // Recovery may supply a signature after the payment window. Chain timing, not
        // request timing, controls acceptance. Signature uniqueness still applies.
        if (!order.transaction_signature) {
          const saved = await db.from("orders").update({ transaction_signature: signature }).eq("id", order.id).is("transaction_signature", null).select("id");
          if (saved.error || !saved.data?.length) throw new AppError("Signature is already used or this order changed. Refresh and recheck.", 409);
        }
        const purchase = checked(await db.rpc("finalize_skill_order", { p_order: order.id, p_buyer: user.id, p_signature: signature, p_slot: verified.slot }));
        return json({ paid: true, purchase });
      }
      throw new AppError("Unknown action.", 404);
    } catch (error) {
      if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.status);
      // Do not log bodies, skill content, authorization headers, or signed URLs.
      return json({ error: "Service unavailable. Retry later; check any existing payment before paying again.", code: "service_unavailable" }, 503);
    }
  };
}

async function contentHash(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function readLimitedBody(request, limit) {
  if (Number(request.headers.get("Content-Length")) > limit) throw new AppError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Request body is required.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new AppError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
