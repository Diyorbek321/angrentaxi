import { describe, expect, it } from 'vitest';
import { isFinal, LOST_ITEM_STATUS_LABEL, needsDispatcher } from './lost-items';

describe('lost item states', () => {
  it('a found item needs the dispatcher to arrange the handover', () => {
    expect(needsDispatcher('found')).toBe(true);
    expect(needsDispatcher('open')).toBe(false);
  });

  it('returned and closed are final', () => {
    expect(isFinal('returned')).toBe(true);
    expect(isFinal('closed')).toBe(true);
    expect(isFinal('found')).toBe(false);
  });

  it('every status has a label', () => {
    for (const s of ['open', 'found', 'not_found', 'returned', 'closed'] as const) {
      expect(LOST_ITEM_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
