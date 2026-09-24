import { fillPlaceholders } from './workflow-automation.service';

describe('Workflow automation placeholders (plan item 50)', () => {
  it('fills event and context fields; unknown ones become empty', () => {
    expect(
      fillPlaceholders('{{documentType}} {{toState}} {{context.amount}} {{missing}}!', {
        documentType: 'pr',
        toState: 'approved',
        context: { amount: 15000 },
      }),
    ).toBe('pr approved 15000 !');
  });
});
