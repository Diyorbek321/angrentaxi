import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Schema bring-up on boot.
 *
 * TypeORM's built-in order is "migrations, then synchronize". That is right
 * almost always — migrations also repair drift that would make synchronize
 * itself fail (see 013) — except for one case: a database whose schema was
 * built by synchronize and is now missing tables. The baseline migration
 * refuses such a schema and tells the operator to boot once with
 * DB_SYNC=true, but the refusal fired before synchronize could add the
 * tables, so the server could not start either way.
 *
 * So: migrations first; if — and only if — the baseline refused a partial
 * schema AND synchronize is enabled, synchronize and run migrations again.
 * Migrations 001+ are idempotent (IF NOT EXISTS), so the second pass is safe.
 * With DB_SYNC off (production default) a partial schema still stops the boot.
 */
export async function bootDataSource(dataSource: DataSource, synchronize: boolean): Promise<DataSource> {
  await dataSource.initialize();
  try {
    try {
      await dataSource.runMigrations();
    } catch (error) {
      if (!synchronize || !isPartialSchemaError(error)) throw error;
      await dataSource.synchronize();
      await dataSource.runMigrations();
      return dataSource;
    }
    if (synchronize) {
      await dataSource.synchronize();
    }
    return dataSource;
  } catch (error) {
    // TypeOrmModule retries a failed boot with a fresh DataSource; close this
    // one so each retry does not leave a connection pool behind.
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    throw error;
  }
}

// Matched by name rather than instanceof: migrations are loaded from their own
// files by TypeORM, and a second copy of the class (ts vs compiled js) would
// make instanceof fail silently.
function isPartialSchemaError(error: unknown): boolean {
  return error instanceof Error && error.name === 'PartialSchemaError';
}

/** The options TypeORM itself sees: schema steps are left to [bootDataSource]. */
export function schemaBootOptions(options: DataSourceOptions): DataSourceOptions {
  return { ...options, synchronize: false, migrationsRun: false };
}
