# Accessibility Core Journey Checklist

Issue #76 certifies the bilingual core ledger path. Automated tests cover observable roles, labels, selected/disabled states, hints, and input values; this checklist records the remaining native checks.

## Device Matrix

- iOS VoiceOver, English locale
- iOS VoiceOver, Japanese locale
- Larger Text at least two steps above default
- Light and dark appearance

## Journey

- Unlock gate: locked title and Unlock button are announced; canceling authentication leaves the retry button reachable.
- Calendar: month controls, Settings, day cells, selected day, daily net, empty-day copy, and entry rows are announced in logical order.
- Entry: Expense/Income, category chips, Note, Repeat, weekend handling, keypad, disabled/enabled save, and Delete entry are reachable without clipped text. Confirm Repeat announces that occurrences are created on save.
- Summary: net, income, expense, budget-left, spending category rows, and empty spending copy are readable without relying on bar color alone.
- Settings: appearance, open-to, lock, currency, category editor, budgets, import/export, unreadable backup, and Delete all data announce role, state, and scope. Confirm currency only changes the symbol and does not convert amounts.
- Budgets: per-category/total mode, amount fields, blank-clears budget value, Done, and Back are reachable with larger text.
- Destructive actions: Delete entry and Delete all data dialogs accurately announce scope; Delete all data says entries and budgets are deleted while categories, currency, and settings remain.

## Pass Criteria

- No unintended English fallback in Japanese locale or Japanese fallback in English locale.
- No essential control is clipped, hidden, or reachable only by color.
- All tap targets used in the journey remain comfortably touchable at larger text.
