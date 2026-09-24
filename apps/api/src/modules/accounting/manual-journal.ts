/**
 * The accruals, tax/customs and overhead services were written against a
 * `createManualJournalEntry` method that PostingEngineService does not have, so today they
 * fall back to a placeholder journal (see the status report). This keeps that behaviour typed.
 */
export interface ManualJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  [key: string]: unknown;
}
export interface PostedJournal {
  id: string;
  lines?: ManualJournalLine[];
  [key: string]: unknown;
}
export interface ManualJournalPoster {
  createManualJournalEntry(payload: unknown): Promise<PostedJournal>;
}

export function manualJournalPoster(engine: unknown): ManualJournalPoster | null {
  const candidate = engine as Partial<ManualJournalPoster> | null | undefined;
  return candidate && typeof candidate.createManualJournalEntry === 'function'
    ? (candidate as ManualJournalPoster)
    : null;
}
