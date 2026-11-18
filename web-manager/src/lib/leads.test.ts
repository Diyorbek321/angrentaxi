import { describe, expect, it } from 'vitest';
import { isLeadFinal, leadDetailEntries } from './leads';

describe('leads', () => {
  it('tafsilotlar tartib bilan, bo‘shlari tashlanadi', () => {
    expect(leadDetailEntries({ comment: 'x', carYear: 2019, carModel: 'Cobalt', address: '' })).toEqual([
      ['carModel', 'Cobalt'],
      ['carYear', '2019'],
      ['comment', 'x'],
    ]);
  });

  it('yakuniy holatlar', () => {
    expect(isLeadFinal('accepted')).toBe(true);
    expect(isLeadFinal('rejected')).toBe(true);
    expect(isLeadFinal('new')).toBe(false);
    expect(isLeadFinal('contacted')).toBe(false);
  });
});
