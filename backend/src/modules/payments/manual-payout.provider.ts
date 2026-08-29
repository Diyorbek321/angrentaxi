import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider, PayoutResult } from './payout.interface';

/**
 * Qo'lda o'tkazma — hozirgi yagona ishlaydigan usul.
 *
 * Pulni ODAM o'tkazadi: operator so'rovni panelda ko'radi, o'z banki yoki
 * Payme ilovasi orqali haydovchining kartasiga jo'natadi va keyin "to'landi"
 * tugmasini bosadi. Ya'ni bu sinf hech qanday tarmoqqa chiqmaydi.
 *
 * ⚠️ NEGA umuman sinf kerak, agar u hech narsa qilmasa. Ikki sabab:
 *
 *   1. Chaqiruv nuqtasi HOZIR yoziladi. Payme/Click payout kalitlari
 *      kelganda `PaymentsService` ga tegilmaydi — modulda `PAYOUT_PROVIDER`
 *      boshqa sinfga bog'lanadi, xolos. Aks holda o'sha kuni pul chiqarish
 *      mantig'ining o'rtasiga tarmoq chaqiruvi kiritish kerak bo'lardi.
 *
 *   2. Jurnal. Har bir chiqarish endi qaysi yo'l bilan ketgani bilan
 *      yoziladi, ya'ni keyinchalik "bu pul qanday chiqqan?" degan savolga
 *      javob bor.
 */
@Injectable()
export class ManualPayoutProvider implements IPayoutProvider {
  private readonly logger = new Logger(ManualPayoutProvider.name);

  readonly name = 'manual';

  async send(params: {
    amount: number;
    destination: string;
    withdrawalId: string;
  }): Promise<PayoutResult> {
    // ⚠️ `destination` (karta/telefon raqami) ATAYLAB jurnalga yozilmaydi:
    // u shaxsiy moliyaviy ma'lumot va jurnallar odatda kengroq doiraga
    // ko'rinadi. So'rov identifikatori bo'yicha uni bazadan topish mumkin.
    this.logger.log(
      `Qo'lda to'lov tasdiqlandi: so'rov ${params.withdrawalId}, summa ${params.amount}`,
    );

    // `settled: true` — operator tugmani pulni o'tkazgandan KEYIN bosadi,
    // ya'ni tasdiq odamdan keladi va bu yerda kutadigan narsa yo'q.
    return { reference: null, settled: true };
  }
}
