/**
 * Domain errors for the organizational core. The service throws these; it never
 * knows about HTTP. `OrganizationExceptionFilter` maps them to status codes.
 */

export class OrgNodeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgNodeNotFoundError';
  }
}

/** Missing/blank/invalid input on the node itself. */
export class OrgNodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgNodeValidationError';
  }
}

/** A parent/child relationship that the parent-type rules or lifecycle forbid. */
export class OrgParentingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgParentingError';
  }
}

/** The requested parent link would make a node its own ancestor. */
export class OrgCycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgCycleError';
  }
}

/** A lifecycle rule was violated (e.g. editing/archiving in a way that is not allowed). */
export class OrgLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgLifecycleError';
  }
}
