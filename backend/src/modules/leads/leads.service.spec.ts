import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { formatLeadMessage, LeadsService } from './leads.service';

const base = { type: 'driver', name: 'Aziz Karimov', phone: '+998901234567', consent: true };

describe('LeadsService', () => {
  let repo: Record<string, jest.Mock>;
  let telegram: { send: jest.Mock };
  let service: LeadsService;

  beforeEach(() => {
    repo = {
      exist: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'lead-1', ...x })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn(),
    };
    telegram = { send: jest.fn().mockResolvedValue(true) };
    service = new LeadsService(repo as never, telegram as never);
  });

  it('saqlaydi va Telegramga yuboradi', async () => {
    await service.create({ ...base, carModel: 'Cobalt', carYear: 2019 } as CreateLeadDto);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'driver',
        phone: '+998901234567',
        details: { carModel: 'Cobalt', carYear: 2019 },
        status: 'new',
        lang: 'uz',
      }),
    );
    expect(telegram.send).toHaveBeenCalledTimes(1);
  });

  it('honeypot to‘ldirilgan — jim tashlanadi', async () => {
    await service.create({ ...base, website: 'http://spam' } as CreateLeadDto);
    expect(repo.exist).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('24 soat ichidagi takror — saqlanmaydi, xabar yo‘q', async () => {
    repo.exist.mockResolvedValue(true);
    await service.create(base as CreateLeadDto);
    expect(repo.save).not.toHaveBeenCalled();
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('Telegram xatosi arizani buzmaydi', async () => {
    telegram.send.mockResolvedValue(false);
    await expect(service.create(base as CreateLeadDto)).resolves.toBeUndefined();
  });

  it('ro‘yxat: filtr va sahifalash', async () => {
    await service.list({ type: 'partner', status: 'new', page: 2, limit: 10 });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'partner', status: 'new' }, skip: 10, take: 10 }),
    );
  });

  it('holatni yangilaydi; bo‘sh izoh null bo‘ladi', async () => {
    repo.findOne.mockResolvedValue({ id: 'a', status: 'new', note: 'eski' });
    const res = await service.update('a', { status: 'contacted', note: '  ' });
    expect(res).toEqual(expect.objectContaining({ status: 'contacted', note: null }));
  });

  it('topilmasa 404', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.update('x', { status: 'accepted' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Telegram matni HTML-escape qilinadi', () => {
    const msg = formatLeadMessage({
      type: 'partner',
      name: '<b>X</b>',
      phone: '+998901234567',
      details: { businessName: 'A & B' },
      lang: 'ru',
    });
    expect(msg).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(msg).toContain('A &amp; B');
  });
});

describe('CreateLeadDto', () => {
  const errorsFor = async (body: unknown) =>
    (await validate(plainToInstance(CreateLeadDto, body))).map((e) => e.property);

  it('to‘g‘ri ariza o‘tadi; raqam normallashadi', async () => {
    const dto = plainToInstance(CreateLeadDto, { ...base, phone: '90 123-45-67' });
    expect(dto.phone).toBe('+998901234567');
    expect(await errorsFor({ ...base, phone: '(90) 123 45 67' })).toEqual([]);
  });

  it('rozilik yo‘q — rad', async () => {
    expect(await errorsFor({ ...base, consent: false })).toEqual(['consent']);
    expect(await errorsFor({ ...base, consent: undefined })).toEqual(['consent']);
  });

  it('noto‘g‘ri raqam, tur, ism — rad', async () => {
    expect(await errorsFor({ ...base, phone: '+79001234567' })).toEqual(['phone']);
    expect(await errorsFor({ ...base, type: 'admin' })).toEqual(['type']);
    expect(await errorsFor({ ...base, name: '<script>' })).toEqual(['name']);
  });

  it('mashina yili chegarada', async () => {
    expect(await errorsFor({ ...base, carYear: 1980 })).toEqual(['carYear']);
    expect(await errorsFor({ ...base, carYear: '2018' })).toEqual([]);
  });
});
