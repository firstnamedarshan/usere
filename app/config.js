export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
  publicKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  rpcUrl: import.meta.env.VITE_SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
};
export const configured = Boolean(config.supabaseUrl && config.publicKey && !config.supabaseUrl.includes("YOUR_PROJECT"));
