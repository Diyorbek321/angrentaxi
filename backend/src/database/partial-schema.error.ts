/**
 * Thrown by the baseline migration when an existing schema is missing
 * tables. Named so the boot code (config/schema-boot.ts) can tell this
 * recoverable case — synchronize can add the tables — apart from a genuinely
 * broken migration.
 *
 * Lives outside migrations/: TypeORM loads every class exported from a
 * migration file as a migration.
 */
export class PartialSchemaError extends Error {
  readonly name = 'PartialSchemaError';
}
