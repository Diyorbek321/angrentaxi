import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Javobni global `ResponseInterceptor` `{ success, data }` konvertiga
 * O'RAMAYDI. Faqat tashqi protokol aniq javob shaklini talab qiladigan
 * yo'llar uchun (Payme JSON-RPC 2.0, Click SHOP API).
 */
export const RawResponse = (): MethodDecorator & ClassDecorator => SetMetadata(RAW_RESPONSE_KEY, true);
