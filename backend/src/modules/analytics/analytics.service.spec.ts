import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let query: jest.Mock;
  let service: AnalyticsService;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    service = new AnalyticsService({ query } as never);
  });

  describe('record', () => {
    it('har bosqichni bitta atomar INSERT … ON CONFLICT bilan +1 qiladi', async () => {
      await service.record('passenger', ['app_open', 'price_shown']);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (day, app, step)');
      expect(sql).toContain("'Asia/Tashkent'");
      expect(params).toEqual(['passenger', ['app_open', 'price_shown']]);
    });

    it('takroriy bosqich bir marta sanaladi', async () => {
      await service.record('passenger', ['app_open', 'app_open']);
      expect(query.mock.calls[0][1]).toEqual(['passenger', ['app_open']]);
    });

    it("bo'sh ro'yxat — bazaga bormaydi", async () => {
      await service.record('passenger', []);
      expect(query).not.toHaveBeenCalled();
    });

    it('baza xatosi ilovaga qaytmaydi (analytics asosiy oqimni buzmasin)', async () => {
      query.mockRejectedValueOnce(new Error('db down'));
      await expect(service.record('passenger', ['app_open'])).resolves.toBeUndefined();
    });
  });

  describe('getFunnel', () => {
    it('ilova va server bosqichlarini tartib bilan jamlaydi', async () => {
      query
        .mockResolvedValueOnce([
          { day: '2026-10-26', step: 'app_open', count: 10 },
          { day: '2026-10-27', step: 'app_open', count: 30 },
          { day: '2026-10-27', step: 'order_requested', count: 8 },
        ])
        .mockResolvedValueOnce([
          { day: '2026-10-27', created: 9, assigned: 7, completed: 6 },
        ]);

      const result = await service.getFunnel('2026-10-26', '2026-10-27');

      expect(result.steps).toEqual([
        { step: 'app_open', source: 'app', count: 40 },
        { step: 'destination_selected', source: 'app', count: 0 },
        { step: 'price_shown', source: 'app', count: 0 },
        { step: 'order_requested', source: 'app', count: 8 },
        { step: 'order_created', source: 'server', count: 9 },
        { step: 'driver_assigned', source: 'server', count: 7 },
        { step: 'trip_completed', source: 'server', count: 6 },
      ]);
      expect(result.days).toEqual([
        { day: '2026-10-26', app_open: 10 },
        {
          day: '2026-10-27',
          app_open: 30,
          order_requested: 8,
          order_created: 9,
          driver_assigned: 7,
          trip_completed: 6,
        },
      ]);
    });

    it("noto'g'ri yoki teskari oraliq — 400", async () => {
      await expect(service.getFunnel('x', '2026-10-27')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getFunnel('2026-10-27', '2026-10-01')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('92 kundan uzun oraliq — 400', async () => {
      await expect(service.getFunnel('2026-01-01', '2026-10-27')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
