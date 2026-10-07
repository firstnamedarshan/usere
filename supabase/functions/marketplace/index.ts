import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createMarketplaceHandler } from "./handler.js";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createMarketplaceHandler({
  db,
  config: {
    adminWallet: Deno.env.get("ADMIN_WALLET_ADDRESS") || "",
    origins: (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://localhost:4174").split(",").map((value) => value.trim()).filter(Boolean),
    rpcUrl: Deno.env.get("SOLANA_DEVNET_RPC_URL") || "https://api.devnet.solana.com",
  },
}));
