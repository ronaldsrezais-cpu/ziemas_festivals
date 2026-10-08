export function contactCsv(rows: string[][]) {
  const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  return "\uFEFF" + [["Skola", "Novads / pilsēta", "Komandas vadītājs", "Amats", "E-pasts"], ...rows].map(row => row.map(cell).join(";")).join("\r\n");
}
