import { MigrationInterface, QueryRunner } from 'typeorm';

// Persisted refresh tokens: the table behind logout, refresh-token rotation and
// reuse detection. Before it, a leaked refresh token was valid for 30 days with
// no way to revoke it. Only the SHA-256 digest of each token is stored.
// Like 002-022, dev environments run with DB_SYNC on; this documents the
// production path.
export class RefreshTokens1700000000023 implements MigrationInterface {
  name = 'RefreshTokens1700000000023';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        replaced_by_token_hash VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        ip VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
      DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
      DROP TABLE IF EXISTS refresh_tokens;
    `);
  }
}
