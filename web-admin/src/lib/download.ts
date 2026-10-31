/**
 * Server qaytargan faylni (masalan, CSV blob — panel proksisi orqali)
 * brauzerda yuklab olish. DOM bog'liqligi argument sifatida — testda soxta
 * `document`/`URL` beriladi.
 */

export interface DownloadEnv {
  document: Pick<Document, 'createElement'> & { body: Pick<HTMLElement, 'appendChild' | 'removeChild'> };
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
}

export function triggerBlobDownload(blob: Blob, filename: string, env?: DownloadEnv): void {
  const doc = env?.document ?? document;
  const urlApi = env?.url ?? URL;
  const href = urlApi.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  doc.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    doc.body.removeChild(anchor);
    urlApi.revokeObjectURL(href);
  }
}

/** `soliq-1foiz-2026-10.csv` — oy formati backend bilan bir xil. */
export function taxReportFilename(month: string): string {
  return `soliq-1foiz-${month}.csv`;
}
