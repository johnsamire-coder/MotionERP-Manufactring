export class WorkflowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowNotFoundError';
  }
}
export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}
export class WorkflowForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowForbiddenError';
  }
}
