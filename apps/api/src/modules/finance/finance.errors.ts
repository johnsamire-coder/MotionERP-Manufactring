export class FinanceNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "FinanceNotFoundError"; }
}
export class FinanceValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FinanceValidationError"; }
}
