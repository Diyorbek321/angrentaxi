import { likePattern } from './catalog-moderation-query.dto';

describe('likePattern', () => {
  it('qidiruvni % bilan o\'raydi', () => {
    expect(likePattern('osh')).toBe('%osh%');
  });

  it('% va _ ni oddiy belgi qiladi (hamma narsaga mos kelmasin)', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
    expect(likePattern('a\\b')).toBe('%a\\\\b%');
  });
});
