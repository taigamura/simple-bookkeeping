import { parseQuickEntryUrl, type QuickEntryDraft } from './quickEntryLinks';

const valid = 'kaji-quick-entry://new?amount=850&category=Food&note=Coffee&date=2026-08-10';

describe('quick-entry URL intake seam', () => {
  it('parses a URL into a draft without creating a transaction', () => {
    expect(parseQuickEntryUrl(valid)).toEqual<QuickEntryDraft>({
      type: 'expense', amountStr: '850', category: 'Food', note: 'Coffee',
      y: 2026, m: 7, day: 10, repeat: 'never',
    });
  });

  it('accepts a signed command payload as a draft only', () => {
    const command = encodeURIComponent(JSON.stringify({
      amount: 500, category: 'Food', note: 'Coffee', date: { y: 2026, m: 7, day: 10 },
    }));
    expect(parseQuickEntryUrl(`kaji-quick-entry://new?command=${command}`)).toEqual(
      expect.objectContaining({ amountStr: '500', category: 'Food', y: 2026, m: 7, day: 10 }),
    );
  });

  it.each([
    'https://example.test/new?amount=1&category=Food&date=2026-08-10',
    'kaji-quick-entry://new?amount=0&category=Food&date=2026-08-10',
    'kaji-quick-entry://new?amount=1&category=&date=2026-08-10',
    'kaji-quick-entry://other?amount=1&category=Food&date=2026-08-10',
    'kaji-quick-entry://new?amount=1&category=Food&date=not-a-date',
  ])('rejects malformed links: %s', (url) => {
    expect(parseQuickEntryUrl(url)).toBeNull();
  });
});
