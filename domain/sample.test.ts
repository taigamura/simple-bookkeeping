/**
 * Sample-data seed (slice #8): 15 July-2026 transactions, valid categories,
 * unique stable ids, and a net that stays positive (income-led demo).
 */
import { sampleEntries } from './sample';
import { DEFAULT_EXP_CATS, DEFAULT_INC_CATS } from './defaults';
import { monthEntries, net } from './entries';

describe('sampleEntries', () => {
  it('returns 15 entries, all in July 2026', () => {
    const out = sampleEntries();
    expect(out).toHaveLength(15);
    expect(out.every((e) => e.y === 2026 && e.m === 6)).toBe(true);
  });

  it('gives every entry a unique, stable id', () => {
    const a = sampleEntries();
    const b = sampleEntries();
    expect(new Set(a.map((e) => e.id)).size).toBe(15);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id)); // stable across calls
  });

  it('only uses the default categories', () => {
    const known = new Set([...DEFAULT_EXP_CATS, ...DEFAULT_INC_CATS]);
    expect(sampleEntries().every((e) => known.has(e.category))).toBe(true);
  });

  it('lands entirely in July 2026 (other months empty)', () => {
    const all = sampleEntries();
    expect(monthEntries(all, { y: 2026, m: 6 })).toHaveLength(15);
    expect(monthEntries(all, { y: 2026, m: 5 })).toHaveLength(0);
  });

  it('nets positive (income-led demo)', () => {
    expect(net(sampleEntries())).toBeGreaterThan(0);
  });
});
