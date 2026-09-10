export class ProductionOpsNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "ProductionOpsNotFoundError"; }
}
export class ProductionOpsValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ProductionOpsValidationError"; }
}
