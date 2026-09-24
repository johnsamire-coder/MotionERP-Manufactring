export class SupportNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'SupportNotFoundError'; }
}
export class SupportValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'SupportValidationError'; }
}
