/**
 * Payme Merchant API — JSON-RPC 2.0 konverti va xato kodlari
 * (developer.help.paycom.uz: «Протокол Merchant API», «Ошибки (ERRORS)»).
 *
 * Javob HAR DOIM HTTP 200: Payme 200 dan boshqa holatni −32400 deb oladi.
 */

export interface PaymeLocalizedMessage {
  uz: string;
  ru: string;
  en: string;
}

export interface PaymeRpcError {
  code: number;
  message: PaymeLocalizedMessage;
  data?: string;
}

export type PaymeRpcId = string | number | null;

export type PaymeRpcResponse =
  | { jsonrpc: '2.0'; id: PaymeRpcId; result: Record<string, unknown> }
  | { jsonrpc: '2.0'; id: PaymeRpcId; error: PaymeRpcError };

/** Payme `account` maydoni — `PaymeProvider.initiate` `ac.order_id` yuboradi. */
export const PAYME_ACCOUNT_FIELD = 'order_id';

/** CreateTransaction'dan 12 soat o'tgach to'lanmagan tranzaksiya bekor (sabab 4). */
export const PAYME_TIMEOUT_MS = 43_200_000;

/** Bekor qilish sabablari (Reason). */
export const PAYME_REASON = {
  receiverNotFound: 1,
  debitError: 2,
  executionError: 3,
  timeout: 4,
  refund: 5,
  unknown: 10,
} as const;

const msg = (uz: string, ru: string, en: string): PaymeLocalizedMessage => ({ uz, ru, en });

export const PAYME_ERRORS = {
  /** -32504: Basic auth mos emas (login `Paycom`, parol — merchant kaliti). */
  insufficientPrivilege: {
    code: -32504,
    message: msg(
      "Ushbu amalni bajarish uchun huquq yetarli emas",
      'Недостаточно привилегий для выполнения метода',
      'Insufficient privileges to perform this method',
    ),
  },
  parseError: {
    code: -32700,
    message: msg("JSON'ni o'qib bo'lmadi", 'Ошибка парсинга JSON', 'JSON parse error'),
  },
  invalidRequest: {
    code: -32600,
    message: msg(
      "RPC so'rovida majburiy maydonlar yo'q yoki turi noto'g'ri",
      'Отсутствуют обязательные поля в RPC-запросе или тип полей не соответствует спецификации',
      'Required RPC fields are missing or have the wrong type',
    ),
  },
  methodNotFound: {
    code: -32601,
    message: msg('Metod topilmadi', 'Запрашиваемый метод не найден', 'Method not found'),
  },
  system: {
    code: -32400,
    message: msg('Tizim xatosi', 'Системная ошибка', 'System error'),
  },
  invalidAmount: {
    code: -31001,
    message: msg("Noto'g'ri summa", 'Неверная сумма', 'Invalid amount'),
  },
  transactionNotFound: {
    code: -31003,
    message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'),
  },
  cannotPerform: {
    code: -31008,
    message: msg(
      "Amalni bajarib bo'lmaydi",
      'Невозможно выполнить операцию',
      'Unable to perform operation',
    ),
  },
  /** -31050: buyurtma (`account.order_id`) topilmadi. */
  orderNotFound: {
    code: -31050,
    message: msg('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'),
  },
  /** -31051: buyurtma allaqachon to'langan yoki yopilgan. */
  orderNotPayable: {
    code: -31051,
    message: msg(
      "Buyurtmani to'lab bo'lmaydi (to'langan yoki bekor qilingan)",
      'Заказ нельзя оплатить (уже оплачен или отменён)',
      'Order cannot be paid (already paid or cancelled)',
    ),
  },
  /** -31052: buyurtmada boshqa faol (state 1) tranzaksiya bor. */
  orderBusy: {
    code: -31052,
    message: msg(
      "Buyurtma boshqa tranzaksiya bilan to'lanmoqda",
      'Заказ ожидает оплаты другой транзакцией',
      'Order is awaiting payment by another transaction',
    ),
  },
} as const satisfies Record<string, Omit<PaymeRpcError, 'data'>>;

export function paymeResult(id: PaymeRpcId, result: Record<string, unknown>): PaymeRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function paymeError(
  id: PaymeRpcId,
  error: Omit<PaymeRpcError, 'data'>,
  data?: string,
): PaymeRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code: error.code, message: { ...error.message }, ...(data !== undefined ? { data } : {}) },
  };
}

/** So'rovdagi `id` — faqat satr/son, aks holda null. */
export function paymeRequestId(body: unknown): PaymeRpcId {
  const id = (body as { id?: unknown } | null)?.id;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}
