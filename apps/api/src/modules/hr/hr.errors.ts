export class HrNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "HrNotFoundError"; }
}
export class HrValidationError extends Error {
  constructor(message: string) { super(message); this.name = "HrValidationError"; }
}
