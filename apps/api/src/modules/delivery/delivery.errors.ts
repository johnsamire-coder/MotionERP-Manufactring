export class DeliveryNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "DeliveryNotFoundError"; }
}
export class DeliveryValidationError extends Error {
  constructor(message: string) { super(message); this.name = "DeliveryValidationError"; }
}
