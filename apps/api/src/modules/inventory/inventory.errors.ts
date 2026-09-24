export class InventoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryNotFoundError';
  }
}
export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}
/** The logged-in user is not allowed to touch this warehouse / scope (plan item 5.2). */
export class InventoryForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryForbiddenError';
  }
}
