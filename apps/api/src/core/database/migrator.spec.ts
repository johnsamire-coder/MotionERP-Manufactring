import { resolve } from 'node:path';
import { mergeMigrationStatus, readJournal, type JournalEntry } from './migrator';

describe('mergeMigrationStatus', () => {
  const entries: JournalEntry[] = [
    { idx: 1, version: '7', when: 200, tag: '0001_second' },
    { idx: 0, version: '7', when: 100, tag: '0000_first' },
  ];

  it('orders by journal index regardless of input order', () => {
    const rows = mergeMigrationStatus(entries, new Set());
    expect(rows.map((row) => row.tag)).toEqual(['0000_first', '0001_second']);
  });

  it('marks an entry applied when its timestamp is in the applied set', () => {
    const rows = mergeMigrationStatus(entries, new Set(['100']));

    expect(rows[0]).toEqual({
      tag: '0000_first',
      when: 100,
      applied: true,
      appliedAt: new Date(100).toISOString(),
    });
    expect(rows[1]).toEqual({
      tag: '0001_second',
      when: 200,
      applied: false,
      appliedAt: null,
    });
  });

  it('returns an empty list for an empty journal', () => {
    expect(mergeMigrationStatus([], new Set())).toEqual([]);
  });
});

describe('readJournal', () => {
  it('reads the committed project migrations journal', () => {
    const journal = readJournal(resolve(process.cwd(), 'drizzle', 'migrations'));

    expect(journal.dialect).toBe('postgresql');
    expect(Array.isArray(journal.entries)).toBe(true);
  });
});
