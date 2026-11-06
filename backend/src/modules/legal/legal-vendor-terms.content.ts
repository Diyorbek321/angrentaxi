/**
 * Sotuvchi (restoran / do'kon) shartlari — `/legal/vendor-terms`.
 *
 * ⚠️ QORALAMA — yurist ko'rib chiqishi kerak. Komissiya — har sotuvchi
 * uchun alohida stavka (`restaurants.commission_rate` / `stores.commission_rate`,
 * panelda ko'rinadi), shuning uchun matnda raqam emas, qoida yoziladi.
 * Mazmunan o'zgarsa — `LEGAL_VERSIONS['vendor-terms']` ni oshiring.
 */
import { LegalLang, LegalPage } from '../account-deletion/legal-pages.content';
import { TermsContext, draftBanner } from './legal-terms-context';
import { LEGAL_VERSIONS } from './legal-versions';

export function vendorTermsPage(lang: LegalLang, c: TermsContext): LegalPage {
  return lang === 'ru' ? vendorRu(c) : vendorUz(c);
}

function vendorUz(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS['vendor-terms'].version;
  return {
    title: 'Sotuvchi shartlari',
    draft: draftBanner('uz', v),
    intro: `${c.operator} ("Platforma") va platformada ovqat yoki tovar sotuvchi restoran/do'kon ("Sotuvchi") o'rtasidagi ommaviy oferta. Tahrir: ${v}.`,
    sections: [
      {
        h: '1. Oferta va uni qabul qilish',
        p: [
          "Sotuvchi panelida \"Qabul qilaman\" tugmasini bosish yoki birinchi buyurtmani qabul qilish — ofertani to'liq qabul qilish. Qabul qilingan tahrir va sana saqlanadi.",
        ],
      },
      {
        h: '2. Tomonlarning roli',
        li: [
          "Platforma — vositachi: Sotuvchining katalogini mijozlarga ko'rsatadi, buyurtmani yetkazadi, kuryer topadi va hisob-kitobga yordam beradi. Kartali to'lovni Sotuvchi nomidan komissioner sifatida qabul qiladi.",
          "Tovar sotuvchisi — Sotuvchi. Tovar sifati, tarkibi, yaroqlilik muddati, narx va tavsifning to'g'riligi uchun Sotuvchi javob beradi.",
          "Sotuvchi STIR'ini panelda kiritadi — u fiskal chekda komitent sifatida ko'rsatiladi.",
        ],
      },
      {
        h: '3. Komissiya va hisob-kitob',
        li: [
          "Platforma komissiyasi — faqat tovar summasidan (yetkazish haqidan emas), Sotuvchi uchun belgilangan stavka bo'yicha. Stavka panelda ko'rinadi va platforma tomonidan belgilanadi; o'zgarishi oldindan xabar qilinadi.",
          "Naqd buyurtmada kuryer tovar pulini Sotuvchiga ilovadagi tartibda to'laydi; qonun talab qilgan sanadan boshlab — faqat hamyon orqali elektron o'tkazma.",
          "Kartali buyurtma tushumi faqat to'lov muvaffaqiyatli yakunlangandan keyin Sotuvchi hamyoniga yoziladi. Yechib olish — panel orqali.",
          "Aksiya va promokodni kim moliyalashtirishi uning shartlarida yoziladi.",
        ],
      },
      {
        h: "4. Kartali buyurtma — faqat to'langandan keyin",
        li: [
          "To'lanmagan kartali buyurtma panelda \"To'lov kutilmoqda\" holatida turadi va uni qabul qilib, tayyorlashni boshlab bo'lmaydi.",
          `${p.cardPaymentTimeoutMinutes} daqiqa ichida to'lanmasa, buyurtma avtomatik bekor qilinadi — Sotuvchiga hech qanday majburiyat qolmaydi.`,
          "To'lanmagan buyurtmani tayyorlagan Sotuvchiga zarar qoplanmaydi.",
        ],
      },
      {
        h: '5. Tovar sifati',
        li: [
          "Sanitariya va gigiyena qoidalariga, tovar uchun belgilangan standartlarga rioya qiling; yaroqlilik muddati o'tgan tovar sotilmaydi.",
          "Katalogdagi surat, tarkib, vazn va narx haqiqatga mos bo'lishi shart. Mavjud bo'lmagan tovarni panelda o'chiring.",
          "Ovqat yetkazishga mos, yopiq qadoqda topshiriladi. Litsenziya talab qilinadigan yoki qonun bilan cheklangan tovar (alkogol, tamaki va h.k.) platforma orqali sotilmaydi.",
        ],
      },
      {
        h: '6. Buyurtmani qabul qilish va rad etish',
        li: [
          "Buyurtmani panelda o'z vaqtida qabul qiling yoki sabab ko'rsatib rad eting. Qabul qilingandan keyin mijoz buyurtmani ilovadan bekor qila olmaydi.",
          "Asossiz ko'p rad etish va kechikish — reyting va shikoyat sifatida hisobga olinadi.",
        ],
      },
      {
        h: '7. Mijoz rad etishi va qaytarish',
        li: [
          "Mijoz buyurtmani olmasa yoki rad etsa, kuryer tovarni Sotuvchiga qaytaradi. Sotuvchi qaytarishni panelda tasdiqlaydi; shundan keyin kuryer oldindan to'lagan pul unga qaytariladi.",
          `Rad etgan mijoz yetkazish haqi va qaytarish haqini (yetkazish haqining ${p.returnFeePercent}%) to'laydi; ${p.refusalCashBlockCount} marta rad etgan mijozda naqd buyurtma o'chiriladi.`,
          "Buzilgan, noto'g'ri yoki kam tovar bo'yicha mijoz shikoyati tasdiqlansa, pul Sotuvchi hisobidan qaytariladi (menejer qarori, sababi bilan).",
        ],
      },
      {
        h: '8. Shikoyat va nizolar',
        li: [
          `Mijoz shikoyati buyurtmadan keyin ${p.complaintWindowDays} kun ichida ochiladi. Menejer buyurtma tarixi, suratlar va tomonlarning izohini ko'rib qaror qabul qiladi; Sotuvchi o'z izohini panel orqali beradi.`,
          "Qarorga rozi bo'lmasangiz — qo'llab-quvvatlash xizmatiga yozma e'tiroz. Nizo hal bo'lmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq sud orqali.",
        ],
      },
      {
        h: '9. Javobgarlik',
        li: [
          "Tovar tufayli mijoz sog'lig'iga yetgan zarar uchun Sotuvchi qonunga muvofiq javob beradi.",
          "Platforma vositachi sifatida buyurtmani yetkazish va hisob-kitob to'g'riligi uchun javob beradi; boy berilgan foyda qoplanmaydi.",
          "Qoidalar jiddiy buzilsa, Platforma katalogni vaqtincha yashirishi yoki hamkorlikni to'xtatishi mumkin — sababi bilan xabar qilinadi.",
        ],
      },
      {
        h: "10. Ma'lumotlar va o'zgartirish",
        li: [
          `Mijoz ma'lumotlari faqat buyurtmani bajarish uchun beriladi va boshqa maqsadda ishlatilmaydi. Maxfiylik siyosati: ${c.privacyUrl}`,
          "Platforma shartlarni o'zgartirishi mumkin; yangi tahrir panelda e'lon qilinadi. Qabul qilingan buyurtmalar eski shartlarda yakunlanadi.",
        ],
      },
      {
        h: '11. Aloqa',
        p: [`${c.operator}. Qo'llab-quvvatlash: ${c.supportPhone}.`],
      },
    ],
  };
}

function vendorRu(c: TermsContext): LegalPage {
  const p = c.policy;
  const v = LEGAL_VERSIONS['vendor-terms'].version;
  return {
    title: 'Условия для продавцов',
    draft: draftBanner('ru', v),
    intro: `Публичная оферта между ${c.operator} («Платформа») и рестораном/магазином, продающим еду или товары на платформе («Продавец»). Редакция: ${v}.`,
    sections: [
      {
        h: '1. Оферта и её принятие',
        p: [
          'Нажатие кнопки «Принимаю» в панели продавца или принятие первого заказа — полное принятие оферты. Принятая редакция и дата сохраняются.',
        ],
      },
      {
        h: '2. Роли сторон',
        li: [
          'Платформа — посредник: показывает каталог Продавца клиентам, передаёт заказ, находит курьера и помогает с расчётами. Оплату картой принимает от имени Продавца как комиссионер.',
          'Продавец товара — Продавец. За качество, состав, срок годности, цену и правильность описания отвечает Продавец.',
          'Продавец указывает ИНН в панели — он указывается в фискальном чеке как комитент.',
        ],
      },
      {
        h: '3. Комиссия и расчёты',
        li: [
          'Комиссия Платформы — только с суммы товара (не с доставки), по ставке, установленной для Продавца. Ставка видна в панели и устанавливается платформой; об изменении сообщается заранее.',
          'В заказе за наличные курьер оплачивает товар Продавцу в порядке, указанном в приложении; с даты, установленной законом, — только электронным переводом через кошелёк.',
          'Выручка по заказу с оплатой картой зачисляется в кошелёк Продавца только после успешного завершения оплаты. Вывод — через панель.',
          'Кто финансирует акцию или промокод, указано в её условиях.',
        ],
      },
      {
        h: '4. Заказ с оплатой картой — только после оплаты',
        li: [
          'Неоплаченный заказ с оплатой картой отображается в панели как «Ожидает оплаты»; принять его и начать готовить нельзя.',
          `Если оплата не поступила в течение ${p.cardPaymentTimeoutMinutes} мин, заказ отменяется автоматически — у Продавца не остаётся обязательств.`,
          'Ущерб Продавцу, приготовившему неоплаченный заказ, не возмещается.',
        ],
      },
      {
        h: '5. Качество товара',
        li: [
          'Соблюдайте санитарные и гигиенические нормы и стандарты на товар; товар с истёкшим сроком годности не продаётся.',
          'Фото, состав, вес и цена в каталоге должны соответствовать действительности. Отсутствующий товар отключите в панели.',
          'Еда передаётся в закрытой упаковке, пригодной для доставки. Товары, требующие лицензии или ограниченные законом (алкоголь, табак и т. п.), через платформу не продаются.',
        ],
      },
      {
        h: '6. Принятие и отклонение заказа',
        li: [
          'Своевременно принимайте заказ в панели или отклоняйте с указанием причины. После принятия клиент не может отменить заказ в приложении.',
          'Частые необоснованные отклонения и задержки учитываются в рейтинге и как жалобы.',
        ],
      },
      {
        h: '7. Отказ клиента и возврат',
        li: [
          'Если клиент не получил заказ или отказался, курьер возвращает товар Продавцу. Продавец подтверждает возврат в панели; после этого курьеру возвращаются заранее уплаченные им деньги.',
          `Отказавшийся клиент оплачивает доставку и плату за возврат (${p.returnFeePercent}% от стоимости доставки); после ${p.refusalCashBlockCount} отказов заказ за наличные для клиента отключается.`,
          'Если жалоба клиента на испорченный, не тот или неполный товар подтверждена, деньги возвращаются за счёт Продавца (решение менеджера с причиной).',
        ],
      },
      {
        h: '8. Жалобы и споры',
        li: [
          `Жалоба клиента открывается в течение ${p.complaintWindowDays} дн после заказа. Менеджер принимает решение, изучив историю заказа, фото и объяснения сторон; Продавец даёт объяснение через панель.`,
          'Если вы не согласны с решением — письменное возражение в службу поддержки. Если спор не решён — в судебном порядке по законодательству Республики Узбекистан.',
        ],
      },
      {
        h: '9. Ответственность',
        li: [
          'За вред здоровью клиента, причинённый товаром, Продавец отвечает в соответствии с законом.',
          'Платформа как посредник отвечает за передачу заказа и правильность расчётов; упущенная выгода не возмещается.',
          'При серьёзном нарушении правил Платформа может временно скрыть каталог или прекратить сотрудничество — с уведомлением о причине.',
        ],
      },
      {
        h: '10. Данные и изменения',
        li: [
          `Данные клиента передаются только для выполнения заказа и не используются в других целях. Политика конфиденциальности: ${c.privacyUrl}`,
          'Платформа может изменять условия; новая редакция публикуется в панели. Принятые заказы завершаются на прежних условиях.',
        ],
      },
      {
        h: '11. Контакты',
        p: [`${c.operator}. Поддержка: ${c.supportPhone}.`],
      },
    ],
  };
}
