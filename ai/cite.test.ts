import { citedIds, factDisplays, renderCited } from './cite';

const displays = { 'expense-total': '¥12,400', 'cat-pace:食費': '+32%', 'no-spend-days': '5日' };

describe('factDisplays', () => {
  it('maps id to display', () => {
    expect(
      factDisplays([{ id: 'a', label: 'A', display: '¥1', value: 1, tone: 'neutral' }]),
    ).toEqual({ a: '¥1' });
  });
});

describe('citedIds', () => {
  it('extracts ids in order, once each, including ids with colons and spaces', () => {
    expect(citedIds('食費は{f:cat-pace:食費}、合計{f:expense-total}。{f:cat-pace:食費}')).toEqual([
      'cat-pace:食費',
      'expense-total',
    ]);
    expect(citedIds('Eating out {f:cat-total:Eating out}')).toEqual(['cat-total:Eating out']);
    expect(citedIds('no tokens')).toEqual([]);
  });
});

describe('renderCited', () => {
  it('replaces tokens with displays', () => {
    expect(renderCited('今月の支出は{f:expense-total}でした。', displays)).toBe('今月の支出は¥12,400でした。');
    expect(renderCited('食費は{f:cat-pace:食費}、使わない日は{f:no-spend-days}。', displays)).toBe(
      '食費は+32%、使わない日は5日。',
    );
  });

  it('null for an unknown fact id', () => {
    expect(renderCited('合計{f:made-up}', displays)).toBeNull();
  });

  it('null for a literal digit outside tokens (ASCII or full-width)', () => {
    expect(renderCited('合計{f:expense-total}、3日間', displays)).toBeNull();
    expect(renderCited('合計は１２０００円', displays)).toBeNull();
    expect(renderCited('Spent 12 dollars', displays)).toBeNull();
  });

  it.each([
    '今月は使いすぎです{f:expense-total}',
    '無駄遣いが多い',
    '浪費しました',
    'それはダメ',
    '反省しましょう',
    '我慢が大切',
    'You overspent this month',
    'That was wasteful',
    'Do not waste money',
    'A bad month',
    'You should have saved',
    'You failed your budget',
    'You OVERSPENT',
  ])('null for scolding text: %s', (text) => {
    expect(renderCited(text, displays)).toBeNull();
  });

  it('does not flag words that merely contain a blocklisted English word', () => {
    expect(renderCited('Badminton and wastewater', displays)).toBe('Badminton and wastewater');
  });

  it('kindness and digit checks ignore text inside a fact display', () => {
    expect(renderCited('{f:x}', { x: 'Bad Food 2' })).toBe('Bad Food 2');
  });

  it('turns em dashes into 、 for Japanese and ", " for English', () => {
    expect(renderCited('今月は穏やか—よい調子', displays)).toBe('今月は穏やか、よい調子');
    expect(renderCited('A calm month — nice', displays)).toBe('A calm month, nice');
    expect(renderCited('A calm month―nice', displays, 'en')).toBe('A calm month, nice');
  });
});
