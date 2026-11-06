import type { ListenEvent } from '../../ai/contract';
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
  const listeners: { event: string; cb: (e: never) => void }[] = [];
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
    startListening: jest.fn(async () => 'started' as const),
    stopListening: jest.fn(async () => ' 昨日ランチ 850円 '),
    cancelListening: jest.fn(),
    scanReceipt: jest.fn(async () => ({ status: 'ok' as const, entry: { amount: 1280, note: 'ローソン' } })),
    wordLine: jest.fn(async () => ({ text: 'w {f:x}' })),
    addListener: jest.fn((event: string, cb: (e: never) => void) => {
      const entry = { event, cb };
      listeners.push(entry);
      return { remove: () => listeners.splice(listeners.indexOf(entry), 1) };
    }) as SuitoAiNative['addListener'],
    ...overrides,
  };
  const emitTo = (event: string, e: unknown) =>
    [...listeners].filter((l) => l.event === event).forEach((l) => (l.cb as (x: unknown) => void)(e));
  const emit = (e: AskTextEvent) => emitTo('onAskText', e);
  const emitListen = (e: ListenEvent) => emitTo('onListen', e);
  return { native, emit, emitListen, listeners };
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

describe('voice, receipt and one-liners', () => {
  beforeAll(() => mockRequire.mockReturnValue(null));

  it('streams listen events while started, trims the final transcript, then unsubscribes', async () => {
    const { native, emitListen, listeners } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    const events: ListenEvent[] = [];
    await expect(ai.startListening('ja', (e) => events.push(e))).resolves.toBe('started');
    expect(native.startListening).toHaveBeenCalledWith('ja');
    emitListen({ level: 0.5, text: '昨日' });
    expect(events).toEqual([{ level: 0.5, text: '昨日' }]);
    await expect(ai.stopListening()).resolves.toBe('昨日ランチ 850円');
    expect(listeners).toHaveLength(0);
  });

  it('drops the listener when listening could not start, and maps a throw to unavailable', async () => {
    const denied = fakeNative({ startListening: jest.fn(async () => 'denied' as const) });
    const a = load().createNativeSuitoAi(denied.native);
    await expect(a.startListening('en', () => {})).resolves.toBe('denied');
    expect(denied.listeners).toHaveLength(0);

    const broken = fakeNative({ startListening: jest.fn(async () => Promise.reject(new Error('x'))) });
    const b = load().createNativeSuitoAi(broken.native);
    await expect(b.startListening('en', () => {})).resolves.toBe('unavailable');
  });

  it('resolves null for a blank or failed transcript', async () => {
    const blank = fakeNative({ stopListening: jest.fn(async () => '  ') });
    await expect(load().createNativeSuitoAi(blank.native).stopListening()).resolves.toBeNull();
    const failed = fakeNative({ stopListening: jest.fn(async () => Promise.reject(new Error('x'))) });
    await expect(load().createNativeSuitoAi(failed.native).stopListening()).resolves.toBeNull();
  });

  it('cancelListening unsubscribes and tells native', async () => {
    const { native, listeners } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    await ai.startListening('ja', () => {});
    ai.cancelListening();
    expect(native.cancelListening).toHaveBeenCalled();
    expect(listeners).toHaveLength(0);
  });

  it('passes receipt context as JSON; a throw becomes status none', async () => {
    const { native } = fakeNative();
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.scanReceipt(ctx)).resolves.toEqual({ status: 'ok', entry: { amount: 1280, note: 'ローソン' } });
    expect(native.scanReceipt).toHaveBeenCalledWith(JSON.stringify(ctx));
    const broken = fakeNative({ scanReceipt: jest.fn(async () => Promise.reject(new Error('x'))) });
    await expect(load().createNativeSuitoAi(broken.native).scanReceipt(ctx)).resolves.toEqual({ status: 'none' });
  });

  it('wordLine skips native with no facts and never rejects', async () => {
    const { native } = fakeNative({ wordLine: jest.fn(async () => Promise.reject(new Error('x'))) });
    const ai = load().createNativeSuitoAi(native);
    await expect(ai.wordLine({ kind: 'day', facts: [], locale: 'ja' })).resolves.toBeNull();
    expect(native.wordLine).not.toHaveBeenCalled();
    const fact = { id: 'x', label: 'l', display: '¥1', value: 1, tone: 'neutral' as const };
    await expect(ai.wordLine({ kind: 'day', facts: [fact], locale: 'ja' })).resolves.toBeNull();
  });
});
