/**
 * Aggregated Drizzle schema barrel.
 *
 * This is the SINGLE place drizzle-kit reads table definitions from. Each module
 * keeps its own `*.schema.ts` file and re-exports it here, so there is one
 * registration point and one migration history.
 */
export * from '../../../modules/organization/organization.schema';

export * from '../../../modules/settings/settings.schema';

export * from '../../../modules/catalog/catalog.schema';

export * from '../../../modules/inventory/inventory.schema';

export * from '../../../modules/crm/crm.schema';

export * from '../../../modules/sales/sales.schema';

export * from '../../../modules/planning/planning.schema';

export * from '../../../modules/technical/technical.schema';

export * from '../../../modules/production/production.schema';

export * from '../../../modules/production_ops/production_ops.schema';

export * from '../../../modules/quality/quality.schema';

export * from '../../../modules/cost/cost.schema';

export * from '../../../modules/delivery/delivery.schema';

export * from '../../../modules/accounting/accounting.schema';

export * from '../../../modules/finance/finance.schema';

export * from '../../../modules/hr/hr.schema';

export * from '../../../modules/auth/auth.schema';

export * from '../../../modules/accounting/accrual.schema';

export * from '../../../modules/accounting/tax-customs.schema';
export * from '../../../modules/audit/audit.schema';
export * from '../../../modules/inventory/purchase-batch-link.schema';
export * from '../../../modules/sales/sales-serial-link.schema';
export * from '../../../modules/workflow/workflow.schema';
export * from '../../../modules/support/support.schema';
export * from '../../../modules/projects/projects.schema';
export * from '../../../modules/assets/assets.schema';
export * from '../../../modules/printing/printing.schema';
export * from '../../../modules/regional/egypt/egypt.schema';
