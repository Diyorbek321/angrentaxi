/**
 * Haydovchi / kuryer ofertasi + xulq kodeksi — `/legal/driver-terms`.
 *
 * ⚠️ QORALAMA — yurist ko'rib chiqishi kerak. Raqamlar `TermsContext.policy`
 * dan: komissiya — jonli sozlama, qolgani docs/INCIDENT-POLICY.md §3, §5
 * standartlari. E'tiroz muddati (`appealWindowDays`) siyosatda yo'q — taklif.
 * Mazmunan o'zgarsa — `LEGAL_VERSIONS['driver-terms']` ni oshiring
 * (haydovchilar qayta qabul qilmaguncha onlayn chiqa olmaydi).
 */
import { LegalLang, LegalPage } from '../account-deletion/legal-pages.content';
import { som } from './legal-policy';
import { TermsContext, draftBanner } from './legal-terms-context';
import { LEGAL_VERSIONS } from './legal-versions';

export function driverTermsPage(lang: LegalLang, c: TermsContext): LegalPage {
  return lang === 'ru' ? driverRu(c) : driverUz(c);
}

function driverUz(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS['driver-terms'].version;
  return {
    title: 'Haydovchi va kuryer ofertasi',
    draft: draftBanner('uz', v),
    intro: `${c.operator} ("Platforma") va Angren Taxi Driver ilovasi orqali ishlovchi haydovchi yoki kuryer ("Ijrochi") o'rtasidagi ommaviy oferta va xulq kodeksi. Tahrir: ${v}.`,
    sections: [
      {
        h: '1. Oferta va uni qabul qilish',
        p: [
          "Ilovada \"Qabul qilaman\" tugmasini bosish — ofertani to'liq qabul qilish. Qabul qilingan tahrir, sana, IP va ilova versiyasi saqlanadi. Joriy tahrir qabul qilinmaguncha onlayn chiqib bo'lmaydi.",
        ],
      },
      {
        h: '2. Ijrochining maqomi',
        li: [
          "Ijrochi mustaqil: o'zini o'zi band qilgan shaxs yoki yakka tadbirkor. Platforma bilan mehnat munosabati yo'q; ish vaqti va buyurtmani qabul qilish — Ijrochining o'z qarori.",
          "Taksi uchun Vazirlar Mahkamasining 200-son qarori talablari: hudud uchun litsenziya varaqasi, O'zbekiston fuqaroligi, kamida 21 yosh, B toifa va staj, avtomobil yoshi, tibbiy va texnik ko'rik, tashuvchining fuqarolik javobgarligi sug'urtasi. Hujjatlar ilovadagi \"Hujjatlar\" bo'limida yuklanadi va muddatida yangilanadi.",
          "Soliq maqomi, JShShIR va (YaTT uchun) STIR to'g'ri kiritilishi shart — ular soliq hisoboti va fiskal cheklarda ishlatiladi.",
        ],
      },
      {
        h: '3. Platforma xizmati va komissiya',
        li: [
          "Platforma buyurtmalarni taklif qiladi, navigatsiya, to'lov qabul qilish, cheklar va qo'llab-quvvatlashni ta'minlaydi.",
          `Har bir yakunlangan safar/yetkazish uchun komissiya — chegirmadan keyingi yakuniy narxning ${p.commissionRate}% (platforma belgilaydi; shaxsiy stavka yoki faol kunlik smena bo'lsa — o'sha qo'llanadi). Chaqiriq (tip) komissiyasiz.`,
          "Qonun talab qilgan hollarda Platforma soliq agenti sifatida daromaddan soliqni (1%) ushlab qoladi va hisobot beradi.",
          "Har safarning daromadi, komissiya va ushlab qolingan summalar ilovadagi \"Daromad\" ekranida ko'rinadi.",
        ],
      },
      {
        h: '4. Naqd pul va hamyon',
        li: [
          "Naqd safarda Ijrochi pulni yo'lovchidan o'zi oladi; komissiya va ushlab qolinadigan summa ilovadagi hamyondan yechiladi.",
          "Hamyon balansi manfiy bo'lsa — onlayn chiqib bo'lmaydi, avval qarzni yoping (ilovada to'ldirish).",
          "Kuryer naqd ovqat/market buyurtmasida tovar pulini sotuvchiga ilovadagi tartibda to'laydi (qonun talab qilgan sanadan — faqat hamyon orqali elektron o'tkazma). Mijoz rad etib, tovar do'konga qaytarilsa, sotuvchi tasdiqlagach kuryer to'lagan pul qaytariladi.",
          "Mijozdan ilovada ko'rsatilgandan ortiq pul so'rash taqiqlanadi.",
        ],
      },
      {
        h: '5. Yuk va posilka uchun javobgarlik',
        li: [
          "Olishda posilkani ko'zdan kechiring; shikastlangan yoki taqiqlangan narsani (pul, hujjat, qurol, dori, alkogol, tirik hayvon, giyohvand modda) olmang — ilovada sabab bilan rad eting.",
          `Posilka olingandan to topshirilgunga qadar Ijrochi uning butligi uchun e'lon qilingan qiymat doirasida javob beradi (eng ko'pi ${som(p.parcelMaxDeclaredValue)} so'm).`,
          `Buyurtma faqat ${p.handoffCodeDigits} raqamli topshirish kodini aytgan odamga topshiriladi. Kodsiz topshirish — Ijrochining javobgarligi.`,
          `Manzilda ${p.dropoffFreeWaitMinutes} daqiqa bepul kutiladi; qabul qiluvchi bo'lmasa yoki rad etsa, kutish tugagach "Yetkazib bo'lmadi" deb belgilang va buyurtmani qaytaring — yetkazish va qaytarish haqi (${p.returnFeePercent}%) sizga to'lanadi.`,
          "Yo'qolish yoki buzilish hodisasini menejer ko'rib chiqadi; aybingiz tasdiqlansa, kompensatsiya hamyondan ushlab qolinishi mumkin (qaror sababi bilan, audit logda).",
        ],
      },
      {
        h: '6. Xulq kodeksi',
        li: [
          "Yo'lovchi, mijoz va sotuvchiga hurmat; haqorat, tahdid, ta'qib, bezorilik — taqiqlangan.",
          "Yo'l harakati qoidalariga rioya qiling; xavfli haydash, telefonni qo'lda ushlab haydash taqiqlanadi.",
          "Mashinada chekmang; salon toza va ozoda bo'lsin.",
          "Eng qisqa yoki ilova ko'rsatgan yo'ldan yuring; ataylab aylanma yo'l va ortiqcha narx so'rash — qoidabuzarlik.",
          "Yo'lovchini ilovadan tashqari safarga undash, uning raqami yoki ma'lumotidan shaxsiy maqsadda foydalanish taqiqlanadi.",
          "Mast holda yoki dori ta'sirida ishlash qat'iyan taqiqlanadi.",
          "Hisobni boshqaga berish, soxta buyurtma, soxta GPS — darhol blok.",
        ],
      },
      {
        h: "7. Bekor qilish va yo'lovchi kelmasligi",
        li: [
          `Yo'lovchi qabuldan ${p.freeCancelMinutes} daqiqadan keyin (yoki siz yetib kelgach) bekor qilsa — ${som(p.lateCancelFee)} so'm jarima sizga o'tadi.`,
          `Yetib kelgandan keyin ${p.noShowWaitMinutes} daqiqa kutib, yo'lovchi chiqmasa — "Yo'lovchi chiqmadi" deb belgilang; ${som(p.noShowFee)} so'm sizga o'tadi.`,
          "Asossiz ko'p bekor qilish va qabul qilingan buyurtmani bajarmaslik — shikoyat sifatida hisoblanadi.",
          "Safar avariya yoki buzilish tufayli uzilsa, shu nuqtagacha bo'lgan narx sizga to'lanadi.",
        ],
      },
      {
        h: '8. Shikoyatlar va jarima zinapoyasi',
        p: [
          `Shikoyatni yo'lovchi, mijoz, sotuvchi yoki menejer safardan keyin ${p.complaintWindowDays} kun ichida ochadi. Tizim faqat signal beradi — qarorni har doim odam (menejer) qabul qiladi. Hisob ${p.strikeWindowDays} kunlik oynada tasdiqlangan shikoyatlar bo'yicha:`,
        ],
        li: [
          `${p.strikeWarningAt} ta — ogohlantirish (push va ilovada).`,
          `${p.strikeSuspendAt} ta — ${p.suspensionDays} kunga vaqtincha to'xtatish.`,
          `${p.strikeBlockAt} ta — blok (admin ko'rib chiqadi).`,
          "Bezorilik, ta'qib yoki xavfsizlikka tahdid — birinchi holatdayoq darhol to'xtatish, qarorni admin qabul qiladi.",
          `Reyting: oxirgi ${p.ratingSignalCount} ta baho o'rtachasi ${p.ratingSignalThreshold} dan past bo'lsa, menejer holatni ko'rib chiqadi (avtomatik jazo emas).`,
        ],
      },
      {
        h: "9. To'xtatish, blok va e'tiroz",
        li: [
          "Har bir chora sababi bilan push va ilovada xabar qilinadi.",
          `Qarorga rozi bo'lmasangiz, ${p.appealWindowDays} kun ichida ilovadagi "Yordam" orqali e'tiroz yuboring va dalil qo'shing. E'tirozni qarorni chiqargan menejer emas, boshqa menejer yoki admin ko'rib chiqadi.`,
          "E'tiroz qanoatlantirilsa, chora bekor qilinadi va yozuv tarixdan chiqariladi; noto'g'ri ushlab qolingan pul hamyonga qaytariladi.",
          "Shundan keyin ham nizo hal bo'lmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq sud orqali.",
        ],
      },
      {
        h: '10. Xavfsizlik va dalillar',
        li: [
          "SOS tugmasi dispetcherga darhol signal beradi; hayotga xavf bo'lsa, avval 102/103.",
          "Telefon raqamlari tomonlarga ko'rsatilmaydi — qo'ng'iroq ilova orqali, har chaqiruv yoziladi.",
          `Onlayn paytdagi GPS izi, chat va hodisa suratlari ${p.evidenceRetentionDays} kun saqlanadi va nizoni hal qilishda ishlatiladi.`,
        ],
      },
      {
        h: '11. Javobgarlik',
        li: [
          "Yo'lovchi oldida tashuvchi sifatida Ijrochi javob beradi; tashuvchining majburiy sug'urtasi amal qilishi shart.",
          "Yo'l harakati jarimalari, avtomobil va yoqilg'i xarajatlari — Ijrochining o'zi.",
          "Platforma Ijrochining qonunga zid harakati uchun javob bermaydi va undan kelgan zararni talab qilishga haqli.",
        ],
      },
      {
        h: '12. Shartnomani tugatish',
        li: [
          "Ijrochi istalgan vaqtda ishlashni to'xtatishi va hisobini o'chirishi mumkin — avval faol buyurtma va hamyon qarzi yopiladi.",
          "Platforma qoidalar jiddiy buzilganda yoki talablar (hujjat muddati, litsenziya) bajarilmasa xizmatni to'xtatishi mumkin.",
        ],
      },
      {
        h: "13. Ma'lumotlar va o'zgartirish",
        li: [
          `Shaxsga doir ma'lumotlar — maxfiylik siyosati: ${c.privacyUrl}`,
          "Platforma ofertani o'zgartirishi mumkin; yangi tahrir ilovada \"nima o'zgardi\" bilan ko'rsatiladi va keyingi onlayn chiqishdan oldin qabul qilinadi. Faol safar eski shartlarda yakunlanadi.",
        ],
      },
      {
        h: '14. Aloqa',
        p: [`${c.operator}. Qo'llab-quvvatlash: ${c.supportPhone} yoki ilovadagi "Yordam" bo'limi.`],
      },
    ],
  };
}

function driverRu(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS['driver-terms'].version;
  return {
    title: 'Оферта для водителей и курьеров',
    draft: draftBanner('ru', v),
    intro: `Публичная оферта и кодекс поведения между ${c.operator} («Платформа») и водителем или курьером, работающим через приложение Angren Taxi Driver («Исполнитель»). Редакция: ${v}.`,
    sections: [
      {
        h: '1. Оферта и её принятие',
        p: [
          'Нажатие кнопки «Принимаю» в приложении — полное принятие оферты. Принятая редакция, дата, IP и версия приложения сохраняются. Пока текущая редакция не принята, выйти на линию нельзя.',
        ],
      },
      {
        h: '2. Статус Исполнителя',
        li: [
          'Исполнитель независим: самозанятый или индивидуальный предприниматель. Трудовых отношений с Платформой нет; время работы и принятие заказа — решение самого Исполнителя.',
          'Для такси — требования постановления Кабинета Министров № 200: лицензионная карточка на регион, гражданство Узбекистана, возраст от 21 года, категория B и стаж, возраст автомобиля, медицинский и технический осмотр, страхование гражданской ответственности перевозчика. Документы загружаются в разделе «Документы» и обновляются вовремя.',
          'Налоговый статус, ПИНФЛ и (для ИП) ИНН должны быть указаны верно — они используются в налоговой отчётности и фискальных чеках.',
        ],
      },
      {
        h: '3. Услуга Платформы и комиссия',
        li: [
          'Платформа предлагает заказы, обеспечивает навигацию, приём оплаты, чеки и поддержку.',
          `За каждую завершённую поездку/доставку комиссия — ${p.commissionRate}% от итоговой цены после скидки (устанавливает платформа; при персональной ставке или активной дневной смене применяется она). Чаевые — без комиссии.`,
          'В случаях, предусмотренных законом, Платформа как налоговый агент удерживает налог с дохода (1%) и сдаёт отчётность.',
          'Доход, комиссия и удержания по каждой поездке видны на экране «Доход».',
        ],
      },
      {
        h: '4. Наличные и кошелёк',
        li: [
          'В поездке за наличные Исполнитель сам получает деньги от пассажира; комиссия и удержания списываются с кошелька в приложении.',
          'При отрицательном балансе кошелька выйти на линию нельзя — сначала погасите долг (пополнение в приложении).',
          'Курьер в заказе еды/маркета за наличные оплачивает товар продавцу в порядке, указанном в приложении (с даты, установленной законом, — только электронным переводом через кошелёк). Если клиент отказался и товар возвращён в заведение, после подтверждения продавцом курьеру возвращаются уплаченные деньги.',
          'Требовать с клиента больше суммы, указанной в приложении, запрещено.',
        ],
      },
      {
        h: '5. Ответственность за груз и посылки',
        li: [
          'При получении осмотрите посылку; не принимайте повреждённое или запрещённое (деньги, документы, оружие, лекарства, алкоголь, живые животные, наркотики) — откажите в приложении с указанием причины.',
          `С момента получения до передачи Исполнитель отвечает за сохранность посылки в пределах объявленной ценности (максимум ${som(p.parcelMaxDeclaredValue)} сум).`,
          `Заказ передаётся только тому, кто назовёт ${p.handoffCodeDigits}-значный код передачи. Передача без кода — ответственность Исполнителя.`,
          `На адресе ${p.dropoffFreeWaitMinutes} мин бесплатного ожидания; если получателя нет или он отказался, после ожидания отметьте «Не удалось доставить» и верните заказ — доставка и плата за возврат (${p.returnFeePercent}%) оплачиваются вам.`,
          'Инцидент утери или повреждения рассматривает менеджер; при подтверждении вашей вины компенсация может быть удержана из кошелька (решение с причиной, в журнале аудита).',
        ],
      },
      {
        h: '6. Кодекс поведения',
        li: [
          'Уважение к пассажиру, клиенту и продавцу; оскорбления, угрозы, преследование, хулиганство запрещены.',
          'Соблюдайте ПДД; опасное вождение и использование телефона в руке за рулём запрещены.',
          'Не курите в машине; салон должен быть чистым и опрятным.',
          'Езжайте кратчайшим или указанным приложением маршрутом; умышленный объезд и завышение цены — нарушение.',
          'Запрещено склонять пассажира к поездке вне приложения, использовать его номер или данные в личных целях.',
          'Работа в состоянии опьянения или под действием препаратов строго запрещена.',
          'Передача аккаунта другому лицу, фиктивные заказы, подмена GPS — немедленная блокировка.',
        ],
      },
      {
        h: '7. Отмена и неявка пассажира',
        li: [
          `Если пассажир отменил заказ позже ${p.freeCancelMinutes} мин после принятия (или после вашего прибытия) — штраф ${som(p.lateCancelFee)} сум передаётся вам.`,
          `Если после прибытия вы прождали ${p.noShowWaitMinutes} мин и пассажир не вышел — отметьте «Пассажир не вышел»; ${som(p.noShowFee)} сум передаются вам.`,
          'Частые необоснованные отмены и невыполнение принятого заказа учитываются как жалобы.',
          'Если поездка прервана из-за аварии или поломки, вам оплачивается путь до этой точки.',
        ],
      },
      {
        h: '8. Жалобы и лестница санкций',
        p: [
          `Жалобу открывает пассажир, клиент, продавец или менеджер в течение ${p.complaintWindowDays} дн после поездки. Система только подаёт сигнал — решение всегда принимает человек (менеджер). Учитываются подтверждённые жалобы за ${p.strikeWindowDays} дн:`,
        ],
        li: [
          `${p.strikeWarningAt} — предупреждение (push и в приложении).`,
          `${p.strikeSuspendAt} — приостановка на ${p.suspensionDays} дн.`,
          `${p.strikeBlockAt} — блокировка (рассматривает администратор).`,
          'Хулиганство, преследование или угроза безопасности — немедленная приостановка уже при первом случае, решение принимает администратор.',
          `Рейтинг: если среднее последних ${p.ratingSignalCount} оценок ниже ${p.ratingSignalThreshold}, ситуацию рассматривает менеджер (не автоматическое наказание).`,
        ],
      },
      {
        h: '9. Приостановка, блокировка и обжалование',
        li: [
          'О каждой мере с причиной сообщается push-уведомлением и в приложении.',
          `Если вы не согласны, в течение ${p.appealWindowDays} дн отправьте обжалование через «Помощь» в приложении и приложите доказательства. Обжалование рассматривает не тот менеджер, что принял решение, а другой менеджер или администратор.`,
          'Если обжалование удовлетворено, мера отменяется и запись исключается из истории; неправомерно удержанные деньги возвращаются в кошелёк.',
          'Если спор не решён и после этого — в судебном порядке по законодательству Республики Узбекистан.',
        ],
      },
      {
        h: '10. Безопасность и доказательства',
        li: [
          'Кнопка SOS сразу подаёт сигнал диспетчеру; при угрозе жизни сначала звоните 102/103.',
          'Номера телефонов сторонам не показываются — звонок через приложение, каждый вызов фиксируется.',
          `GPS-трек на линии, чат и фото инцидентов хранятся ${p.evidenceRetentionDays} дн и используются для разрешения споров.`,
        ],
      },
      {
        h: '11. Ответственность',
        li: [
          'Перед пассажиром как перевозчик отвечает Исполнитель; обязательное страхование перевозчика должно действовать.',
          'Штрафы ПДД, расходы на автомобиль и топливо — за счёт Исполнителя.',
          'Платформа не отвечает за противоправные действия Исполнителя и вправе требовать возмещения причинённого ими ущерба.',
        ],
      },
      {
        h: '12. Прекращение договора',
        li: [
          'Исполнитель может в любое время прекратить работу и удалить аккаунт — сначала закрываются активный заказ и долг кошелька.',
          'Платформа может прекратить обслуживание при серьёзном нарушении правил или невыполнении требований (срок документов, лицензия).',
        ],
      },
      {
        h: '13. Данные и изменения',
        li: [
          `Персональные данные — политика конфиденциальности: ${c.privacyUrl}`,
          'Платформа может изменять оферту; новая редакция показывается в приложении с описанием изменений и принимается перед следующим выходом на линию. Активная поездка завершается на прежних условиях.',
        ],
      },
      {
        h: '14. Контакты',
        p: [`${c.operator}. Поддержка: ${c.supportPhone} или раздел «Помощь» в приложении.`],
      },
    ],
  };
}
