export class SettingsNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsNotFoundError';
  }
}
export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}
