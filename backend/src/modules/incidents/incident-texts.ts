import type { AppLanguage } from '../../common/i18n/error-messages';
import type { LocalizedPush, PushText } from '../notifications/push-text';
import { formatTashkent } from './suspension';

/**
 * Hodisa pushlari (INCIDENT-POLICY §3) — o'zbekcha va ruscha. Menejer
 * yozgan izoh/sabab tarjima qilinmaydi (operator matni).
 */
const sumOf = (amount: number): string => Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const both =
  (uz: PushText, ru: PushText): LocalizedPush =>
  (language: AppLanguage) =>
    language === 'ru' ? ru : uz;

export function warningPush(note: string): LocalizedPush {
  return both(
    { title: 'Ogohlantirish', body: `Sizga nisbatan shikoyat tasdiqlandi: ${note}. Takrorlansa hisob to'xtatiladi.` },
    { title: 'Предупреждение', body: `Жалоба на вас подтверждена: ${note}. При повторении аккаунт будет приостановлен.` },
  );
}

export function suspensionPush(until: Date, reason: string): LocalizedPush {
  const when = formatTashkent(until);
  return both(
    { title: "Hisob vaqtincha to'xtatildi", body: `${when} gacha: ${reason}. E'tiroz bildirish — ilovada «Murojaatlarim».` },
    { title: 'Аккаунт временно приостановлен', body: `До ${when}: ${reason}. Обжаловать — в приложении, «Мои обращения».` },
  );
}

export function safetySuspensionPush(until: Date): LocalizedPush {
  const when = formatTashkent(until);
  return both(
    {
      title: "Hisob vaqtincha to'xtatildi",
      body: `Sizga nisbatan xavfsizlik shikoyati tushdi. Admin ko'rib chiqquncha (${when} gacha) ishlay olmaysiz.`,
    },
    {
      title: 'Аккаунт временно приостановлен',
      body: `На вас поступила жалоба по безопасности. До решения администратора (до ${when}) работа недоступна.`,
    },
  );
}

export function suspensionLiftedPush(): LocalizedPush {
  return both(
    { title: "To'xtatish olib tashlandi", body: 'Hisobingiz yana faol — ishlashingiz mumkin.' },
    { title: 'Приостановка снята', body: 'Ваш аккаунт снова активен.' },
  );
}

export function blockedPush(reason: string): LocalizedPush {
  return both(
    { title: 'Hisob bloklandi', body: `Sabab: ${reason}. Savol bo'lsa qo'llab-quvvatlash xizmatiga qo'ng'iroq qiling.` },
    { title: 'Аккаунт заблокирован', body: `Причина: ${reason}. По вопросам звоните в службу поддержки.` },
  );
}

export function refundPush(amount: number): LocalizedPush {
  const sum = sumOf(amount);
  return both(
    { title: 'Pul qaytarildi', body: `Murojaatingiz bo'yicha hamyoningizga ${sum} so'm qaytarildi.` },
    { title: 'Деньги возвращены', body: `По вашему обращению на кошелёк возвращено ${sum} сум.` },
  );
}

export function penaltyPush(amount: number, note: string): LocalizedPush {
  const sum = sumOf(amount);
  return both(
    { title: 'Jarima', body: `Shikoyat bo'yicha ${sum} so'm jarima yozildi: ${note}. To'lanmaguncha yangi buyurtma berilmaydi.` },
    { title: 'Штраф', body: `По жалобе начислен штраф ${sum} сум: ${note}. До оплаты новые заказы недоступны.` },
  );
}

export function reporterResolvedPush(rejected: boolean): LocalizedPush {
  return rejected
    ? both(
        { title: "Murojaatingiz ko'rib chiqildi", body: "Shikoyat tasdiqlanmadi. Tafsilotlar — «Murojaatlarim»." },
        { title: 'Обращение рассмотрено', body: 'Жалоба не подтвердилась. Подробности — «Мои обращения».' },
      )
    : both(
        { title: "Murojaatingiz ko'rib chiqildi", body: "Choralar ko'rildi. Tafsilotlar — «Murojaatlarim»." },
        { title: 'Обращение рассмотрено', body: 'Меры приняты. Подробности — «Мои обращения».' },
      );
}

export function appealDecidedPush(overturned: boolean): LocalizedPush {
  return overturned
    ? both(
        { title: "E'tirozingiz qabul qilindi", body: 'Chora bekor qilindi.' },
        { title: 'Апелляция принята', body: 'Мера отменена.' },
      )
    : both(
        { title: "E'tirozingiz ko'rib chiqildi", body: "Chora o'z kuchida qoldi." },
        { title: 'Апелляция рассмотрена', body: 'Мера остаётся в силе.' },
      );
}
