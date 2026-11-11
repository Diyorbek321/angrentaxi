/** Telegram HTML rejimi uchun — foydalanuvchi kiritgan matn (ismlar) teg bo'lib qolmasin. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Kutish muddati: 48 soatgacha soatda, undan uzoq — kunda ("114 kun"). */
export function formatWait(hours: number): string {
  return hours < 48 ? `${hours} soat` : `${Math.floor(hours / 24)} kun`;
}
