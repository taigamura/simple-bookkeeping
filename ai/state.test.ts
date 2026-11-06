/**
 * `normalizeAiState`: old saves (before the Calendar one-liners) and damaged
 * values load, field by field, without ever rejecting the ledger.
 */
import { DAY_NOTE_LIMIT, DEFAULT_AI_STATE, DEFAULT_CALENDAR_AI, normalizeAiState } from './state';

describe('normalizeAiState — calendar one-liners', () => {
  it('repairs a save written before `calendar` existed', () => {
    const old = { nudgesEnabled: false, spotlightEnabled: true, letters: {}, nudge: null };
    expect(normalizeAiState(old)).toEqual({ ...old, calendar: DEFAULT_CALENDAR_AI });
  });

  it('defaults everything for garbage', () => {
    expect(normalizeAiState('nope')).toEqual(DEFAULT_AI_STATE);
    expect(normalizeAiState({ calendar: 7 }).calendar).toEqual(DEFAULT_CALENDAR_AI);
  });

  it('keeps valid lines and dismissals, drops invalid ones', () => {
    const line = { key: '2026-10-20', text: 'At {f:forecast-month-end}', facts: { 'forecast-month-end': '¥31,000' } };
    const out = normalizeAiState({
      calendar: {
        forecast: line,
        repeat: { key: 'x', text: 3, facts: {} },
        dayNotes: { '2026-10-14': { key: '2026-10-14#abc', text: null, facts: {} }, bad: line, '2026-10-15': { key: 1 } },
        dismissedRepeats: ['netflix|Fun|1490', 4, null],
      },
    }).calendar;
    expect(out.forecast).toEqual(line);
    expect(out.repeat).toBeNull();
    expect(Object.keys(out.dayNotes)).toEqual(['2026-10-14']);
    expect(out.dismissedRepeats).toEqual(['netflix|Fun|1490']);
  });

  it('prunes day notes to the most recent ones', () => {
    const dayNotes: Record<string, unknown> = {};
    for (let i = 0; i < DAY_NOTE_LIMIT + 5; i++) {
      const d = new Date(2026, 0, 1 + i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayNotes[k] = { key: k, text: null, facts: {} };
    }
    const kept = Object.keys(normalizeAiState({ calendar: { dayNotes } }).calendar.dayNotes);
    expect(kept).toHaveLength(DAY_NOTE_LIMIT);
    expect(kept).not.toContain('2026-01-01');
  });
});
