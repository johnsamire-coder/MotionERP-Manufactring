export class CatalogNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "CatalogNotFoundError"; }
}
export class CatalogValidationError extends Error {
  constructor(message: string) { super(message); this.name = "CatalogValidationError"; }
}
