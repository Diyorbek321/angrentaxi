import * as fs from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { ENTITIES } from './entities';

/**
 * An entity missing from the connection's list boots fine and then throws
 * EntityMetadataNotFoundError on first use (see entities.ts). This loads every
 * entity file and checks that each @Entity class is registered.
 */
type EntityClass = abstract new (...args: never[]) => unknown;

describe('ENTITIES', () => {
  it('registers every class decorated with @Entity', () => {
    const dir = path.join(__dirname, 'entities');
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.entity.ts')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(path.join(dir, file));
      }
    }

    const decorated = getMetadataArgsStorage()
      .tables.map((table) => table.target)
      .filter((target): target is EntityClass => typeof target === 'function');
    const registered = new Set<EntityClass>(ENTITIES);

    const missing = decorated.filter((target) => !registered.has(target)).map((t) => t.name);
    expect(missing).toEqual([]);
  });
});
