export class PlanningNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "PlanningNotFoundError"; }
}
export class PlanningValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PlanningValidationError"; }
}
