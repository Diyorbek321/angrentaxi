import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { MAX_WITHDRAWAL_AMOUNT, MIN_WITHDRAWAL_AMOUNT, RequestWithdrawalDto } from './request-withdrawal.dto';

// main.ts dagi global pipe bilan bir xil sozlamalar.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});
const metadata: ArgumentMetadata = { type: 'body', metatype: RequestWithdrawalDto };
const body = (amount: unknown) => ({ amount, payoutDestination: '8600 1234 5678 9012' });

describe('RequestWithdrawalDto', () => {
  it('butun so\'m, chegaralar ichida — qabul qilinadi', async () => {
    await expect(pipe.transform(body(150000), metadata)).resolves.toMatchObject({ amount: 150000 });
    await expect(pipe.transform(body(MIN_WITHDRAWAL_AMOUNT), metadata)).resolves.toBeDefined();
    await expect(pipe.transform(body(MAX_WITHDRAWAL_AMOUNT), metadata)).resolves.toBeDefined();
  });

  it.each([
    ['0.01', 0.01],
    ['kasr', 15000.5],
    ['minimumdan kam', MIN_WITHDRAWAL_AMOUNT - 1],
    ['numeric(10,2) dan katta', 1e9],
    ['maksimumdan katta', MAX_WITHDRAWAL_AMOUNT + 1],
    ['manfiy', -50000],
  ])('%s — rad etiladi', async (_label, amount) => {
    await expect(pipe.transform(body(amount), metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chegaralar oqilona: minimum 10 000, maksimum numeric(10,2) ostida', () => {
    expect(MIN_WITHDRAWAL_AMOUNT).toBe(10000);
    expect(MAX_WITHDRAWAL_AMOUNT).toBeLessThan(1e8);
  });
});
