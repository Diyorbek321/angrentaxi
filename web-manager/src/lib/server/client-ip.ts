import { isIP } from "node:net";

/**
 * Backend limiti (`@nestjs/throttler`) IP boshiga hisoblanadi. Panel o'z
 * serveridan backendga so'rov yuborganda backend faqat PANEL IP'sini ko'radi —
 * shunda paneldagi barcha foydalanuvchilar bitta limitni bo'lishardi (masalan,
 * OTP: hammaga daqiqasiga 5 ta). Shuning uchun haqiqiy mijoz IP'si uzatiladi.
 *
 * Ishonch: `X-Forwarded-For` ning faqat OXIRGI qiymati olinadi — uni panel
 * oldidagi bitta proksi (Railway chekkasi) qo'shadi; mijoz yozgan qiymatlar
 * undan oldin turadi. Backend ham `trust proxy 1` bilan oxirgi qiymatni oladi.
 * Sarlavha yo'q yoki IP emas — hech narsa uzatilmaydi (avvalgi xatti-harakat).
 */
export function clientIp(headers: Headers): string | null {
  const hops = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  const last = hops[hops.length - 1];
  return last && isIP(last) ? last : null;
}

/** Backendga ketadigan `fetch` sarlavhalariga qo'shiladi. */
export function clientIpHeaders(headers: Headers): Record<string, string> {
  const ip = clientIp(headers);
  return ip ? { "x-forwarded-for": ip } : {};
}
