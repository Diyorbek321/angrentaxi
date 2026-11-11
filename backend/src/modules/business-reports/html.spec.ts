import { escapeHtml, formatWait } from './html';

describe('html helpers', () => {
  it('escapes tags and ampersands', () => {
    expect(escapeHtml('<b>A & B</b>')).toBe('&lt;b&gt;A &amp; B&lt;/b&gt;');
  });

  it('shows waits under two days in hours, longer ones in days', () => {
    expect(formatWait(6)).toBe('6 soat');
    expect(formatWait(47)).toBe('47 soat');
    expect(formatWait(255)).toBe('10 kun');
    expect(formatWait(2743)).toBe('114 kun');
  });
});
