/**
 * Resolves whether TypeORM's `synchronize` option should be enabled.
 *
 * Auto-syncing the schema from entities is convenient in development but
 * dangerous in production (it can silently alter/drop columns on deploy).
 * This function keeps the existing dev convenience while defaulting
 * synchronize OFF in production unless explicitly opted into via
 * DB_SYNC=true.
 *
 * - Non-production (development, test, undefined, etc.): defaults ON.
 *   Set DB_SYNC=false to disable.
 * - Production: defaults OFF. Set DB_SYNC=true to explicitly opt in.
 */
export function resolveDbSynchronize(
  nodeEnv: string | undefined,
  dbSync: string | undefined,
): boolean {
  if (nodeEnv === 'production') {
    return dbSync === 'true';
  }

  return dbSync !== 'false';
}
