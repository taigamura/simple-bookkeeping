import type { Fact, SnapshotEntry } from './contract';
import { buildHandoffPrompt } from './handoff';

const facts: Fact[] = [
  { id: 'expense-total', label: 'Spending this month', display: '¥82,400', value: 82400, tone: 'neutral' },
  { id: 'cat-total:食費', label: 'Food spending — this month', display: '¥31,000', value: 31000, tone: 'neutral' },
];

const e = (i: number, over: Partial<SnapshotEntry> = {}): SnapshotEntry => ({
  id: `e${i}`,
  date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
  type: 'expense',
  amount: 100 + i,
  category: '日用品',
  note: '',
  repeat: false,
  ...over,
});

describe('buildHandoffPrompt', () => {
  it('Japanese prompt: question, facts with displays, entries, and a do-not-recalculate instruction', () => {
    const p = buildHandoffPrompt({
      question: '食費を減らすコツは？',
      facts,
      entries: [e(1, { category: '食費', note: 'スタバ', amount: 620 }), e(2, { type: 'income', category: '給料', amount: 300000 })],
      locale: 'ja',
    });
    expect(p).toContain('食費を減らすコツは？');
    expect(p).toContain('¥82,400');
    expect(p).toContain('¥31,000');
    expect(p).toContain('スタバ');
    expect(p).toContain('620');
    expect(p).toMatch(/計算済み/);
    expect(p).toMatch(/再計算しないで/);
    expect(p).not.toMatch(/[—―]/);
  });

  it('English prompt', () => {
    const p = buildHandoffPrompt({ question: 'How can I spend less on food?', facts, entries: [e(1)], locale: 'en' });
    expect(p).toContain('How can I spend less on food?');
    expect(p).toMatch(/already computed/i);
    expect(p).toMatch(/do not recalculate/i);
    expect(p).not.toMatch(/[—―]/);
    expect(p).not.toMatch(/[ぁ-ん]/);
  });

  it('caps entries at 60, preferring ones relevant to the question', () => {
    const entries = [
      ...Array.from({ length: 100 }, (_, i) => e(i)),
      e(500, { category: '食費', note: 'ランチ', date: '2026-01-02' }),
    ];
    const p = buildHandoffPrompt({ question: '食費はどう？', facts, entries, locale: 'ja' });
    const lines = p.split('\n').filter((l) => /^\d{4}-\d{2}-\d{2} /.test(l));
    expect(lines).toHaveLength(60);
    expect(p).toContain('ランチ');
  });

  it('strips em dashes coming from the question or notes', () => {
    const p = buildHandoffPrompt({
      question: 'Food — is it high?',
      facts,
      entries: [e(1, { note: 'lunch — team' })],
      locale: 'en',
    });
    expect(p).not.toMatch(/[—―]/);
    expect(p).toContain('Food, is it high?');
  });
});
