import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EskizService } from './eskiz.service';

jest.mock('axios');

/**
 * SMS — kirishning yagona yo'li. Ishlamasa, foydalanuvchi buni BILISHI
 * kerak ("SMS yuborildi" deb aldab, kelmaydigan kodni kuttirish emas).
 */
describe('EskizService', () => {
  const post = jest.fn();

  const build = (env: Record<string, string>): EskizService => {
    (axios.create as jest.Mock).mockReturnValue({ post });
    const config = { get: (k: string, d?: string) => env[k] ?? d } as unknown as ConfigService;
    return new EskizService(config);
  };

  beforeEach(() => post.mockReset());

  it("prod'da Eskiz sozlanmagan — 503, yolg'on muvaffaqiyat emas", async () => {
    const service = build({ NODE_ENV: 'production' });
    await expect(service.sendSms('+998901234567', 'kod')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();
  });

  it("dev'da sozlanmagan — avvalgidek o'tkazib yuboriladi (kod jurnalda)", async () => {
    const service = build({ NODE_ENV: 'development' });
    await expect(service.sendSms('+998901234567', 'kod')).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it('401 dan keyingi qayta urinish ham ESKIZ_FROM ni ishlatadi', async () => {
    const service = build({ ESKIZ_EMAIL: 'a@b.uz', ESKIZ_PASSWORD: 'p', ESKIZ_FROM: 'ANGREN' });
    post
      .mockResolvedValueOnce({ data: { data: { token: 't1' } } })
      .mockRejectedValueOnce({ response: { status: 401 }, message: 'expired' })
      .mockResolvedValueOnce({ data: { data: { token: 't2' } } })
      .mockResolvedValueOnce({ data: { id: '1', status: 'ok' } });

    await service.sendSms('+998901234567', 'kod');

    const sends = post.mock.calls.filter(([url]) => url === '/message/sms/send');
    expect(sends).toHaveLength(2);
    expect(sends.map(([, body]) => (body as { from: string }).from)).toEqual(['ANGREN', 'ANGREN']);
  });

  it("provayder ishlamasa — 503 (foydalanuvchiga tushunarli), 500 emas", async () => {
    const service = build({ ESKIZ_EMAIL: 'a@b.uz', ESKIZ_PASSWORD: 'p' });
    post
      .mockResolvedValueOnce({ data: { data: { token: 't1' } } })
      .mockRejectedValueOnce({ response: { status: 502 }, message: 'bad gateway' });
    await expect(service.sendSms('+998901234567', 'kod')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
