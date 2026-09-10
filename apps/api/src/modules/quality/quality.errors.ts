export class QualityNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "QualityNotFoundError"; }
}
export class QualityValidationError extends Error {
  constructor(message: string) { super(message); this.name = "QualityValidationError"; }
}
