/**
 * Deterministic fake `SuitoAi` for web (`?ai=fake`), Playwright and Jest.
 *
 * Not a model: a handful of regexes and canned sentences, so every e2e
 * screenshot is byte-stable and Jest can assert exact fills. It follows the
 * same rules the real module must: categories only from the passed lists, no
 * literal digits in letter/nudge text (numbers only via `{f:<id>}` tokens), no
 * em dashes.
 *
 * One deliberate extra: `pickNudge` with an EMPTY fact sheet returns a
 * token-free line instead of null. While `ai/facts.ts` is still a stub it
 * returns `[]`, and the web build would otherwise never show the nudge row the
 * visual gate has to pin. With real facts the rule is exactly "first watch,
 * else first positive, else null".
 */
import type {
  AskRequest,
  AskResult,
  Availability,
  Fact,
  LetterDraft,
  LetterRequest,
  LineDraft,
  LineRequest,
  ListenEvent,
  Locale,
  NudgeDraft,
  NudgeRequest,
  ParseContext,
  ParsedEntry,
  SuitoAi,
  YMD,
} from './contract';

export interface FakeOptions {
  availability?: Availability;
  /** Delay between streamed Ask chunks (ms). */
  chunkDelayMs?: number;
  /** Simulated model latency for parse/letter/nudge (ms). */
  latencyMs?: number;
  /** What the fake "hears" while listening; defaults per locale (FAKE_TRANSCRIPT). */
  transcript?: string;
  /** Force a listen outcome (permission tests). */
  listenStart?: 'started' | 'denied' | 'unavailable';
  /** Force a receipt outcome; default 'ok' with FAKE_RECEIPT. */
  receiptStatus?: 'ok' | 'cancelled' | 'denied' | 'none';
}

export const FAKE_TRANSCRIPT: Record<Locale, string> = { ja: '昨日ランチ 850円', en: 'lunch 850 yesterday' };
/** Store name + amount the fake receipt scan returns (category resolved from ctx). */
export const FAKE_RECEIPT = { amount: 1280, note: { ja: 'ローソン', en: 'Lawson' } } as const;
/** Level sequence emitted while listening, one step per ~80 ms. */
const LEVELS = [0.2, 0.55, 0.8, 0.45, 0.7, 0.3];

export const FAKE_AVAILABLE: Availability = { onDevice: 'available', system: 'available' };

/** Keyword → candidate category names (first one present in the user's list wins). */
const KEYWORDS: { words: string[]; cats: string[] }[] = [
  {
    words: ['ランチ', 'ごはん', 'ご飯', 'スタバ', 'カフェ', 'コンビニ', 'lunch', 'dinner', 'coffee', 'starbucks', 'cafe'],
    cats: ['食費', 'Food'],
  },
  { words: ['電車', 'バス', 'タクシー', 'train', 'bus', 'taxi'], cats: ['交通費', 'Transport'] },
  { words: ['家賃', 'rent'], cats: ['家賃', 'Rent'] },
  { words: ['給料', '給与', 'salary', 'paycheck'], cats: ['給料', 'Salary'] },
  { words: ['ボーナス', 'bonus'], cats: ['ボーナス', 'Bonus'] },
];

const INCOME_WORDS = ['給料', '給与', 'ボーナス', 'salary', 'paycheck', 'bonus'];
const STRONGER = ['どうすれば', 'アドバイス', 'how can', 'advice'];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function shiftDay(today: YMD, delta: number): YMD {
  const d = new Date(today.y, today.m, today.day + delta);
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
}

function includesWord(text: string, word: string): boolean {
  return text.toLowerCase().includes(word.toLowerCase());
}

/** The regex "model" behind `parseEntry`. Exported for direct unit tests. */
export function fakeParse(text: string, ctx: ParseContext): ParsedEntry | null {
  let rest = ` ${text.trim()} `;
  const out: ParsedEntry = {};

  // Date words first, so "10/3" never reads as an amount.
  const slash = /(\d{1,2})\/(\d{1,2})/.exec(rest);
  if (slash) {
    out.date = { y: ctx.today.y, m: Number(slash[1]) - 1, day: Number(slash[2]) };
    rest = rest.replace(slash[0], ' ');
  }
  for (const [words, delta] of [
    [['おととい', 'day before yesterday'], -2],
    [['昨日', 'きのう', 'yesterday'], -1],
    [['今日', 'today'], 0],
  ] as const) {
    const hit = words.find((w) => includesWord(rest, w));
    if (hit) {
      out.date ??= shiftDay(ctx.today, delta);
      rest = rest.replace(new RegExp(hit, 'i'), ' ');
      break;
    }
  }

  const amount = /[¥$€£]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:円|yen)?/i.exec(rest);
  if (amount) {
    const n = Math.round(Number(amount[1].replace(/,/g, '')));
    if (n > 0) out.amount = n;
    rest = rest.replace(amount[0], ' ');
  }

  if (INCOME_WORDS.some((w) => includesWord(rest, w))) out.type = 'income';
  const cats = out.type === 'income' ? ctx.incCats : ctx.expCats;

  const direct = cats.find((c) => includesWord(rest, c));
  if (direct) {
    out.category = direct;
    rest = rest.replace(new RegExp(direct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  } else {
    for (const k of KEYWORDS) {
      if (!k.words.some((w) => includesWord(rest, w))) continue;
      const cat = k.cats.find((c) => cats.includes(c));
      if (cat) {
        out.category = cat;
        break;
      }
    }
  }

  const note = rest.replace(/\s+/g, ' ').trim();
  if (note && !cats.includes(note)) out.note = note;

  if (out.amount === undefined && out.category === undefined && out.date === undefined) return null;
  return out;
}

function letterFor(req: LetterRequest): LetterDraft {
  const [a, b] = req.facts;
  if (req.locale === 'ja') {
    return {
      paragraphs: [
        `先月もおつかれさまでした。${a ? `ひとつめのポイントは {f:${a.id}} です。` : '記録を続けられたことが何よりです。'}`,
        `${b ? `つぎに {f:${b.id}}。` : ''}今月もこの調子で、気楽にいきましょう。`,
      ],
    };
  }
  return {
    paragraphs: [
      `Nice work keeping track last month.${a ? ` The first thing that stands out is {f:${a.id}}.` : ' Showing up for it is the hard part.'}`,
      `${b ? `Next, {f:${b.id}}. ` : ''}Keep the same easy pace this month.`,
    ],
  };
}

function nudgeFor(req: NudgeRequest): NudgeDraft {
  const pick: Fact | undefined =
    req.facts.find((f) => f.tone === 'watch') ?? req.facts.find((f) => f.tone === 'positive');
  if (pick) {
    const ja = req.locale === 'ja';
    return pick.tone === 'watch'
      ? { text: ja ? `ちょっと気にしておきたいのは {f:${pick.id}} です。` : `Worth a look: {f:${pick.id}}.` }
      : { text: ja ? `いい流れです: {f:${pick.id}}。` : `Nice: {f:${pick.id}}.` };
  }
  if (req.facts.length === 0) {
    // See the file header: stub-era fallback only.
    return {
      text:
        req.locale === 'ja'
          ? '今月の数字は「聞く」からたずねられます。'
          : 'You can ask about this month from the Ask button.',
    };
  }
  return null;
}

function lineFor(req: LineRequest): LineDraft {
  const f = req.facts[0];
  if (!f) return null;
  const ja = req.locale === 'ja';
  switch (req.kind) {
    case 'forecast':
      return { text: ja ? `このペースだと月末は {f:${f.id}} になりそう。` : `At this pace the month ends near {f:${f.id}}.` };
    case 'day':
      return { text: ja ? `この日は {f:${f.id}}。` : `This day: {f:${f.id}}.` };
    case 'repeat':
      return { text: ja ? `{f:${f.id}} は毎月の支払いにしますか？` : `Make {f:${f.id}} a monthly payment?` };
  }
}

const ANSWER: Record<'ja' | 'en', { plain: string[]; stronger: string[] }> = {
  ja: {
    plain: ['今月の記録を見ると、', '支出はいつものペースで', '落ち着いています。'],
    stronger: [
      'これは計画の相談なので、',
      'もっと大きなAIのほうが上手に答えられます。',
      '下のボタンからほかのAIに聞けます。',
    ],
  },
  en: {
    plain: ['Looking at this month, ', 'your spending is moving at ', 'its usual, steady pace.'],
    stronger: [
      'That is a planning question, ',
      'and a bigger model will answer it better. ',
      'You can hand it to another AI below.',
    ],
  },
};

export function createFakeSuitoAi(options: FakeOptions = {}): SuitoAi {
  const availability = options.availability ?? FAKE_AVAILABLE;
  const chunkDelay = options.chunkDelayMs ?? 120;
  const latency = options.latencyMs ?? 0;
  const cancelled = new Set<string>();
  let listening: { locale: Locale; timer: ReturnType<typeof setInterval> } | null = null;
  const stopTimer = () => {
    if (listening) clearInterval(listening.timer);
  };

  return {
    availability: async () => availability,
    parseEntry: async (text, ctx) => {
      if (latency) await wait(latency);
      return fakeParse(text, ctx);
    },
    writeLetter: async (req) => {
      if (latency) await wait(latency);
      return letterFor(req);
    },
    pickNudge: async (req) => {
      if (latency) await wait(latency);
      return nudgeFor(req);
    },
    ask: async (req: AskRequest, onText): Promise<AskResult> => {
      const q = req.question.toLowerCase();
      const needsStrongerModel = STRONGER.some((w) => q.includes(w));
      const chunks = ANSWER[req.locale][needsStrongerModel ? 'stronger' : 'plain'];
      let text = '';
      for (const chunk of chunks) {
        await wait(chunkDelay);
        if (cancelled.has(req.requestId)) break;
        text += chunk;
        onText(text);
      }
      cancelled.delete(req.requestId);
      return { text, needsStrongerModel };
    },
    cancelAsk: (requestId) => {
      cancelled.add(requestId);
    },
    startListening: async (locale, onEvent: (event: ListenEvent) => void) => {
      const start = options.listenStart ?? 'started';
      if (start !== 'started') return start;
      stopTimer();
      const words = (options.transcript ?? FAKE_TRANSCRIPT[locale]).split(' ');
      let i = 0;
      const timer = setInterval(() => {
        i += 1;
        onEvent({ level: LEVELS[i % LEVELS.length], text: words.slice(0, Math.min(i, words.length)).join(' ') });
      }, 80);
      listening = { locale, timer };
      return 'started';
    },
    stopListening: async () => {
      if (!listening) return null;
      stopTimer();
      const { locale } = listening;
      listening = null;
      if (latency) await wait(latency);
      return options.transcript ?? FAKE_TRANSCRIPT[locale];
    },
    cancelListening: () => {
      stopTimer();
      listening = null;
    },
    scanReceipt: async (ctx) => {
      const status = options.receiptStatus ?? 'ok';
      if (latency) await wait(latency);
      if (status !== 'ok') return { status };
      const category = ['食費', 'Food'].find((c) => ctx.expCats.includes(c)) ?? ctx.expCats[0];
      return {
        status: 'ok',
        entry: { type: 'expense', amount: FAKE_RECEIPT.amount, category, date: ctx.today, note: FAKE_RECEIPT.note[ctx.locale] },
      };
    },
    wordLine: async (req) => {
      if (latency) await wait(latency);
      return lineFor(req);
    },
    writeSiriSnapshot: async () => {},
    readSiriInbox: async () => [],
    clearSiriInbox: async () => {},
    setSpotlight: async () => {},
  };
}

/** The shared instance `App.tsx` injects on web with `?ai=fake`. */
export const fakeSuitoAi: SuitoAi = createFakeSuitoAi();
