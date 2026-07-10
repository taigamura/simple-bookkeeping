/**
 * Monthly budgets (#49). One recurring amount per *expense* category — it
 * applies to every month until changed (no per-specific-month values). The
 * model is a plain map from category name to positive integer amount; a
 * category absent from the map simply has no budget. Income categories never
 * appear here.
 *
 * All operations return a new map (never mutate) and return the input map
 * unchanged when there is nothing to do, matching `categories.ts`.
 */

/** Category name → recurring monthly budget (positive integer, no minor units). */
export type Budgets = Record<string, number>;

/**
 * `setBudget(budgets, category, amount)` — store a positive integer budget for
 * the category (rounding fractions). A zero, negative, or non-finite amount
 * clears instead: "no budget" is the absence of an entry, never a 0 value.
 */
export function setBudget(budgets: Budgets, category: string, amount: number): Budgets {
  const rounded = Math.round(amount);
  if (!Number.isFinite(amount) || rounded <= 0) return clearBudget(budgets, category);
  return { ...budgets, [category]: rounded };
}

/** `clearBudget(budgets, category)` — drop the entry; no-op when absent. */
export function clearBudget(budgets: Budgets, category: string): Budgets {
  if (!(category in budgets)) return budgets;
  const next = { ...budgets };
  delete next[category];
  return next;
}

/** Whether any category has a budget set — gates budget display downstream (#50/#51). */
export function hasAnyBudget(budgets: Budgets): boolean {
  return Object.keys(budgets).length > 0;
}

/**
 * `pruneBudgets(budgets, categories)` — drop entries whose category is no
 * longer in the list, so deleting an expense category silently drops its
 * budget. Returns the input map unchanged when nothing is orphaned.
 */
export function pruneBudgets(budgets: Budgets, categories: string[]): Budgets {
  const keep = new Set(categories);
  const orphaned = Object.keys(budgets).filter((c) => !keep.has(c));
  if (orphaned.length === 0) return budgets;
  const next = { ...budgets };
  for (const c of orphaned) delete next[c];
  return next;
}
