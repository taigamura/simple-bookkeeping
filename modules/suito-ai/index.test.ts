import type { SuitoAiNative, AskTextEvent } from './index';

const mockRequire = jest.fn();
jest.mock('expo', () => ({ requireOptionalNativeModule: (name: string) => mockRequire(name) }));

function load() {
  let mod!: typeof import('./index');
  jest.isolateModules(() => {
    mod = require('./index');
  });
  return mod;
}

function fakeNative(overrides: Partial<SuitoAiNative> = {}) {
  const listeners: ((e: AskTextEvent) => void)[] = [];
  const native: SuitoAiNative = {
    availability: jest.fn(async () => ({ onDevice: 'available' as const, system: 'available' as const })),
    parseEntry: jest.fn(async () => ({ amount: 850, category: '食費', type: 'expense' as const })),
    writeLetter: jest.fn(async () => ({ paragraphs: ['a {f:x}'] })),
    pickNudge: jest.fn(async () => ({ text: 'n {f:x}' })),
    ask: jest.fn(async () => ({ text: 'done', needsStrongerModel: false })),
    cancelAsk: jest.fn(),
    writeSiriSnapshot: jest.fn(async () => {}),
    readSiriInbox: jest.fn(async () => '[{"id":"u1","createdAt":"","date":"2026-10-23","type":"expense","amount":850,"category":"食費","note":""}]'),
    clearSiriInbox: jest.fn(async () => {}),
    setSpotlight: jest.fn(async () => {}),
    addListener: jest.fn((_event, cb) => {
      listeners.push(cb);
      return { remove: () => listeners.splice(listeners.indexOf(cb), 1) };
    }),
    ...overrides,
  };
  const emit = (e: AskTextEvent) => [...listeners].forEach((l) => l(e));
  return { native, emit, listeners };
}

const ctx = { expCats: ['食費'], incCats: ['給料'], today: { y: 2026, m: 9, day: 23 }, locale: 'ja' as const };

describe('nativeSuitoAi', () => {
  beforeEach(() => mockRequire.mockReset());

  it('is null when the native module is missing (web, Jest, Android)', () => {
    mockRequire.mockReturnValue(null);
    expect(load().nativeSuitoAi).toBeNull();
    expect(mockRequire).toHaveBeenCalledWith('SuitoAi');
  });

  it('wraps the native module when present', async () => {
    const { native } = fakeNative();
    mockRequire.mockReturnValue(native);
    const ai = load().nativeSuitoAi!;
    expect(ai).not.toBeNull();
    await expect(ai.availability()).resolves.toEqual({ onDevice: 'available', system: 'available' });
  });
});

describe('createNativeSuitoAi', () => {
  beforeAll(() => mockRequire.mockReturnValue(null));

  it('passes parse context as JSON and returns the parsed entry', async () => {
    const { native } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.parseEntry('ランチ 850', ctx)).resolves.toEqual({ amount: 850, category: '食費', type: 'expense' });
    expect(native.parseEntry).toHaveBeenCalledWith('ランチ 850', JSON.stringify(ctx));
  });

  it('resolves null instead of throwing for parse / letter / nudge failures', async () => {
    const fail = jest.fn(async () => {
      throw Object.assign(new Error('nope'), { code: 'ERR_UNAVAILABLE' });
    });
    const { native } = fakeNative({ parseEntry: fail, writeLetter: fail, pickNudge: fail });
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.parseEntry('x', ctx)).resolves.toBeNull();
    const fact = { id: 'x', label: 'x', display: '1', value: 1, tone: 'neutral' as const };
    await expect(ai.writeLetter({ y: 2026, m: 8, facts: [fact], locale: 'ja' })).resolves.toBeNull();
    await expect(ai.pickNudge({ facts: [fact], locale: 'ja' })).resolves.toBeNull();
  });

  it('skips the model for empty input', async () => {
    const { native } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.parseEntry('  ', ctx)).resolves.toBeNull();
    await expect(ai.pickNudge({ facts: [], locale: 'en' })).resolves.toBeNull();
    expect(native.parseEntry).not.toHaveBeenCalled();
    expect(native.pickNudge).not.toHaveBeenCalled();
  });

  it('streams only this request’s cumulative text and unsubscribes after', async () => {
    let finish!: () => void;
    const { native, emit, listeners } = fakeNative({
      ask: jest.fn(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ text: 'ab', needsStrongerModel: true });
          })
      ),
    });
    const ai = load().createNativeSuitoAi(native);
    const seen: string[] = [];
    const pending = ai.ask({ requestId: 'r1', question: 'q', history: [], locale: 'ja' }, (t) => seen.push(t));
    emit({ requestId: 'r1', text: 'a' });
    emit({ requestId: 'other', text: 'zzz' });
    emit({ requestId: 'r1', text: 'ab' });
    finish();
    await expect(pending).resolves.toEqual({ text: 'ab', needsStrongerModel: true });
    expect(seen).toEqual(['a', 'ab']);
    expect(listeners).toHaveLength(0);
  });

  it('rejects ask with the native error code', async () => {
    const { native, listeners } = fakeNative({
      ask: jest.fn(async () => {
        throw Object.assign(new Error('cancelled'), { code: 'ERR_CANCELLED' });
      }),
    });
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.ask({ requestId: 'r', question: 'q', history: [], locale: 'en' }, () => {})).rejects.toMatchObject({
      code: 'ERR_CANCELLED',
    });
    expect(listeners).toHaveLength(0);
  });

  it('serialises Siri/Spotlight calls and parses the inbox', async () => {
    const { native } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    const inbox = await ai.readSiriInbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0].id).toBe('u1');
    await ai.clearSiriInbox([]);
    expect(native.clearSiriInbox).not.toHaveBeenCalled();
    await ai.clearSiriInbox(['u1']);
    expect(native.clearSiriInbox).toHaveBeenCalledWith(['u1']);
    await ai.setSpotlight({ enabled: false, entries: [] });
    expect(native.setSpotlight).toHaveBeenCalledWith(false, '[]');
  });

  it('returns an empty inbox for malformed native JSON', async () => {
    const { native } = fakeNative({ readSiriInbox: jest.fn(async () => 'not json') });
    await expect(load().createNativeSuitoAi(native).readSiriInbox()).resolves.toEqual([]);
  });
});
