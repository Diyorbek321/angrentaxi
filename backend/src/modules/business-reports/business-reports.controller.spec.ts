import { BadRequestException } from '@nestjs/common';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';

describe('BusinessReportsController', () => {
  const reports = {
    report: jest.fn().mockResolvedValue({}),
    supplyReport: jest.fn().mockResolvedValue({}),
    fraudReport: jest.fn().mockResolvedValue({}),
    qualityReport: jest.fn().mockResolvedValue({}),
    sendDaily: jest.fn().mockResolvedValue(true),
  };
  const controller = new BusinessReportsController(reports as unknown as BusinessReportsService);

  beforeEach(() => reports.report.mockClear());

  it('defaults to yesterday when no dates are given', async () => {
    await controller.finance({});
    const period = reports.report.mock.calls[0][0];
    expect(Date.parse(period.to) - Date.parse(period.from)).toBe(24 * 60 * 60 * 1000);
  });

  it('passes an explicit range through', async () => {
    await controller.finance({ from: '2026-10-01', to: '2026-11-01' });
    expect(reports.report).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-11-01' });
  });

  it.each([
    [{ from: '2026-10-01' }],
    [{ from: '2026-10-02', to: '2026-10-01' }],
    [{ from: '2026-10-01', to: '2026-10-01' }],
    [{ from: '2024-01-01', to: '2026-01-01' }],
    [{ from: '2026-13-01', to: '2026-13-05' }],
  ])('rejects an invalid range %j', (query) => {
    expect(() => controller.finance(query)).toThrow(BadRequestException);
  });

  it('supply uses the same period rules', async () => {
    await controller.supply({ from: '2026-10-01', to: '2026-10-08' });
    expect(reports.supplyReport).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-08' });
    expect(() => controller.supply({ to: '2026-10-08' })).toThrow(BadRequestException);
  });

  it('fraud uses the same period rules', async () => {
    await controller.fraud({ from: '2026-10-01', to: '2026-10-08' });
    expect(reports.fraudReport).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-08' });
    expect(() => controller.fraud({ from: '2026-10-08' })).toThrow(BadRequestException);
  });

  it('quality uses the same period rules', async () => {
    await controller.quality({ from: '2026-10-01', to: '2026-10-08' });
    expect(reports.qualityReport).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-08' });
    expect(() => controller.quality({ to: '2026-10-08' })).toThrow(BadRequestException);
  });

  it('send-daily reports whether Telegram accepted the message', async () => {
    await expect(controller.sendDaily()).resolves.toEqual({ sent: true });
  });
});
