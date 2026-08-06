/**
 * Browser-side CSV export. There is no reporting endpoint to hit — the rows
 * are built from data the page already has and handed to the browser as a
 * Blob, so nothing round-trips to the backend.
 */

function escapeCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  // Quote when the cell could otherwise break the row apart.
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  // The BOM is what makes Excel read the file as UTF-8 — without it the
  // Uzbek apostrophes and o‘/g‘ come out mangled.
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
