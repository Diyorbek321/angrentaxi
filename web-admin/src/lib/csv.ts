/**
 * Mijoz tomonidagi CSV eksport — allaqachon yuklangan jadval qatorlaridan.
 * Yangi API chaqirig'i YO'Q: operator ekranda ko'rib turgan ma'lumotning o'zi
 * jadval-dan-qochish luki (spreadsheet escape hatch) sifatida yuklab olinadi.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(raw: string | number | null | undefined): string {
  const text = raw == null ? '' : String(raw);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  // ﻿ (BOM) — Excel UTF-8 ni to'g'ri ochishi uchun.
  const blob = new Blob(['﻿' + buildCsv(columns, rows)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
