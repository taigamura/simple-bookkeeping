/**
 * Keypad input rules (decision 11): integer-only amount string. Leading zeros
 * are stripped, the value is capped at 9 digits, and ⌫ deletes the last digit.
 * Pure string→string so it's trivially testable and UI-agnostic.
 */
export const AMOUNT_MAX_DIGITS = 9;

export type KeypadKey = string; // '0'–'9' or '000' (multi-zero) or 'del'

/**
 * Apply one keypad press to the current amount string. `'del'` backspaces;
 * anything else is appended as digits, then leading zeros are collapsed and the
 * 9-digit cap is enforced (over-cap presses are ignored, returning the input).
 */
export function pressKey(current: string, key: KeypadKey): string {
  if (key === 'del') return current.slice(0, -1);

  const digits = (current + key).replace(/\D/g, '');
  // Strip leading zeros but keep a single '0' if that's all there is.
  const stripped = digits.replace(/^0+(?=\d)/, '');
  if (stripped.length > AMOUNT_MAX_DIGITS) return current;
  return stripped;
}

/** Parsed integer value of an amount string ('' or '0' → 0). */
export function amountValue(amountStr: string): number {
  const n = parseInt(amountStr, 10);
  return Number.isFinite(n) ? n : 0;
}
