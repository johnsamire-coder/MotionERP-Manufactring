export class InventoryNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "InventoryNotFoundError"; }
}
export class InventoryValidationError extends Error {
  constructor(message: string) { super(message); this.name = "InventoryValidationError"; }
}
