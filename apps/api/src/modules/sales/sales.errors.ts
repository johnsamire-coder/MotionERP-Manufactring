export class SalesNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "SalesNotFoundError"; }
}
export class SalesValidationError extends Error {
  constructor(message: string) { super(message); this.name = "SalesValidationError"; }
}
