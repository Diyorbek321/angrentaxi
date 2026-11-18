import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TelegramService, TELEGRAM_MAX_LENGTH } from './telegram.service';

jest.mock('axios');

describe('TelegramService', () => {
  const post = jest.fn();
  const config = (values: Record<string, string>) =>
    ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as ConfigService;

  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { ok: true } });
    (axios.create as jest.Mock).mockReturnValue({ post });
  });

  it('reports itself as not configured and sends nothing without token/chat id', async () => {
    const service = new TelegramService(config({}));

    expect(service.isConfigured()).toBe(false);
    await expect(service.send('salom')).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('posts the message as HTML to the configured chat', async () => {
    const service = new TelegramService(
      config({ TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '-100500' }),
    );

    await expect(service.send('<b>Hisobot</b>')).resolves.toBe(true);
    expect(post).toHaveBeenCalledWith('/bot123:abc/sendMessage', {
      chat_id: '-100500',
      text: '<b>Hisobot</b>',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  });

  it('splits long messages on line breaks so none exceeds the Telegram limit', async () => {
    const service = new TelegramService(
      config({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' }),
    );
    const line = 'x'.repeat(1000);
    const text = Array.from({ length: 10 }, () => line).join('\n');

    await service.send(text);

    expect(post.mock.calls.length).toBeGreaterThan(1);
    for (const [, payload] of post.mock.calls) {
      expect(payload.text.length).toBeLessThanOrEqual(TELEGRAM_MAX_LENGTH);
    }
    expect(post.mock.calls.map(([, p]) => p.text).join('\n')).toBe(text);
  });

  it('never throws when Telegram is down — returns false instead', async () => {
    post.mockRejectedValue(new Error('ETIMEDOUT'));
    const service = new TelegramService(
      config({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' }),
    );

    await expect(service.send('salom')).resolves.toBe(false);
  });
});
