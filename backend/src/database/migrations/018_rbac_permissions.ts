import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds a fine-grained permissions list to `users`, consulted only for
// MANAGER accounts (see PermissionsGuard/Permission enum on the User
// entity) — this is what lets an admin designate one manager as
// dispatch-only and another as full operations, without a separate account
// type. ADMIN always has every permission implicitly and never reads this
// column.
//
// Backfill: every EXISTING manager gets the full permission list, so this
// migration is purely additive from their point of view — nobody who could
// already do something yesterday loses access today. Going forward, an
// admin can deliberately narrow a specific manager's permissions from the
// new Staff & Roles screen; new managers start with the full set too
// (see UsersService.createWithRole) until an admin chooses to restrict them.
export class RbacPermissions1700000000018 implements MigrationInterface {
  name = 'RbacPermissions1700000000018';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
    `);

    await queryRunner.query(`
      UPDATE users SET permissions = '[
        "dispatch", "drivers_view", "drivers_approve", "drivers_finance",
        "tariffs_manage", "promo_manage", "bonuses_view", "support_manage",
        "withdrawals_view", "users_view"
      ]'::jsonb
      WHERE role = 'manager';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS permissions;`);
  }
}
