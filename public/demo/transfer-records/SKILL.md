# Supplied Solana transfer records to CSV

## Purpose and when to use
Convert an explicitly supplied array of native SOL transfer records into stable CSV. Use for small offline exports. This demo was verified against the synthetic fixture in examples/transfer-records. No wallet access or RPC call is needed.

## Prerequisites
An existing agent capable of reading JSON and producing text, or JavaScript with BigInt. Ask before writing files. Never request credentials, wallet signatures, or private conversation history.

## Input
One JSON array. Every record must contain these fields:
- signature: nonempty synthetic or real transaction signature string.
- instruction_index: nonnegative safe integer distinguishing transfers within a transaction.
- timestamp: ISO UTC string with seconds, e.g. 2026-10-07T10:00:00Z.
- source and destination: nonempty supplied address strings.
- lamports: unsigned base-10 integer string (never a floating-point number).

Reject invalid records and explain the field that failed. This shape is already normalized; raw RPC transactions and token transfers are unsupported.

## Steps
1. Validate the entire array before producing an export. Preserve input order.
2. Identify duplicates using the pair (signature, instruction_index). If two records with that pair differ, stop and report the conflict; do not silently pick one.
3. Keep the first identical duplicate and report the number removed outside the CSV.
4. Produce this exact header: signature,instruction_index,timestamp,source,destination,lamports,sol
5. Calculate sol using integer division and remainder of BigInt(lamports) by 1000000000. Pad the fractional remainder to nine digits and remove trailing zeros. Omit the decimal point if the remainder is zero.
6. For CSV safety, prefix a text cell beginning with =, +, -, or @ with an apostrophe. Quote cells containing a comma, double quote, CR, or LF; double embedded double quotes.
7. Join rows with LF and include one final LF. Report the kept record count and duplicates removed separately.

## Output and synthetic example
Input:
[{"signature":"demo-tx-1","instruction_index":0,"timestamp":"2026-10-07T10:00:00Z","source":"demo-wallet-A","destination":"demo-wallet-B","lamports":"1250000000"}]

Expected CSV:
signature,instruction_index,timestamp,source,destination,lamports,sol
demo-tx-1,0,2026-10-07T10:00:00Z,demo-wallet-A,demo-wallet-B,1250000000,1.25

Summary: 1 kept, 0 duplicates removed. All values are synthetic.

## Limitations
Does not fetch transaction history, validate addresses on-chain, classify transactions, calculate fees or taxes, handle SPL tokens, or prove supplied data is accurate. Not every agent produces identical output: compare the result with the example before use. Spreadsheet tools may interpret cells differently; use explicit text import for untrusted data.

## Reuse terms
This original demo file may be used, modified, and shared without payment. No warranty. Do not claim your modified workflow was tested until you test it.
