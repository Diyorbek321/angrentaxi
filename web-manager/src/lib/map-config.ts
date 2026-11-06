/**
 * Xarita plitkalari — MapTiler Cloud.
 *
 * Ilgari OSM'ning bepul `{s}.tile.openstreetmap.org` serveri ishlatilardi; u
 * ishlab chiqarish trafigi uchun mo'ljallanmagan (subdomenlar eskirgan,
 * rate-limit bor). Kalit brauzerga tushadi — MapTiler kalitlari aynan shunga
 * mo'ljallangan (himoya MapTiler panelidagi domen cheklovi orqali qilinadi).
 */
// ⚠️ ZAXIRA KALIT YO'Q — ataylab. Repoda turgan kalit skrap qilinadi va
// kvotani begona odam sarflaydi. `.env.local` da NEXT_PUBLIC_MAPTILER_KEY
// berilishi kerak; bo'sh qolsa xarita plitkalari yuklanmaydi.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

/** MapTiler uslubi: streets-v2, basic-v2, bright-v2, streets-v2-dark ... */
const MAPTILER_STYLE = process.env.NEXT_PUBLIC_MAPTILER_STYLE || 'streets-v2';

/**
 * 512px plitkalar (@2x — Retina). Leaflet'da `tileSize={512} zoomOffset={-1}`
 * bilan birga ishlatilishi shart, aks holda masshtab bir daraja siljiydi.
 */
export const MAP_TILE_URL = `https://api.maptiler.com/maps/${MAPTILER_STYLE}/{z}/{x}/{y}@2x.png?key=${MAPTILER_KEY}`;
