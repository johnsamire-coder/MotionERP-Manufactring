/**
 * Aggregated Drizzle schema barrel.
 *
 * This is the SINGLE place drizzle-kit reads table definitions from. Each module
 * keeps its own `*.schema.ts` file and re-exports it here, so there is one
 * registration point and one migration history.
 */
export * from '../../../modules/organization/organization.schema';
