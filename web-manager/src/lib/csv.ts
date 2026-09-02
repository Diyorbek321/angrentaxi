/**
 * Client-side CSV export — the operator's universal escape hatch
 * (data-tables.md). Pure blob download, no extra endpoint.
 *
 * Excel needs the BOM to open Uzbek text as UTF-8, and every cell goes
 * through one escape so a reason with a comma never shifts columns.
 */

export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds the file and hands it to the browser as `<name>-YYYY-MM-DD.csv`. */
export function downloadCsv(baseName: string, header: string[], rows: CsvCell[][]): void {
  const lines = rows.map((row) => row.map(escapeCell).join(','));
  const csv = '﻿' + [header.map(escapeCell).join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${baseName}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
