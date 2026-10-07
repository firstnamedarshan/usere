import { config, configured } from "./config.js";
import { api, setAccessToken } from "./api.js";
import { verifiedWallet } from "../supabase/functions/_shared/validation.js";

let client;
let initialization;
let signingIn = false;
let revision = 0;
let state = { ready: false, wallet: null, userId: null, isAdmin: false, error: "" };
const subscribers = new Set();

export function authState() { return state; }
export function onAuthChange(callback) { subscribers.add(callback); callback(state); return () => subscribers.delete(callback); }
function publish(patch) {
  if (Object.entries(patch).every(([key, value]) => state[key] === value)) return;
  state = { ...state, ...patch };
  for (const callback of subscribers) callback(state);
}
export function phantomProvider() { return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null); }

async function loadClient() {
  if (!configured) throw new Error("Wallet sign-in needs Supabase setup. See the setup guide in README.md.");
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(config.supabaseUrl, config.publicKey);
  }
  return client;
}

async function refreshSession(session) {
  const current = ++revision;
  if (!session) {
    setAccessToken(null);
    publish({ wallet: null, userId: null, isAdmin: false, ready: true });
    return;
  }
  try {
    const wallet = verifiedWallet(session.user);
    const connected = phantomProvider()?.publicKey?.toBase58();
    if (connected && connected !== wallet) { await signOut(); return; }
    // A token refresh keeps the same account. Clearing it would interrupt an
    // in-flight payment; actual identity changes still clear private UI.
    if (state.wallet !== wallet || state.userId !== session.user.id) {
      setAccessToken(null);
      publish({ wallet: null, userId: null, isAdmin: false, ready: false });
    }
    setAccessToken(session.access_token);
    const me = await api("me");
    if (current !== revision) return;
    publish({ wallet: me.wallet, userId: me.id, isAdmin: me.is_admin, ready: true, error: "" });
  } catch (error) {
    if (current !== revision) return;
    setAccessToken(null);
    publish({ wallet: null, userId: null, isAdmin: false, ready: true, error: error.message });
  }
}

export function initializeAuth() {
  if (initialization) return initialization;
  initialization = (async () => {
    if (!configured) { publish({ ready: true }); return; }
    try {
      const supabase = await loadClient();
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || signingIn) return;
        // Supabase callbacks must not await further auth calls under its lock.
        setTimeout(() => refreshSession(session), 0);
      });
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await refreshSession(data.session);
      const provider = phantomProvider();
      provider?.on?.("accountChanged", () => { if (!signingIn) signOut(); });
      provider?.on?.("disconnect", () => { if (!signingIn) signOut(); });
    } catch (error) { publish({ ready: true, error: error.message }); }
  })();
  return initialization;
}

export async function signIn() {
  const provider = phantomProvider();
  if (!provider) throw new Error("Install Phantom, or open this site in Phantom’s browser, then try again.");
  await initializeAuth();
  const supabase = await loadClient();
  signingIn = true;
  try {
    await provider.connect();
    const { data, error } = await supabase.auth.signInWithWeb3({
      chain: "solana", wallet: provider,
      statement: "Sign in to Reusable Network. This is a Devnet demo using test SOL only.",
    });
    if (error) throw error;
    await refreshSession(data.session);
    if (!state.wallet) throw new Error(state.error || "Wallet authentication did not complete.");
  } finally { signingIn = false; }
}

export async function signOut() {
  ++revision;
  setAccessToken(null);
  publish({ wallet: null, userId: null, isAdmin: false, ready: true, error: "" });
  if (client) await client.auth.signOut({ scope: "local" });
}

export function bindWalletButton(button, status) {
  onAuthChange((current) => {
    button.textContent = current.wallet ? `${current.wallet.slice(0, 4)}…${current.wallet.slice(-4)}` : "Connect wallet";
    button.setAttribute("aria-label", current.wallet ? "Wallet signed in. Open account" : "Connect wallet");
    button.disabled = !current.ready;
    if (status && current.error) status.textContent = current.error;
  });
  button.addEventListener("click", async () => {
    if (state.wallet) { window.location.assign("/account"); return; }
    button.disabled = true;
    button.textContent = "Sign in with Phantom…";
    if (status) status.textContent = "Approve the sign-in message in Phantom. Connecting alone does not sign you in.";
    try { await signIn(); if (status) status.textContent = "Wallet signed in. Devnet demo — test SOL only."; }
    catch (error) { if (status) status.textContent = error.code === 4001 ? "Sign-in cancelled. You can try again." : error.message; }
    finally { button.disabled = false; if (!state.wallet) button.textContent = "Connect wallet"; }
  });
  initializeAuth();
}
