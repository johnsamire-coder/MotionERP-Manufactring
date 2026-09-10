export class TechnicalNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "TechnicalNotFoundError"; }
}
export class TechnicalValidationError extends Error {
  constructor(message: string) { super(message); this.name = "TechnicalValidationError"; }
}
