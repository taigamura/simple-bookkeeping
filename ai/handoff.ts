/**
 * 「ChatGPTで聞く」: the prompt the user previews, then sends via the share
 * sheet. STUB — the domain slice implements it.
 */
import type { Fact, Locale, SnapshotEntry } from './contract';

export interface HandoffInput {
  question: string;
  facts: Fact[];
  entries: SnapshotEntry[];
  locale: Locale;
}

export function buildHandoffPrompt(input: HandoffInput): string {
  return input.question;
}
