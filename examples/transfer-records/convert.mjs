export function transferRecordsToCsv(records) {
  if (!Array.isArray(records)) throw new Error("Expected a JSON array.");
  const kept = [];
  const seen = new Map();
  let duplicates = 0;
  for (const record of records) {
    for (const field of ["signature", "source", "destination"]) if (typeof record?.[field] !== "string" || !record[field].trim()) throw new Error(`Invalid ${field}.`);
    if (!Number.isSafeInteger(record.instruction_index) || record.instruction_index < 0) throw new Error("Invalid instruction_index.");
    if (typeof record.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(record.timestamp) || new Date(record.timestamp).toISOString() !== record.timestamp.replace("Z", ".000Z")) throw new Error("Invalid timestamp.");
    if (typeof record.lamports !== "string" || !/^\d+$/.test(record.lamports)) throw new Error("Invalid lamports; use an integer string.");
    const canonical = [record.signature, record.instruction_index, record.timestamp, record.source, record.destination, record.lamports];
    const key = JSON.stringify([record.signature, record.instruction_index]);
    if (seen.has(key)) {
      if (seen.get(key) !== JSON.stringify(canonical)) throw new Error("Conflicting duplicate transfer.");
      duplicates++;
      continue;
    }
    seen.set(key, JSON.stringify(canonical));
    const amount = BigInt(record.lamports);
    const fraction = String(amount % 1_000_000_000n).padStart(9, "0").replace(/0+$/, "");
    const sol = `${amount / 1_000_000_000n}${fraction ? "." + fraction : ""}`;
    kept.push([...canonical, sol]);
  }
  function cell(value) {
    let text = String(value);
    if (/^[=+@-]/.test(text)) text = "'" + text;
    if (/[",\r\n]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
    return text;
  }
  return { csv: "signature,instruction_index,timestamp,source,destination,lamports,sol\n" + kept.map((row) => row.map(cell).join(",") + "\n").join(""), kept: kept.length, duplicates };
}
