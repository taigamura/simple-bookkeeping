import {
  QUICK_ENTRY_COMMAND_VERSION,
  reconcileQuickEntryCommands,
  transactionFromQuickEntryCommand,
  validateQuickEntryCommand,
} from './quickEntry';

const command = (over: Record<string, unknown> = {}) => ({
  version: QUICK_ENTRY_COMMAND_VERSION,
  source: 'widget',
  id: 'breakfast-1',
  timestamp: '2026-08-10T00:00:00.000Z',
  amount: 850,
  category: ' Food ',
  note: ' Morning ',
  date: { y: 2026, m: 7, day: 10 },
  ...over,
});

describe('quick entry commands', () => {
  it('validates every persisted contract field', () => {
    expect(validateQuickEntryCommand(command())).toBeNull();
    expect(validateQuickEntryCommand(command({ version: 2 }))).toBe('unsupported-version');
    expect(validateQuickEntryCommand(command({ source: '' }))).toBe('invalid-source');
    expect(validateQuickEntryCommand(command({ id: '' }))).toBe('invalid-id');
    expect(validateQuickEntryCommand(command({ timestamp: 'tomorrow' }))).toBe('invalid-timestamp');
    expect(validateQuickEntryCommand(command({ amount: 1.5 }))).toBe('invalid-amount');
    expect(validateQuickEntryCommand(command({ category: ' ' }))).toBe('invalid-category');
    expect(validateQuickEntryCommand(command({ note: null }))).toBe('invalid-note');
    expect(validateQuickEntryCommand(command({ date: { y: 2026, m: 1, day: 31 } }))).toBe('invalid-date');
  });

  it('turns a command into a stable expense transaction', () => {
    expect(transactionFromQuickEntryCommand(command() as any)).toEqual(expect.objectContaining({
      id: 'quick:widget:breakfast-1', type: 'expense', amount: 850,
      category: 'Food', note: 'Morning', y: 2026, m: 7, day: 10,
    }));
  });

  it('quarantines malformed payloads and deduplicates retries by command identity', () => {
    const result = reconcileQuickEntryCommands([], [command(), command(), { ...command(), amount: 0 }]);
    expect(result.entries).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect(result.quarantined).toHaveLength(1);
  });
});
