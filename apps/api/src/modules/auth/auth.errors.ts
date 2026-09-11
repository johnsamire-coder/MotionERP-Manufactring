export class AuthNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "AuthNotFoundError"; }
}
export class AuthValidationError extends Error {
  constructor(message: string) { super(message); this.name = "AuthValidationError"; }
}
