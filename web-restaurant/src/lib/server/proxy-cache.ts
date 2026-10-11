/**
 * Katalog rasmi (`media/catalog/<uuid>.jpg`) hech qachon joyida o'zgarmaydi —
 * yangi rasm yangi kalit oladi — shuning uchun brauzer uni qayta so'ramasin.
 * `private`: javob shu foydalanuvchi brauzerida qoladi, umumiy keshga tushmaydi.
 * Qolgan hamma narsa sessiyaga bog'liq, shuning uchun `no-store`.
 */
export function cacheControlFor(method: string, segments: string[], status: number): string {
  const isCatalogImage = method === 'GET' && segments[0] === 'media' && segments[1] === 'catalog';
  return isCatalogImage && status === 200 ? 'private, max-age=31536000, immutable' : 'no-store';
}
