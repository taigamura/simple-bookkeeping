/**
 * Category → emoji for the day-list row tile.
 *
 * Categories are free text (Settings lets you add any name), so this covers the
 * seeded defaults plus the synonyms people reach for first, in both the app's
 * languages. Anything unmatched gets one neutral tag rather than a per-category
 * glyph guess: every row then reads as the same kind of object, and no entry
 * ever carries an emoji that means the wrong thing.
 *
 * Keys are lowercased and trimmed, so "Food", "food" and " food " all match.
 */

/** Shown for any category not in the map. */
export const FALLBACK_EMOJI = '🏷️';

const EMOJI: Record<string, string> = {
  // Seeded expense categories (DEFAULT_EXP_CATS)
  food: '🍜',
  transport: '🚃',
  shopping: '🛍️',
  bills: '🧾',
  health: '💊',
  entertainment: '🎬',

  // Seeded income categories (DEFAULT_INC_CATS); "Other" falls back by design
  salary: '💴',
  bonus: '✨',
  gift: '🎁',

  // Food & drink
  groceries: '🛒',
  lunch: '🍱',
  dinner: '🍽️',
  breakfast: '🥐',
  coffee: '☕',
  cafe: '☕',
  restaurant: '🍽️',
  snacks: '🍫',
  alcohol: '🍺',
  drinks: '🍺',

  // Getting around
  train: '🚃',
  bus: '🚌',
  taxi: '🚕',
  car: '🚗',
  fuel: '⛽',
  gas: '⛽',
  parking: '🅿️',
  flight: '✈️',
  travel: '✈️',
  holiday: '🏖️',

  // Home & bills
  rent: '🏠',
  home: '🏠',
  mortgage: '🏦',
  utilities: '💡',
  electricity: '💡',
  water: '💧',
  phone: '📱',
  internet: '🌐',
  subscriptions: '🔁',
  insurance: '🛡️',
  tax: '🧾',
  taxes: '🧾',

  // Life
  clothes: '👕',
  beauty: '💄',
  haircut: '💇',
  books: '📚',
  education: '🎓',
  school: '🎓',
  gym: '🏋️',
  sport: '⚽',
  sports: '⚽',
  hobby: '🎨',
  games: '🎮',
  music: '🎵',
  medical: '🏥',
  pharmacy: '💊',
  pets: '🐾',
  kids: '🧸',
  baby: '🍼',
  charity: '🤝',

  // Money in
  freelance: '💻',
  investment: '📈',
  investments: '📈',
  interest: '🏦',
  savings: '🏦',
  refund: '↩️',
  sale: '🏷️',

  // Japanese category names
  食費: '🍜',
  交通費: '🚃',
  買い物: '🛍️',
  日用品: '🧴',
  家賃: '🏠',
  光熱費: '💡',
  通信費: '📱',
  医療費: '💊',
  娯楽: '🎬',
  教育: '🎓',
  美容: '💄',
  給料: '💴',
  賞与: '✨',
  副収入: '💻',
};

/**
 * `emojiFor(category)` — the row tile glyph for a category name, or
 * `FALLBACK_EMOJI` when the name is not one this map knows.
 */
export function emojiFor(category: string): string {
  return EMOJI[category.trim().toLowerCase()] ?? FALLBACK_EMOJI;
}
