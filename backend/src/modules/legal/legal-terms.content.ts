/**
 * Foydalanuvchi (yo'lovchi / mijoz) ommaviy ofertasi — `/legal/terms`.
 *
 * ⚠️ QORALAMA — yurist ko'rib chiqishi kerak. Raqamlar `TermsContext.policy`
 * dan (docs/INCIDENT-POLICY.md standartlari; komissiya — jonli sozlama).
 * Matn mazmunan o'zgarsa — `LEGAL_VERSIONS.terms` ni oshiring.
 */
import { LegalLang, LegalPage } from '../account-deletion/legal-pages.content';
import { som } from './legal-policy';
import { TermsContext, draftBanner } from './legal-terms-context';
import { LEGAL_VERSIONS } from './legal-versions';

export function termsPage(lang: LegalLang, c: TermsContext): LegalPage {
  return lang === 'ru' ? termsRu(c) : termsUz(c);
}

function termsUz(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS.terms.version;
  return {
    title: 'Foydalanuvchi ofertasi',
    draft: draftBanner('uz', v),
    intro: `${c.operator} ("Platforma") va Angren Taxi ilovasidan foydalanuvchi ("Foydalanuvchi") o'rtasidagi ommaviy oferta. Tahrir: ${v}.`,
    sections: [
      {
        h: '1. Oferta va uni qabul qilish',
        p: [
          "Bu hujjat O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq ommaviy oferta hisoblanadi. Ilovada \"Davom etish\" yoki \"Qabul qilaman\" tugmasini bosish — ofertani to'liq va so'zsiz qabul qilish (aksept). Qabul qilingan tahrir, sana va qurilma ma'lumoti (IP, ilova versiyasi) dalil sifatida saqlanadi.",
          "Shartlarga rozi bo'lmasangiz, ilovadan foydalanmang.",
        ],
      },
      {
        h: '2. Platformaning roli — vositachi',
        p: [
          "Platforma — axborot xizmati: buyurtmani qabul qiladi, uni mustaqil haydovchi, kuryer yoki sotuvchiga (\"Ijrochi\") yetkazadi va hisob-kitobga yordam beradi. Platforma o'zi tashuvchi, kuryer yoki sotuvchi emas.",
          "Safar va yetkazishni Ijrochi o'z nomidan bajaradi (o'zini o'zi band qilgan shaxs yoki yakka tadbirkor). Tovar sifati uchun sotuvchi javob beradi. Platforma to'lovni Ijrochi nomidan komissioner sifatida qabul qilishi mumkin; fiskal chekda Ijrochi ko'rsatiladi.",
        ],
      },
      {
        h: '3. Buyurtma',
        li: [
          "Buyurtma ilovada beriladi: manzil, xizmat turi, tarif, to'lov usuli. Buyurtma Ijrochi qabul qilgan paytdan boshlab tuzilgan hisoblanadi.",
          "Manzil va telefon to'g'ri ko'rsatilishi shart; noto'g'ri manzil tufayli qo'shimcha yo'l va kutish Foydalanuvchi hisobidan.",
          "Rejalashtirilgan buyurtmada vaqtga tayyor bo'ling.",
        ],
      },
      {
        h: '4. Narx va kutish haqi',
        li: [
          "Narx buyurtma berishdan oldin ilovada ko'rsatiladi (taxminiy yoki qat'iy — ekranda yoziladi). Yo'nalish o'zgarsa, to'xtash qo'shilsa yoki taksometr rejimida narx haqiqiy masofa va vaqt bo'yicha qayta hisoblanadi.",
          "Haydovchi yetib kelgach tarifdagi bepul kutish daqiqalari beriladi, keyin har daqiqa tarifda ko'rsatilgan narxda hisoblanadi.",
          `Yetkazishda manzilda bepul kutish — ${p.dropoffFreeWaitMinutes} daqiqa, keyin tarif bo'yicha kutish haqi.`,
          'Aksiya va promokod shartlari ularning tavsifida yoziladi.',
        ],
      },
      {
        h: "5. To'lov",
        li: [
          "To'lov naqd yoki karta orqali (Payme, Click, Uzcard). Karta ma'lumotlari to'lov tizimi sahifasida kiritiladi — Platforma ularni ko'rmaydi.",
          "Har bir safar/buyurtma bo'yicha fiskal chek beriladi.",
          `Kartali ovqat/market buyurtmasi to'lov tasdiqlanmaguncha sotuvchiga yuborilmaydi; ${p.cardPaymentTimeoutMinutes} daqiqa ichida to'lanmasa avtomatik bekor qilinadi.`,
          "To'lanmagan summa (jarima, qolgan haq) qarz sifatida yoziladi va keyingi buyurtmadan oldin to'lanadi.",
        ],
      },
      {
        h: '6. Taksi: bekor qilish va kelmaslik',
        li: [
          `Bepul bekor qilish — haydovchi qabul qilgandan keyin ${p.freeCancelMinutes} daqiqa ichida va haydovchi hali yetib kelmagan bo'lsa.`,
          `Undan keyin bekor qilish — ${som(p.lateCancelFee)} so'm jarima, u haydovchiga o'tadi (vaqt va yoqilg'i uchun).`,
          `Haydovchi yetib kelgandan keyin ${p.noShowWaitMinutes} daqiqa ichida chiqmasangiz, u "Yo'lovchi chiqmadi" deb belgilashi mumkin — ${som(p.noShowFee)} so'm jarima, haydovchiga o'tadi.`,
          "Safar avariya yoki mashina buzilishi tufayli uzilsa, shu nuqtagacha bo'lgan narx olinadi va sizga yangi haydovchi qidiriladi.",
        ],
      },
      {
        h: '7. Yetkazib berish (posilka, ovqat, market)',
        li: [
          `Posilka yuborishda uning qiymatini e'lon qilish majburiy; eng ko'pi — ${som(p.parcelMaxDeclaredValue)} so'm. Bundan qimmat narsani platforma orqali yubormang.`,
          `Yo'qolgan yoki buzilgan posilka uchun kompensatsiya — e'lon qilingan qiymatdan oshmaydi (eng ko'pi ${som(p.parcelMaxDeclaredValue)} so'm) va faqat hodisa tasdiqlangandan keyin to'lanadi.`,
          "Taqiqlangan narsalar: pul, hujjatlar, qurol va o'q-dorilar, dori vositalari, alkogol, tirik hayvonlar, giyohvand va psixotrop moddalar, shuningdek qonun bilan taqiqlangan har qanday narsa. Buyurtmada buni tasdiqlaysiz; kuryer shubhali narsani olmasligi mumkin.",
          `Topshirish kodi: buyurtma faqat ${p.handoffCodeDigits} raqamli kodni aytgan odamga topshiriladi (${p.handoffCodeAttempts} urinish). Kodni faqat qabul qiluvchiga bering.`,
          `Qabul qiluvchi manzilda bo'lmasa yoki buyurtmani rad etsa, kuryer kutish tugagach "Yetkazib bo'lmadi" deb belgilaydi va buyurtma qaytariladi. Bunda Foydalanuvchi yetkazish haqini va qaytarish haqini (yetkazish haqining ${p.returnFeePercent}%) to'laydi.`,
          `30 kun ichida ${p.refusalCashBlockCount} marta asossiz rad etilsa, naqd to'lovli buyurtma vaqtincha o'chiriladi (karta orqali buyurtma berish mumkin).`,
          "Ovqat yoki tovar sifati (buzilgan, noto'g'ri, kam) bo'yicha shikoyat — 9-bo'lim tartibida.",
        ],
      },
      {
        h: '8. Xulq qoidalari',
        li: [
          "Ijrochiga va boshqa yo'lovchilarga hurmat bilan munosabatda bo'ling; haqorat, tahdid, ta'qib va bezorilik taqiqlanadi.",
          "Mashinada chekmang, xavfsizlik kamarini taqing, haydovchini xavfli harakatga undamang.",
          "Mast holatda tartibni buzgan yo'lovchiga xizmat ko'rsatish rad etilishi mumkin.",
          "Mashinaga yetkazilgan zarar (ifloslantirish, sindirish) Foydalanuvchi hisobidan qoplanadi — hodisa tartibida tasdiqlangandan keyin.",
          "Ilovadan tashqarida kelishib to'lash, Ijrochining shaxsiy raqamini so'rash yoki soxta buyurtma berish taqiqlanadi.",
          "Qoidalar buzilsa, Platforma ogohlantirishi, xizmatni cheklashi yoki hisobni bloklashi mumkin.",
        ],
      },
      {
        h: '9. Shikoyat va nizolarni hal qilish',
        li: [
          `Shikoyat ilovada "Muammo haqida xabar berish" orqali, safar/buyurtmadan keyin ${p.complaintWindowDays} kun ichida beriladi. Sababni tanlang, izoh va ixtiyoriy ravishda 3 tagacha surat qo'shing.`,
          "Hodisani Platforma menejeri ko'rib chiqadi: GPS izi, chat, baholar va suratlar buyurtmaga bog'langan holda tekshiriladi. Natija ilovada xabar qilinadi.",
          "Menejer qarori: pulni qaytarish, kompensatsiya (belgilangan chegara doirasida), Ijrochiga ogohlantirish yoki boshqa chora — sababi bilan.",
          "Qarorga rozi bo'lmasangiz, qo'llab-quvvatlash xizmatiga yozma murojaat qiling. Nizo shunda ham hal bo'lmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq (iste'molchilar huquqlarini himoya qilish organlari yoki sud orqali).",
        ],
      },
      {
        h: '10. Xavfsizlik',
        li: [
          "Ilovada SOS tugmasi bor — u Platforma dispetcheriga darhol signal beradi. Hayotga xavf bo'lsa, avval 102/103 ga qo'ng'iroq qiling.",
          "Telefon raqamlaringiz Ijrochiga ko'rsatilmaydi — aloqa ilova orqali.",
          `GPS izi, chat va hodisa suratlari ${p.evidenceRetentionDays} kun saqlanadi, keyin o'chiriladi (ochiq nizo bo'lsa — u yopilgandan keyin ${p.evidenceRetentionDays} kun).`,
        ],
      },
      {
        h: '11. Javobgarlik chegaralari',
        li: [
          "Platforma vositachi sifatida buyurtmani yetkazish va hisob-kitob to'g'riligi uchun javob beradi. Safar va yetkazishni bajarish uchun Ijrochi, tovar sifati uchun sotuvchi javob beradi.",
          "Yo'lovchining hayoti va sog'lig'i tashuvchining majburiy fuqarolik javobgarligi sug'urtasi bilan himoyalangan (haydovchidan talab qilinadi).",
          `Yetkazishdagi kompensatsiya e'lon qilingan qiymat bilan cheklanadi (eng ko'pi ${som(p.parcelMaxDeclaredValue)} so'm); boy berilgan foyda va bilvosita zarar qoplanmaydi.`,
          "Fors-major (tabiiy ofat, aloqa uzilishi, davlat organlari qarori) tufayli bajarilmagan majburiyat uchun tomonlar javob bermaydi.",
          "Bu cheklovlar qonun bilan iste'molchiga berilgan huquqlarni kamaytirmaydi.",
        ],
      },
      {
        h: "12. Shaxsga doir ma'lumotlar",
        p: [`Ma'lumotlar qanday yig'ilishi va saqlanishi maxfiylik siyosatida yozilgan: ${c.privacyUrl}`],
      },
      {
        h: "13. Ofertani o'zgartirish",
        li: [
          "Platforma ofertani o'zgartirishi mumkin. Yangi tahrir shu manzilda e'lon qilinadi va ilovada qisqa \"nima o'zgardi\" bilan ko'rsatiladi.",
          "Mazmunan o'zgarishda keyingi buyurtmadan oldin yangi tahrirni qabul qilish so'raladi. Faol safar yoki buyurtma eski shartlarda yakunlanadi.",
          "Rozi bo'lmasangiz, ilovadan foydalanishni to'xtatib, hisobingizni o'chirishingiz mumkin.",
        ],
      },
      {
        h: '14. Aloqa',
        p: [`${c.operator}. Qo'llab-quvvatlash: ${c.supportPhone} yoki ilovadagi "Yordam" bo'limi.`],
      },
    ],
  };
}

function termsRu(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS.terms.version;
  return {
    title: 'Оферта для пользователей',
    draft: draftBanner('ru', v),
    intro: `Публичная оферта между ${c.operator} («Платформа») и пользователем приложения Angren Taxi («Пользователь»). Редакция: ${v}.`,
    sections: [
      {
        h: '1. Оферта и её принятие',
        p: [
          'Этот документ является публичной офертой в соответствии с Гражданским кодексом Республики Узбекистан. Нажатие кнопки «Продолжить» или «Принимаю» в приложении — полное и безоговорочное принятие оферты (акцепт). Принятая редакция, дата и данные устройства (IP, версия приложения) сохраняются как доказательство.',
          'Если вы не согласны с условиями, не пользуйтесь приложением.',
        ],
      },
      {
        h: '2. Роль Платформы — посредник',
        p: [
          'Платформа — информационный сервис: принимает заказ, передаёт его независимому водителю, курьеру или продавцу («Исполнитель») и помогает с расчётами. Платформа сама не является перевозчиком, курьером или продавцом.',
          'Поездку и доставку Исполнитель выполняет от своего имени (самозанятый или индивидуальный предприниматель). За качество товара отвечает продавец. Платформа может принимать оплату от имени Исполнителя как комиссионер; в фискальном чеке указывается Исполнитель.',
        ],
      },
      {
        h: '3. Заказ',
        li: [
          'Заказ оформляется в приложении: адрес, вид услуги, тариф, способ оплаты. Заказ считается заключённым с момента, когда его принял Исполнитель.',
          'Адрес и телефон должны быть указаны верно; дополнительный путь и ожидание из-за неверного адреса — за счёт Пользователя.',
          'Для запланированного заказа будьте готовы к указанному времени.',
        ],
      },
      {
        h: '4. Цена и плата за ожидание',
        li: [
          'Цена показывается в приложении до оформления заказа (ориентировочная или фиксированная — указано на экране). При изменении маршрута, добавлении остановки или в режиме таксометра цена пересчитывается по фактическому расстоянию и времени.',
          'После прибытия водителя даётся бесплатное ожидание по тарифу, затем каждая минута оплачивается по цене тарифа.',
          `При доставке бесплатное ожидание на адресе — ${p.dropoffFreeWaitMinutes} мин, далее плата за ожидание по тарифу.`,
          'Условия акций и промокодов указаны в их описании.',
        ],
      },
      {
        h: '5. Оплата',
        li: [
          'Оплата наличными или картой (Payme, Click, Uzcard). Данные карты вводятся на странице платёжной системы — Платформа их не видит.',
          'По каждой поездке/заказу выдаётся фискальный чек.',
          `Заказ еды/маркета с оплатой картой не передаётся продавцу до подтверждения оплаты; если оплата не поступила в течение ${p.cardPaymentTimeoutMinutes} мин, заказ отменяется автоматически.`,
          'Неоплаченная сумма (штраф, остаток платы) записывается как долг и оплачивается до следующего заказа.',
        ],
      },
      {
        h: '6. Такси: отмена и неявка',
        li: [
          `Бесплатная отмена — в течение ${p.freeCancelMinutes} мин после принятия заказа водителем и если водитель ещё не прибыл.`,
          `Отмена позже — штраф ${som(p.lateCancelFee)} сум, он передаётся водителю (за время и топливо).`,
          `Если вы не вышли в течение ${p.noShowWaitMinutes} мин после прибытия водителя, он может отметить «Пассажир не вышел» — штраф ${som(p.noShowFee)} сум, передаётся водителю.`,
          'Если поездка прервана из-за аварии или поломки, оплачивается путь до этой точки, и для вас ищется новый водитель.',
        ],
      },
      {
        h: '7. Доставка (посылки, еда, маркет)',
        li: [
          `При отправке посылки указание её ценности обязательно; максимум — ${som(p.parcelMaxDeclaredValue)} сум. Не отправляйте через платформу более дорогие вещи.`,
          `Компенсация за утерянную или повреждённую посылку не превышает объявленной ценности (максимум ${som(p.parcelMaxDeclaredValue)} сум) и выплачивается только после подтверждения инцидента.`,
          'Запрещённые вложения: деньги, документы, оружие и боеприпасы, лекарственные средства, алкоголь, живые животные, наркотические и психотропные вещества, а также всё, что запрещено законом. Вы подтверждаете это в заказе; курьер вправе не брать подозрительное вложение.',
          `Код передачи: заказ передаётся только тому, кто назовёт ${p.handoffCodeDigits}-значный код (${p.handoffCodeAttempts} попыток). Сообщайте код только получателю.`,
          `Если получателя нет на адресе или он отказался от заказа, курьер после ожидания отмечает «Не удалось доставить», и заказ возвращается. В этом случае Пользователь оплачивает доставку и плату за возврат (${p.returnFeePercent}% от стоимости доставки).`,
          `При ${p.refusalCashBlockCount} необоснованных отказах за 30 дней заказ с оплатой наличными временно отключается (заказ с оплатой картой доступен).`,
          'Жалоба на качество еды или товара (испорчено, не то, не хватает) — в порядке раздела 9.',
        ],
      },
      {
        h: '8. Правила поведения',
        li: [
          'Относитесь с уважением к Исполнителю и другим пассажирам; оскорбления, угрозы, преследование и хулиганство запрещены.',
          'Не курите в машине, пристёгивайтесь, не побуждайте водителя к опасным действиям.',
          'Пассажиру в нетрезвом состоянии, нарушающему порядок, может быть отказано в обслуживании.',
          'Ущерб автомобилю (загрязнение, поломка) возмещается Пользователем — после подтверждения в порядке инцидента.',
          'Запрещено договариваться об оплате вне приложения, требовать личный номер Исполнителя или создавать фиктивные заказы.',
          'При нарушении правил Платформа может вынести предупреждение, ограничить сервис или заблокировать аккаунт.',
        ],
      },
      {
        h: '9. Жалобы и разрешение споров',
        li: [
          `Жалоба подаётся в приложении через «Сообщить о проблеме» в течение ${p.complaintWindowDays} дн после поездки/заказа. Выберите причину, добавьте комментарий и при желании до 3 фото.`,
          'Инцидент рассматривает менеджер Платформы: GPS-трек, чат, оценки и фото проверяются вместе с заказом. О результате сообщается в приложении.',
          'Решение менеджера: возврат денег, компенсация (в установленных пределах), предупреждение Исполнителю или иная мера — с указанием причины.',
          'Если вы не согласны с решением, напишите в службу поддержки. Если спор не решён и после этого — в соответствии с законодательством Республики Узбекистан (через органы защиты прав потребителей или суд).',
        ],
      },
      {
        h: '10. Безопасность',
        li: [
          'В приложении есть кнопка SOS — она сразу подаёт сигнал диспетчеру Платформы. При угрозе жизни сначала звоните 102/103.',
          'Ваш номер телефона не показывается Исполнителю — связь через приложение.',
          `GPS-трек, чат и фото инцидентов хранятся ${p.evidenceRetentionDays} дн, затем удаляются (при открытом споре — ${p.evidenceRetentionDays} дн после его закрытия).`,
        ],
      },
      {
        h: '11. Пределы ответственности',
        li: [
          'Платформа как посредник отвечает за передачу заказа и правильность расчётов. За выполнение поездки и доставки отвечает Исполнитель, за качество товара — продавец.',
          'Жизнь и здоровье пассажира защищены обязательным страхованием гражданской ответственности перевозчика (требуется от водителя).',
          `Компенсация при доставке ограничена объявленной ценностью (максимум ${som(p.parcelMaxDeclaredValue)} сум); упущенная выгода и косвенный ущерб не возмещаются.`,
          'Стороны не отвечают за неисполнение из-за форс-мажора (стихийные бедствия, сбой связи, решения госорганов).',
          'Эти ограничения не уменьшают прав, предоставленных потребителю законом.',
        ],
      },
      {
        h: '12. Персональные данные',
        p: [`Как собираются и хранятся данные — в политике конфиденциальности: ${c.privacyUrl}`],
      },
      {
        h: '13. Изменение оферты',
        li: [
          'Платформа может изменять оферту. Новая редакция публикуется по этому адресу и показывается в приложении с кратким описанием изменений.',
          'При существенных изменениях перед следующим заказом нужно принять новую редакцию. Активная поездка или заказ завершаются на прежних условиях.',
          'Если вы не согласны, вы можете прекратить пользоваться приложением и удалить аккаунт.',
        ],
      },
      {
        h: '14. Контакты',
        p: [`${c.operator}. Поддержка: ${c.supportPhone} или раздел «Помощь» в приложении.`],
      },
    ],
  };
}
