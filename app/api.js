import { config, configured } from "./config.js";

let accessToken = null;
export function setAccessToken(token) { accessToken = token; }

export async function api(action, payload = {}) {
  return call(JSON.stringify({ action, ...payload }), "application/json");
}

export async function submitSkill(listing, file) {
  const form = new FormData();
  form.set("listing", JSON.stringify(listing));
  form.set("file", file);
  return call(form);
}

async function call(body, contentType) {
  if (!configured) throw new Error("Marketplace setup is incomplete. Configure Supabase to use live listings and wallet sign-in.");
  const headers = { apikey: config.publicKey };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (contentType) headers["Content-Type"] = contentType;
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/functions/v1/marketplace`, { method: "POST", headers, body, signal: AbortSignal.timeout(25000) });
  } catch { throw new Error("Connection interrupted. If you signed a payment, check it again before paying again."); }
  let data;
  try { data = await response.json(); } catch { throw new Error("Backend response is unavailable. Check deployment and retry."); }
  if (!response.ok || data.error) {
    const error = new Error(data.error || "Request failed.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
