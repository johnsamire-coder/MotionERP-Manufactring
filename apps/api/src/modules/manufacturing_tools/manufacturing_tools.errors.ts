export class ManufacturingToolsNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManufacturingToolsNotFoundError';
  }
}
export class ManufacturingToolsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManufacturingToolsValidationError';
  }
}
