import { DataSource, DataSourceOptions } from 'typeorm';
import { bootDataSource, schemaBootOptions } from './schema-boot';
import { PartialSchemaError } from '../database/partial-schema.error';

/**
 * Hit for real on the local database: 9 tables were missing, the baseline
 * migration refused to run and advised "boot once with DB_SYNC=true" — which
 * could not work, because TypeORM runs migrations BEFORE synchronize, so the
 * refusal fired before synchronize could add the tables.
 *
 * Migrations still run first in every other case: they also repair drift
 * that would otherwise make synchronize itself fail (013).
 */
describe('bootDataSource', () => {
  function fakeDataSource(failures: Record<string, Error[]> = {}) {
    const calls: string[] = [];
    const step = (name: string) =>
      jest.fn(async () => {
        calls.push(name);
        const next = failures[name]?.shift();
        if (next) throw next;
      });
    const ds = {
      initialize: step('initialize'),
      synchronize: step('synchronize'),
      runMigrations: step('runMigrations'),
      destroy: step('destroy'),
      get isInitialized() {
        return calls.includes('initialize') && !calls.includes('destroy');
      },
    };
    return { ds: ds as unknown as DataSource, calls };
  }

  const partial = () => new PartialSchemaError('missing 2 table(s)');

  it('DB_SYNC off: only migrations', async () => {
    const { ds, calls } = fakeDataSource();
    await bootDataSource(ds, false);
    expect(calls).toEqual(['initialize', 'runMigrations']);
  });

  it('DB_SYNC on, healthy schema: migrations first, then synchronize', async () => {
    const { ds, calls } = fakeDataSource();
    await bootDataSource(ds, true);
    expect(calls).toEqual(['initialize', 'runMigrations', 'synchronize']);
  });

  it('DB_SYNC on, partial schema: synchronize fills the gap, then migrations run again', async () => {
    const { ds, calls } = fakeDataSource({ runMigrations: [partial()] });
    await bootDataSource(ds, true);
    expect(calls).toEqual(['initialize', 'runMigrations', 'synchronize', 'runMigrations']);
  });

  it('DB_SYNC off, partial schema: refuses to start (production never synchronizes on its own)', async () => {
    const { ds, calls } = fakeDataSource({ runMigrations: [partial()] });
    await expect(bootDataSource(ds, false)).rejects.toBeInstanceOf(PartialSchemaError);
    expect(calls).toEqual(['initialize', 'runMigrations', 'destroy']);
  });

  it('a genuinely broken migration is never papered over by synchronize', async () => {
    const { ds, calls } = fakeDataSource({ runMigrations: [new Error('syntax error')] });
    await expect(bootDataSource(ds, true)).rejects.toThrow('syntax error');
    expect(calls).toEqual(['initialize', 'runMigrations', 'destroy']);
  });
});

describe('schemaBootOptions', () => {
  it('takes synchronize and migrationsRun away from TypeORM so it cannot reorder them', () => {
    const options = { type: 'postgres', synchronize: true, migrationsRun: true } as DataSourceOptions;

    expect(schemaBootOptions(options)).toMatchObject({ synchronize: false, migrationsRun: false });
  });
});
