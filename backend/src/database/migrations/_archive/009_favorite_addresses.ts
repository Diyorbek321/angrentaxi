import { MigrationInterface, QueryRunner } from 'typeorm';

// Passenger saved addresses (Yandex Go's "Uy"/"Ish"/saved-places equivalent).
// Like 002-008, dev environments run with DB_SYNC on; this documents the
// production path (now required, since synchronize defaults OFF in
// production per db-synchronize.util.ts).
export class FavoriteAddresses1700000000009 implements MigrationInterface {
  name = 'FavoriteAddresses1700000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS favorite_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        label VARCHAR(50) NOT NULL,
        address VARCHAR(500) NOT NULL,
        lat DECIMAL(10, 7) NOT NULL,
        lng DECIMAL(10, 7) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_favorite_addresses_user_id ON favorite_addresses(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS favorite_addresses;
    `);
  }
}
