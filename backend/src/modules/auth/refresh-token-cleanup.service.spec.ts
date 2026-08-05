import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import {
  REFRESH_TOKEN_RETENTION_DAYS,
  RefreshTokenCleanupService,
} from './refresh-token-cleanup.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Every refresh rotates the token — a new row in, the old one revoked — so
 * `refresh_tokens` grows once per refresh per device and previously never
 * shrank. This job prunes it on a schedule.
 */
describe('RefreshTokenCleanupService', () => {
  const NOW = new Date('2026-08-05T03:00:00.000Z');

  let service: RefreshTokenCleanupService;
  let del: jest.Mock;

  beforeEach(async () => {
    del = jest.fn().mockResolvedValue({ affected: 7 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenCleanupService,
        { provide: getRepositoryToken(RefreshToken), useValue: { delete: del } },
      ],
    }).compile();

    service = module.get<RefreshTokenCleanupService>(RefreshTokenCleanupService);
  });

  function capturedCutoff(): Date {
    const [criteria] = del.mock.calls[0] as [{ expiresAt: FindOperator<Date> }];
    return criteria.expiresAt.value;
  }

  it('deletes only rows whose expiry is older than the retention window', async () => {
    await service.pruneExpiredTokens(NOW);

    expect(del).toHaveBeenCalledTimes(1);
    const cutoff = capturedCutoff();
    expect(cutoff.getTime()).toBe(NOW.getTime() - REFRESH_TOKEN_RETENTION_DAYS * MS_PER_DAY);
  });

  it('keys deletion off expiry, never off revocation', async () => {
    await service.pruneExpiredTokens(NOW);

    // A revoked-but-unexpired row is exactly what reuse detection matches on
    // when a stolen copy of a rotated-away token is replayed. Deleting by
    // revokedAt would downgrade "revoke the whole family" to a plain 401.
    const [criteria] = del.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(criteria)).toEqual(['expiresAt']);
    expect(criteria.revokedAt).toBeUndefined();
  });

  it('reports how many rows it removed', async () => {
    await expect(service.pruneExpiredTokens(NOW)).resolves.toBe(7);
  });

  it('treats an undefined affected count as zero rows', async () => {
    del.mockResolvedValue({});

    await expect(service.pruneExpiredTokens(NOW)).resolves.toBe(0);
  });

  it('swallows a failed run so a database hiccup cannot kill the scheduler', async () => {
    del.mockRejectedValue(new Error('connection lost'));

    await expect(service.handleCron()).resolves.toBeUndefined();
  });

  it('runs the prune from the cron entrypoint', async () => {
    await service.handleCron();

    expect(del).toHaveBeenCalledTimes(1);
  });
});
