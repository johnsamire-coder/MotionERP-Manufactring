/**
 * Money — Architecture Decisions D18 / D19.
 *
 * Every monetary amount in Motion ERP is stored as (value + currency).
 * The value is a DECIMAL STRING, never a JavaScript `number`, because binary
 * floating point silently rounds money (0.1 + 0.2 !== 0.3).
 *
 * Arithmetic on Money (add / subtract / convert) is intentionally NOT provided
 * yet — it will be added in a later phase together with the chosen decimal
 * library and the exchange-rate model.
 */
export interface Money {
  /** Decimal string, e.g. "1234.50". */
  readonly amount: string;
  /** ISO 4217 alphabetic code, e.g. "EGP", "USD". */
  readonly currency: string;
}

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Cannot operate on amounts in different currencies: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

/** Runtime type guard for values coming from the wire or the database. */
export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.amount === 'string' &&
    DECIMAL_STRING.test(candidate.amount) &&
    typeof candidate.currency === 'string' &&
    CURRENCY_CODE.test(candidate.currency)
  );
}

/** Construct a validated Money value. Throws on a float amount or a bad code. */
export function money(amount: string, currency: string): Money {
  if (typeof amount !== 'string' || !DECIMAL_STRING.test(amount)) {
    throw new InvalidMoneyError(
      `Invalid money amount: ${JSON.stringify(amount)} (must be a decimal string, not a float)`,
    );
  }
  if (!CURRENCY_CODE.test(currency)) {
    throw new InvalidMoneyError(
      `Invalid currency code: ${JSON.stringify(currency)} (must be a 3-letter ISO 4217 code)`,
    );
  }
  return { amount, currency };
}

/** Guard against mixing currencies in the same calculation. */
export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}
