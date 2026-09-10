export class CrmNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "CrmNotFoundError"; }
}
export class CrmValidationError extends Error {
  constructor(message: string) { super(message); this.name = "CrmValidationError"; }
}
