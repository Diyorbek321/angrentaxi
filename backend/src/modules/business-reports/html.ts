/** Telegram HTML rejimi uchun — foydalanuvchi kiritgan matn (ismlar) teg bo'lib qolmasin. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
