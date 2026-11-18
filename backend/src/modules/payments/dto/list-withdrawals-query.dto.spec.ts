import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListWithdrawalsQueryDto } from './list-withdrawals-query.dto';
import { WithdrawalStatus } from '../../../database/entities/withdrawal-request.entity';

// Same options as the global pipe in main.ts. forbidNonWhitelisted is what
// broke the admin withdrawals page: the query was validated against plain
// PaginationDto, so the panel's `status` filter was rejected as unknown.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const metadata: ArgumentMetadata = { type: 'query', metatype: ListWithdrawalsQueryDto };

describe('ListWithdrawalsQueryDto', () => {
  it('accepts the status filter the admin and manager panels send', async () => {
    const result = await pipe.transform({ page: '1', limit: '20', status: 'pending' }, metadata);

    expect(result).toEqual({ page: 1, limit: 20, status: WithdrawalStatus.PENDING });
  });

  it('accepts a query without a status', async () => {
    const result = await pipe.transform({ page: '2' }, metadata);

    expect(result.status).toBeUndefined();
    expect(result.page).toBe(2);
  });

  it('rejects an unknown status value', async () => {
    await expect(pipe.transform({ status: 'nope' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
