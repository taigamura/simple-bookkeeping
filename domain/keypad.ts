/**
 * Calculator input rules for the entry amount. Expressions use visible
 * calculator glyphs (`+ − × ÷`), operands stay integer-only with leading zeros
 * stripped, results are rounded to the app's minor-unit-less money model, and
 * ⌫ deletes one character.
 */
export const AMOUNT_MAX_DIGITS = 9;

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'equals'
  | 'clear'
  | 'del';

const OPERATOR_FOR: Partial<Record<KeypadKey, string>> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};
const OPERATOR_PATTERN = /[+−×÷]/;
const TRAILING_OPERATOR_PATTERN = /[+−×÷]$/;

/**
 * Apply one keypad press to the current amount string. `'del'` backspaces;
 * anything else is appended as digits, then leading zeros are collapsed and the
 * 9-digit cap is enforced (over-cap presses are ignored, returning the input).
 */
export function pressKey(current: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'del') return current.slice(0, -1);
  if (key === 'equals') {
    const result = amountValue(current);
    return result > 0 ? String(result) : current;
  }

  const operator = OPERATOR_FOR[key];
  if (operator) {
    if (current === '') return current;
    return TRAILING_OPERATOR_PATTERN.test(current)
      ? `${current.slice(0, -1)}${operator}`
      : `${current}${operator}`;
  }

  const operatorIndex = Math.max(
    current.lastIndexOf('+'),
    current.lastIndexOf('−'),
    current.lastIndexOf('×'),
    current.lastIndexOf('÷'),
  );
  const prefix = current.slice(0, operatorIndex + 1);
  const operand = current.slice(operatorIndex + 1);
  const nextOperand = `${operand}${key}`.replace(/^0+(?=\d)/, '');
  if (nextOperand.length > AMOUNT_MAX_DIGITS) return current;
  return `${prefix}${nextOperand}`;
}

/** Evaluate a complete expression, returning a positive integer amount or 0. */
export function amountValue(amountStr: string): number {
  if (!/^\d+(?:[+−×÷]\d+)*$/.test(amountStr)) return 0;

  const parts = amountStr.split(OPERATOR_PATTERN);
  const operators = amountStr.match(/[+−×÷]/g) ?? [];
  let term = Number(parts[0]);
  const terms: number[] = [];
  const signs: string[] = [];

  for (let i = 0; i < operators.length; i += 1) {
    const next = Number(parts[i + 1]);
    const operator = operators[i];
    if (operator === '×') term *= next;
    else if (operator === '÷') {
      if (next === 0) return 0;
      term /= next;
    } else {
      terms.push(term);
      signs.push(operator);
      term = next;
    }
  }

  let result = terms[0] ?? term;
  for (let i = 0; i < signs.length; i += 1) {
    const next = i === signs.length - 1 ? term : terms[i + 1];
    result = signs[i] === '+' ? result + next : result - next;
  }
  const rounded = Math.round(result);
  return Number.isFinite(rounded) && rounded > 0 && rounded <= 999_999_999 ? rounded : 0;
}
