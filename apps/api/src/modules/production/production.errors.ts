export class ProductionNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "ProductionNotFoundError"; }
}
export class ProductionValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ProductionValidationError"; }
}
