export class AccountingNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "AccountingNotFoundError"; }
}
export class AccountingValidationError extends Error {
  constructor(message: string) { super(message); this.name = "AccountingValidationError"; }
}
