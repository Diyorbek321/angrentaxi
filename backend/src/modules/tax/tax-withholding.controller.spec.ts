import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TaxWithholdingController } from './tax-withholding.controller';
import { TaxWithholdingReportService } from './tax-withholding-report.service';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

describe('TaxWithholdingController', () => {
  let controller: TaxWithholdingController;
  const report = { month: '2026-10', rows: [], totals: {} };
  const service = {
    getMonthlyReport: jest.fn().mockResolvedValue(report),
    getMonthlyReportCsv: jest.fn().mockResolvedValue('user_id,name\nu1,Ali'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TaxWithholdingController],
      providers: [{ provide: TaxWithholdingReportService, useValue: service }],
    }).compile();
    controller = module.get(TaxWithholdingController);
  });

  it('marshrut /admin/tax-withholding va faqat ADMIN', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TaxWithholdingController)).toBe('admin/tax-withholding');
    expect(new Reflector().get(ROLES_KEY, TaxWithholdingController)).toEqual([UserRole.ADMIN]);
  });

  it('JSON hisobot', async () => {
    await expect(controller.report({ month: '2026-10' })).resolves.toBe(report);
    expect(service.getMonthlyReport).toHaveBeenCalledWith('2026-10');
  });

  it('CSV — fayl sarlavhalari bilan, konvertsiz', async () => {
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await controller.reportCsv({ month: '2026-10' }, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="tax-withholding-2026-10.csv"',
    );
    // Excel o'zbekcha harflarni to'g'ri o'qishi uchun BOM.
    expect(res.send).toHaveBeenCalledWith('﻿user_id,name\nu1,Ali');
  });

  it("DTO: month majburiy va YYYY-MM formatida", async () => {
    expect(await validate(plainToInstance(TaxReportQueryDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(TaxReportQueryDto, { month: '2026-1' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(TaxReportQueryDto, { month: '2026-10' }))).toHaveLength(0);
  });
});
