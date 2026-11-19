// Public legal pages linked from the App Store / Google Play listings and from
// inside the mobile apps. Plain server-rendered HTML so they stay reachable
// without any frontend deploy. Contact address: keep in sync with the store
// listing's "Support URL / email".
export const SUPPORT_EMAIL = 'support@angrentaxi.uz';
const UPDATED = '2026-11-19';

function page(title: string, body: string): string {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Angren Taxi</title>
<style>
body{font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;color:#111A17;background:#fff}
h1{font-size:26px;color:#0C7A4D}h2{font-size:19px;margin-top:28px}a{color:#0C7A4D}
.muted{color:#5b6b66;font-size:14px}
@media (prefers-color-scheme:dark){body{background:#111A17;color:#E8F0ED}h1,a{color:#6FE4B8}.muted{color:#9fb1ab}}
</style></head><body>${body}
<p class="muted">Oxirgi yangilanish: ${UPDATED} · Aloqa: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
</body></html>`;
}

export const PRIVACY_HTML = page('Maxfiylik siyosati', `
<h1>Maxfiylik siyosati</h1>
<p>Ushbu siyosat «Angren Taxi» (yo'lovchi) va «Angren Taxi Driver» (haydovchi) mobil ilovalari hamda tegishli xizmatlar foydalanuvchilarining shaxsiy ma'lumotlari qanday yig'ilishi, ishlatilishi va himoya qilinishini tushuntiradi.</p>
<h2>1. Qanday ma'lumotlarni yig'amiz</h2>
<ul>
<li><b>Telefon raqami</b> — SMS kod orqali tizimga kirish uchun.</li>
<li><b>Ism va familiya</b> — buyurtmada haydovchi/yo'lovchiga ko'rsatish uchun (ixtiyoriy).</li>
<li><b>Joylashuv</b> — yo'lovchi uchun: ilova ochiq bo'lganda olib ketish manzilini aniqlash. Haydovchi uchun: «Onlayn» rejimda, ilova fonda bo'lsa ham, yaqin buyurtmalarni taqsimlash va yo'lovchiga mashina harakatini ko'rsatish uchun. Haydovchi «Oflayn» rejimga o'tganda joylashuv yuborilmaydi.</li>
<li><b>Buyurtmalar tarixi</b> — manzillar, narx, sana, baholar.</li>
<li><b>Haydovchi hujjatlari</b> — haydovchilik guvohnomasi, texpasport va avtomobil fotosuratlari (faqat haydovchilar uchun, tekshiruv maqsadida).</li>
<li><b>Qurilma ma'lumotlari</b> — push-bildirishnoma tokeni.</li>
<li><b>To'lov ma'lumotlari</b> — karta ma'lumotlari bizda saqlanmaydi; to'lov Payme/Click/Uzcard sahifalarida amalga oshiriladi, biz faqat tranzaksiya natijasini olamiz.</li>
</ul>
<h2>2. Ma'lumotlardan foydalanish</h2>
<p>Ma'lumotlar faqat xizmatni ko'rsatish uchun ishlatiladi: buyurtmani haydovchiga bog'lash, narxni hisoblash, xavfsizlik (SOS), qo'llab-quvvatlash, firibgarlikka qarshi kurash va bildirishnomalar yuborish. Biz ma'lumotlarni reklama maqsadida sotmaymiz va uchinchi tomonlarga kuzatuv (tracking) uchun bermaymiz.</p>
<h2>3. Ma'lumotlarni kimga beramiz</h2>
<ul>
<li>Safar davomida yo'lovchi va haydovchi bir-birining ismi, telefon raqami va joylashuvini ko'radi.</li>
<li>Xizmat ko'rsatuvchilar: server hosting, SMS provayder, Firebase (push bildirishnomalar), to'lov tizimlari.</li>
<li>Qonun talab qilgan hollarda — vakolatli davlat organlariga.</li>
</ul>
<h2>4. Saqlash muddati</h2>
<p>Ma'lumotlar hisob faol bo'lgan davrda saqlanadi. Hisob o'chirilgach shaxsiy ma'lumotlar (telefon, ism, push token, saqlangan manzillar) darhol o'chiriladi; buxgalteriya hisobi uchun qonun talab qiladigan anonim tranzaksiya yozuvlari saqlanib qolishi mumkin.</p>
<h2>5. Hisobni o'chirish</h2>
<p>Hisobni istalgan vaqtda ilova ichida o'chirish mumkin: <b>Profil → Hisobni o'chirish</b>. Batafsil: <a href="./delete-account">hisobni o'chirish yo'riqnomasi</a>.</p>
<h2>6. Sizning huquqlaringiz</h2>
<p>Siz o'z ma'lumotlaringizni ko'rish, tuzatish yoki o'chirishni so'rashingiz mumkin. Joylashuv va bildirishnoma ruxsatlarini qurilma sozlamalarida istalgan vaqtda o'chirish mumkin.</p>
<h2>7. Bolalar</h2>
<p>Xizmat 16 yoshdan kichik shaxslarga mo'ljallanmagan.</p>
<h2>8. O'zgarishlar</h2>
<p>Siyosat o'zgarsa, yangilangan matn shu sahifada e'lon qilinadi.</p>
`);

export const TERMS_HTML = page('Foydalanish shartlari', `
<h1>Foydalanish shartlari</h1>
<p>«Angren Taxi» ilovalari yo'lovchilarni mustaqil haydovchilar bilan bog'laydigan platforma hisoblanadi.</p>
<h2>1. Hisob</h2><p>Ro'yxatdan o'tish uchun haqiqiy telefon raqami talab qilinadi. Hisobingiz xavfsizligi uchun siz javobgarsiz.</p>
<h2>2. Buyurtma va to'lov</h2><p>Narx buyurtma berishda ko'rsatiladi va tarif bo'yicha hisoblanadi. To'lov naqd yoki karta orqali amalga oshiriladi. Taksi xizmati jismoniy xizmat bo'lgani uchun to'lovlar ilova do'koni orqali o'tmaydi.</p>
<h2>3. Xulq-atvor</h2><p>Haydovchi va yo'lovchilarga hurmatsizlik, firibgarlik yoki xavfli harakatlar uchun hisob bloklanishi mumkin.</p>
<h2>4. Haydovchilar</h2><p>Haydovchilar tekshiruvdan o'tishi, amaldagi guvohnoma va texnik soz avtomobilga ega bo'lishi shart. Platforma har bir safardan komissiya oladi.</p>
<h2>5. Javobgarlik</h2><p>Platforma qonun doirasida xizmatning uzluksiz ishlashini ta'minlashga harakat qiladi, ammo tarmoq yoki uchinchi tomon xizmatlaridagi uzilishlar uchun javobgar emas.</p>
<h2>6. Maxfiylik</h2><p><a href="./privacy">Maxfiylik siyosati</a>ga qarang.</p>
`);

export const DELETE_ACCOUNT_HTML = page("Hisobni o'chirish", `
<h1>Hisobni o'chirish</h1>
<p>«Angren Taxi» yoki «Angren Taxi Driver» hisobingizni o'chirish uchun:</p>
<ol>
<li>Ilovani oching va tizimga kiring.</li>
<li><b>Profil</b> bo'limiga o'ting.</li>
<li><b>Hisobni o'chirish</b> tugmasini bosing va tasdiqlang.</li>
</ol>
<p>Ilovaga kira olmasangiz, ro'yxatdan o'tgan telefon raqamingizni ko'rsatib <a href="mailto:${SUPPORT_EMAIL}?subject=Hisobni%20o'chirish">${SUPPORT_EMAIL}</a> manziliga yozing — so'rov 30 kun ichida bajariladi.</p>
<h2>Nima o'chiriladi</h2>
<p>Telefon raqam, ism-familiya, push token, saqlangan manzillar o'chiriladi va barcha qurilmalardagi seanslar yopiladi. Qonun bo'yicha saqlanishi shart bo'lgan anonim buyurtma va to'lov yozuvlari shaxsga bog'lanmagan holda qoladi.</p>
`);
