import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

/**
 * How long a refresh-token row is kept after the JWT it represents has expired.
 *
 * Expiry, not revocation, is the safe deletion trigger. AuthService.refreshToken
 * calls `jwtService.verify` before it ever looks the row up, so a token whose JWT
 * has expired is rejected on signature/exp alone — its row can no longer affect
 * any authentication decision. A *revoked but not yet expired* row, by contrast,
 * must be kept: it is exactly what reuse detection matches on when a stolen copy
 * of a rotated-away token is presented, so deleting it early would downgrade a
 * "revoke the whole family" response into a plain 401.
 *
 * The extra retention past expiry is purely forensic — it keeps the
 * replaced_by_token_hash rotation chain walkable while an incident is being
 * investigated.
 */
export const REFRESH_TOKEN_RETENTION_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Periodic pruning for the `refresh_tokens` table.
 *
 * Every refresh rotates the token, which writes a new row and revokes the old
 * one, so the table grows once per refresh per device and never shrinks on its
 * own. Without this job it is monotonically increasing, and the two indexed
 * lookups on it (token_hash, user_id) slow down along with it.
 *
 * Scheduling uses @nestjs/schedule, which the project already depends on and
 * already boots (MatchingModule's dispatch tick). Reusing it beats a hand-rolled
 * setInterval: it is declarative, testable by calling the method directly, and
 * shuts down with the Nest lifecycle instead of keeping the process alive.
 */
@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  // Daily, off-peak. The work is a single indexed DELETE, but there is no reason
  // to run it during the evening ride peak.
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'refresh-token-cleanup' })
  async handleCron(): Promise<void> {
    try {
      await this.pruneExpiredTokens();
    } catch (err) {
      // A failed prune must never take the scheduler (or the app) down — the
      // rows simply survive until the next run.
      this.logger.error(`Refresh token cleanup failed: ${err}`);
    }
  }

  /**
   * Deletes refresh tokens that expired more than REFRESH_TOKEN_RETENTION_DAYS
   * ago. Returns the number of rows removed so the cron log and tests can assert
   * on it.
   */
  async pruneExpiredTokens(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - REFRESH_TOKEN_RETENTION_DAYS * MS_PER_DAY);

    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(cutoff),
    });

    const deleted = result.affected ?? 0;

    if (deleted > 0) {
      this.logger.log(
        `Pruned ${deleted} refresh token(s) that expired before ${cutoff.toISOString()}`,
      );
    }

    return deleted;
  }
}
