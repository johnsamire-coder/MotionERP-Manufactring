/**
 * Aggregated Drizzle schema barrel.
 *
 * This is the SINGLE place drizzle-kit reads table definitions from. Each module
 * keeps its own `*.schema.ts` file and re-exports it here, so there is one
 * registration point and one migration history.
 */
export * from '../../../modules/organization/organization.schema';

export * from '../../../modules/catalog/catalog.schema';

export * from '../../../modules/inventory/inventory.schema';

export * from '../../../modules/crm/crm.schema';

export * from '../../../modules/sales/sales.schema';
