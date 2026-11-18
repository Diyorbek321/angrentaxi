import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/**
 * Maps camelCase entity properties to snake_case database identifiers.
 *
 * This lives in its own module because *every* DataSource in the codebase must
 * use the same instance of it. It used to be declared privately inside
 * AppModule, so the standalone CLI DataSource (`config/typeorm.config.ts`) had
 * no naming strategy at all — `migration:generate` produced migrations with
 * camelCase columns (`pickupLocation`) while the running app created and
 * queried snake_case ones (`pickup_location`). Any migration generated that
 * way builds a schema the application cannot read, and the hand-written raw
 * SQL in the order services fails outright.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  columnName(propertyName: string, customName: string): string {
    return customName || propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  relationName(propertyName: string): string {
    return propertyName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return `${relationName.replace(/([A-Z])/g, '_$1').toLowerCase()}_${referencedColumnName}`;
  }
}
