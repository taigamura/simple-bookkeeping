/**
 * JP + EN string dictionaries (#29) — no i18n framework, just a plain object
 * per language sharing this shape. Every screen/component reads its copy from
 * here instead of a literal. `domain/calendar.ts`'s month names/weekday
 * abbreviations/`dayLabel` stay English-only in this slice — they're pure
 * domain formatting exercised by their own English-asserting tests, and
 * proper JP date formatting (e.g. "7月2日(水)") is a different shape of work
 * than swapping labels; out of scope here.
 */

export interface ZaimSkipStrings {
  transfer: (n: number) => string;
  balanceAdjustment: (n: number) => string;
  malformedRow: (n: number) => string;
  duplicate: (n: number) => string;
}

export interface Strings {
  common: {
    expense: string;
    income: string;
    add: string;
    cancel: string;
    import: string;
    delete: string;
    on: string;
    off: string;
  };
  nav: {
    calendar: string;
    summary: string;
    settings: string;
    addEntry: string;
    done: string;
    close: string;
    back: string;
  };
  calendar: {
    previousMonth: string;
    nextMonth: string;
    in: string;
    out: string;
    net: string;
    /** Strip label for the month's remaining budget (#50). */
    budget: string;
    emptyDay: string;
  };
  summary: {
    netThisMonth: string;
    spendingByCategory: string;
    noSpending: string;
    /** Net-card label for the month's remaining budget (#51). */
    budgetLeft: string;
  };
  entry: {
    noteRowLabel: string;
    repeatRowLabel: string;
    weekendRowLabel: string;
    notePresets: Record<'expense' | 'income', string[]>;
    repeatLabels: { never: string; daily: string; monthly: string; yearly: string };
    weekendLabels: { after: string; before: string; off: string };
    addExpense: string;
    addIncome: string;
    save: string;
    editEntry: (name: string) => string;
    deleteEntry: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
  };
  settings: {
    appearance: string;
    dark: string;
    light: string;
    /** Launch mode setting (#68). */
    openTo: string;
    /** Option to open to Calendar on launch (#68). */
    openToCalendar: string;
    /** Option to open to Entry sheet on launch (#68). */
    openToEntry: string;
    currency: string;
    categories: string;
    addCategory: string;
    moveCategoryUp: (name: string) => string;
    moveCategoryDown: (name: string) => string;
    removeCategory: (name: string) => string;
    data: string;
    loadSampleData: string;
    exportData: string;
    importFromZaim: string;
    exportUnreadableBackup: string;
    deleteAllData: string;
    deleteAllDataConfirmMessage: string;
  };
  budgets: {
    title: string;
    /** Toggle option for per-category budget mode (#66). */
    perCategory: string;
    /** Toggle option for total budget mode (#66). */
    total: string;
    /** Label for the total budget amount field in total mode (#66). */
    totalAmount: string;
    /** Accessibility label for the total budget field (#66). */
    totalBudgetLabel: string;
    /** Accessibility label for a category's amount field. */
    budgetFor: (name: string) => string;
    /** Placeholder shown in an amount field with no budget set. */
    none: string;
  };
  keypad: {
    delete: string;
  };
  corruptNotice: {
    title: string;
    message: string;
  };
  lock: {
    label: string;
    unavailableExplanation: string;
    prompt: string;
    lockedTitle: string;
    unlockButton: string;
  };
  zaim: {
    notZaimTitle: string;
    notZaimMessage: string;
    noEntriesTitle: string;
    noEntriesMessage: string;
    entriesReady: (n: number) => string;
    skip: ZaimSkipStrings;
  };
}

export const en: Strings = {
  common: {
    expense: 'Expense',
    income: 'Income',
    add: 'Add',
    cancel: 'Cancel',
    import: 'Import',
    delete: 'Delete',
    on: 'On',
    off: 'Off',
  },
  nav: {
    calendar: 'Calendar',
    summary: 'Summary',
    settings: 'Settings',
    addEntry: 'Add entry',
    done: 'Done',
    close: 'Close',
    back: 'Back',
  },
  calendar: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    in: 'In',
    out: 'Out',
    net: 'Net',
    budget: 'Budget',
    emptyDay: 'No entries this day. Tap ＋ to add one.',
  },
  summary: {
    netThisMonth: 'Net this month',
    spendingByCategory: 'Spending by category',
    noSpending: 'No spending this month.',
    budgetLeft: 'Budget left',
  },
  entry: {
    noteRowLabel: 'Note',
    repeatRowLabel: '↻ Repeat',
    weekendRowLabel: 'If on weekend',
    notePresets: {
      expense: ['—', 'Cash', 'Card', 'Konbini', 'Online'],
      income: ['—', 'Bank transfer', 'Cash', 'Bonus'],
    },
    repeatLabels: { never: 'Never', daily: 'Every day', monthly: 'Every month', yearly: 'Every year' },
    weekendLabels: {
      after: 'Move to Monday',
      before: 'Move to Friday',
      off: 'Keep on weekend',
    },
    addExpense: 'Add expense',
    addIncome: 'Add income',
    save: 'Save',
    editEntry: (name) => `Edit ${name}`,
    deleteEntry: 'Delete entry',
    deleteConfirmTitle: 'Delete this entry?',
    deleteConfirmMessage: 'This cannot be undone.',
  },
  settings: {
    appearance: 'Appearance',
    dark: 'Dark',
    light: 'Light',
    openTo: 'Open to',
    openToCalendar: 'Calendar',
    openToEntry: 'Entry',
    currency: 'Currency',
    categories: 'Categories',
    addCategory: 'Add category',
    moveCategoryUp: (name) => `Move ${name} up`,
    moveCategoryDown: (name) => `Move ${name} down`,
    removeCategory: (name) => `Remove ${name}`,
    data: 'Data',
    loadSampleData: 'Load sample data',
    exportData: 'Export data',
    importFromZaim: 'Import from Zaim',
    exportUnreadableBackup: 'Export unreadable backup',
    deleteAllData: 'Delete all data',
    deleteAllDataConfirmMessage: 'This will permanently delete all entries and budgets. Categories, currency, and settings will be preserved.',
  },
  budgets: {
    title: 'Budgets',
    perCategory: 'Per category',
    total: 'Total',
    totalAmount: 'Monthly budget',
    totalBudgetLabel: 'Total budget',
    budgetFor: (name) => `Budget for ${name}`,
    none: 'None',
  },
  keypad: {
    delete: 'Delete',
  },
  corruptNotice: {
    title: 'Backup kept',
    message:
      "Your previous data couldn't be read; a backup copy was kept. You can export it from Settings.",
  },
  lock: {
    label: 'Lock',
    unavailableExplanation: 'Set up Face ID, Touch ID, or a passcode on this device to use this.',
    prompt: 'Unlock Kaji',
    lockedTitle: 'Kaji is locked',
    unlockButton: 'Unlock',
  },
  zaim: {
    notZaimTitle: "Doesn't look like a Zaim export",
    notZaimMessage: 'No entries were imported.',
    noEntriesTitle: 'No entries found',
    noEntriesMessage: 'No importable rows were found in that file.',
    entriesReady: (n) => `${n} entries ready to import`,
    skip: {
      transfer: (n) => `${n} transfer${n === 1 ? '' : 's'} skipped`,
      balanceAdjustment: (n) => `${n} balance adjustment${n === 1 ? '' : 's'} skipped`,
      malformedRow: (n) => `${n} malformed row${n === 1 ? '' : 's'} skipped`,
      duplicate: (n) => `${n} duplicate${n === 1 ? '' : 's'} skipped`,
    },
  },
};

export const ja: Strings = {
  common: {
    expense: '支出',
    income: '収入',
    add: '追加',
    cancel: 'キャンセル',
    import: '読み込む',
    delete: '削除',
    on: 'オン',
    off: 'オフ',
  },
  nav: {
    calendar: 'カレンダー',
    summary: 'サマリー',
    settings: '設定',
    addEntry: '入力を追加',
    done: '完了',
    close: '閉じる',
    back: '戻る',
  },
  calendar: {
    previousMonth: '前の月',
    nextMonth: '次の月',
    in: '収入',
    out: '支出',
    net: '収支',
    budget: '予算',
    emptyDay: 'この日の記録はありません。＋をタップして追加しましょう。',
  },
  summary: {
    netThisMonth: '今月の収支',
    spendingByCategory: 'カテゴリ別の支出',
    noSpending: '今月の支出はありません。',
    budgetLeft: '予算の残り',
  },
  entry: {
    noteRowLabel: 'メモ',
    repeatRowLabel: '↻ 繰り返し',
    weekendRowLabel: '週末の場合',
    notePresets: {
      expense: ['—', '現金', 'カード', 'コンビニ', 'オンライン'],
      income: ['—', '振込', '現金', 'ボーナス'],
    },
    repeatLabels: { never: 'なし', daily: '毎日', monthly: '毎月', yearly: '毎年' },
    weekendLabels: {
      after: '月曜に移動',
      before: '金曜に移動',
      off: '週末のまま',
    },
    addExpense: '支出を追加',
    addIncome: '収入を追加',
    save: '保存',
    editEntry: (name) => `${name}を編集`,
    deleteEntry: '記録を削除',
    deleteConfirmTitle: 'この記録を削除しますか？',
    deleteConfirmMessage: 'この操作は取り消せません。',
  },
  settings: {
    appearance: '外観',
    dark: 'ダーク',
    light: 'ライト',
    openTo: '起動時に開く',
    openToCalendar: 'カレンダー',
    openToEntry: '入力',
    currency: '通貨',
    categories: 'カテゴリ',
    addCategory: 'カテゴリを追加',
    moveCategoryUp: (name) => `${name}を上に移動`,
    moveCategoryDown: (name) => `${name}を下に移動`,
    removeCategory: (name) => `${name}を削除`,
    data: 'データ',
    loadSampleData: 'サンプルデータを読み込む',
    exportData: 'データを書き出す',
    importFromZaim: 'Zaimから読み込む',
    exportUnreadableBackup: '読み取れないバックアップを書き出す',
    deleteAllData: 'すべてのデータを削除',
    deleteAllDataConfirmMessage: 'すべての支出と予算が永遠に削除されます。カテゴリ、通貨、および設定は保持されます。',
  },
  budgets: {
    title: '予算',
    perCategory: 'カテゴリ別',
    total: '合計',
    totalAmount: '月間予算',
    totalBudgetLabel: '合計予算',
    budgetFor: (name) => `${name}の予算`,
    none: 'なし',
  },
  keypad: {
    delete: '削除',
  },
  corruptNotice: {
    title: 'バックアップを保持しました',
    message: '以前のデータを読み込めませんでした。バックアップは保持されています。設定から書き出せます。',
  },
  lock: {
    label: 'ロック',
    unavailableExplanation: 'この端末でFace ID・Touch ID・パスコードを設定すると使えます。',
    prompt: 'Kajiのロックを解除',
    lockedTitle: 'Kajiはロックされています',
    unlockButton: '解除する',
  },
  zaim: {
    notZaimTitle: 'Zaimのエクスポートではないようです',
    notZaimMessage: '記録は読み込まれませんでした。',
    noEntriesTitle: '記録が見つかりません',
    noEntriesMessage: 'このファイルに読み込み可能な行が見つかりませんでした。',
    entriesReady: (n) => `${n}件の記録を読み込めます`,
    skip: {
      transfer: (n) => `振替${n}件をスキップしました`,
      balanceAdjustment: (n) => `残高調整${n}件をスキップしました`,
      malformedRow: (n) => `不正な行${n}件をスキップしました`,
      duplicate: (n) => `重複${n}件をスキップしました`,
    },
  },
};
