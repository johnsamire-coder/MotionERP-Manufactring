export class CostNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "CostNotFoundError"; }
}
export class CostValidationError extends Error {
  constructor(message: string) { super(message); this.name = "CostValidationError"; }
}
