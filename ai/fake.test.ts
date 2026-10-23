/**
 * The deterministic fake behind `?ai=fake` and the screen tests. Pinned here so
 * the e2e baselines and the screen tests can rely on exactly what it returns.
 */
import type { Fact, ParseContext } from './contract';
import { createFakeSuitoAi, fakeParse } from './fake';

const ja: ParseContext = {
  expCats: ['食費', '交通費', '日用品'],
  incCats: ['給料', 'ボーナス'],
  today: { y: 2026, m: 9, day: 23 },
  locale: 'ja',
};
const en: ParseContext = {
  expCats: ['Food', 'Transport'],
  incCats: ['Salary', 'Bonus'],
  today: { y: 2026, m: 0, day: 1 },
  locale: 'en',
};

const fact = (id: string, tone: Fact['tone']): Fact => ({
  id,
  label: id,
  display: id.toUpperCase(),
  value: 1,
  tone,
});

describe('fakeParse', () => {
  it('maps ランチ to 食費 and reads the amount', () => {
    expect(fakeParse('ランチ 850', ja)).toEqual({ amount: 850, category: '食費', note: 'ランチ' });
  });

  it('reads 昨日, maps スタバ to 食費 and keeps スタバ as the note', () => {
    expect(fakeParse('昨日 スタバ 620', ja)).toEqual({
      date: { y: 2026, m: 9, day: 22 },
      amount: 620,
      category: '食費',
      note: 'スタバ',
    });
  });

  it('switches to income for 給料 and picks the income category', () => {
    expect(fakeParse('給料 300000', ja)).toMatchObject({ type: 'income', amount: 300000, category: '給料' });
  });

  it('handles English phrases, slash dates and month rollover for yesterday', () => {
    expect(fakeParse('lunch 850 yesterday', en)).toEqual({
      date: { y: 2025, m: 11, day: 31 },
      amount: 850,
      category: 'Food',
      note: 'lunch',
    });
    expect(fakeParse('10/3 train 200', en)).toMatchObject({
      date: { y: 2026, m: 9, day: 3 },
      amount: 200,
      category: 'Transport',
    });
  });

  it('only ever picks a category from the passed list', () => {
    expect(fakeParse('ランチ 850', { ...ja, expCats: ['日用品'] })).toEqual({ amount: 850, note: 'ランチ' });
  });

  it('returns null for a phrase with nothing to fill', () => {
    expect(fakeParse('よくわからない', ja)).toBeNull();
  });
});

describe('createFakeSuitoAi', () => {
  const ai = createFakeSuitoAi({ chunkDelayMs: 1 });

  it('reports everything available', async () => {
    await expect(ai.availability()).resolves.toEqual({ onDevice: 'available', system: 'available' });
  });

  it('writes two paragraphs citing the first facts, with no literal digits', async () => {
    const draft = await ai.writeLetter({
      y: 2026,
      m: 8,
      facts: [fact('a', 'neutral'), fact('b', 'positive')],
      locale: 'en',
    });
    expect(draft!.paragraphs).toHaveLength(2);
    expect(draft!.paragraphs[0]).toContain('{f:a}');
    expect(draft!.paragraphs[1]).toContain('{f:b}');
    for (const p of draft!.paragraphs) expect(p.replace(/\{f:[^}]+\}/g, '')).not.toMatch(/\d|—/);
  });

  it('nudges the first watch fact, else the first positive, else nothing', async () => {
    const facts = [fact('n', 'neutral'), fact('p', 'positive'), fact('w', 'watch')];
    expect((await ai.pickNudge({ facts, locale: 'en' }))!.text).toContain('{f:w}');
    expect((await ai.pickNudge({ facts: facts.slice(0, 2), locale: 'en' }))!.text).toContain('{f:p}');
    expect(await ai.pickNudge({ facts: [fact('n', 'neutral')], locale: 'en' })).toBeNull();
  });

  it('streams cumulative text in three chunks and flags advice questions', async () => {
    const seen: string[] = [];
    const plain = await ai.ask(
      { requestId: 'r1', question: 'How much this month?', history: [], locale: 'en' },
      (t) => seen.push(t),
    );
    expect(seen).toHaveLength(3);
    expect(seen[2]).toBe(plain.text);
    expect(seen[1].startsWith(seen[0])).toBe(true);
    expect(plain.needsStrongerModel).toBe(false);

    const hard = await ai.ask(
      { requestId: 'r2', question: 'どうすれば貯金できる？', history: [], locale: 'ja' },
      () => {},
    );
    expect(hard.needsStrongerModel).toBe(true);
  });

  it('stops streaming once cancelled', async () => {
    const seen: string[] = [];
    const pending = ai.ask({ requestId: 'r3', question: 'q', history: [], locale: 'en' }, (t) => {
      seen.push(t);
      ai.cancelAsk('r3');
    });
    await pending;
    expect(seen).toHaveLength(1);
  });
});
