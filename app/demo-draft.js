// Open sample content for the real upload/review/purchase acceptance journey.
// Loading this draft never creates a listing or grants ownership.
export const transferDemoListing = {
  title: "Transfer records to CSV — demo",
  description: "Convert supplied native SOL transfer records into stable CSV, with exact lamport-to-SOL amounts and duplicate checks. Open demo content for testing this marketplace.",
  category: "Solana data",
  price: "0.01",
  expected_input: '[{"signature":"demo-tx-1","instruction_index":0,"timestamp":"2026-10-07T10:00:00Z","source":"demo-wallet-A","destination":"demo-wallet-B","lamports":"1250000000"}]',
  expected_output: "signature,instruction_index,timestamp,source,destination,lamports,sol\ndemo-tx-1,0,2026-10-07T10:00:00Z,demo-wallet-A,demo-wallet-B,1250000000,1.25\nSummary: 1 record kept, 0 duplicates removed.",
  requirements: "An existing agent that can read JSON and produce CSV, or JavaScript with BigInt. No wallet access, RPC, or credentials are required to use this skill.",
  limitations: "Supports already normalized native SOL transfer records only. Does not fetch wallet history, handle SPL tokens, calculate fees or taxes, or prove supplied data is accurate. Tested against the included synthetic example.",
  reuse_terms: "This original demo is open content: use, modify, and share without payment. The 0.01 Devnet SOL checkout is only an acceptance test. No warranty.",
};
