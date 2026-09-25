import { reorderSuggestion } from './reorder.service';

describe('Reorder level (plan item 22)', () => {
  it('suggests max(reorder qty, deficit) once projected ≤ level, nothing above it', () => {
    expect(reorderSuggestion(51, 50, 100)).toBeNull();
    expect(reorderSuggestion(50, 50, 100)).toBe(100);
    expect(reorderSuggestion(10, 50, 20)).toBe(40); // deficit 40 > reorder qty 20
    expect(reorderSuggestion(-30, 50, 20)).toBe(80); // over-reserved stock
  });
});
