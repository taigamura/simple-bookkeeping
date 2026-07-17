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
  a11y: {
    selected: string;
    notSelected: string;
    textInput: string;
    categoryName: string;
    symbolOnlyCurrencyHint: string;
    recurrenceHint: string;
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
    dayAccessibilityLabel: (day: number) => string;
    dayNetAccessibilityValue: (value: string) => string;
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
    saveThisAndFuture: string;
    editEntry: (name: string) => string;
    deleteEntry: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    deleteRecurringTitle: string;
    deleteRecurringMessage: string;
    deleteOnlyThis: string;
    deleteThisAndFuture: string;
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
  repeats: {
    title: string;
    activeCount: (count: number) => string;
    emptyTitle: string;
    emptyMessage: string;
    date: (y: number, m: number, day: number) => string;
    next: (date: string) => string;
    editRepeat: (name: string) => string;
    stopRepeat: string;
    chooseCurrentCategory: string;
    stopConfirmTitle: string;
    stopConfirmMessage: string;
    endsBefore: (date: string) => string;
  };
  keypad: {
    delete: string;
  };
  corruptNotice: {
    title: string;
    message: string;
  };
  persistenceNotice: {
    readFailedTitle: string;
    readFailedMessage: string;
    recoveryFailedTitle: string;
    recoveryFailedMessage: string;
    saveFailedTitle: string;
    saveFailedMessage: string;
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
    importFailedTitle: string;
    importFailedMessage: string;
    exportFailedTitle: string;
    exportFailedMessage: string;
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
  a11y: {
    selected: 'Selected',
    notSelected: 'Not selected',
    textInput: 'Text input',
    categoryName: 'Category name',
    symbolOnlyCurrencyHint: 'Changes the displayed currency symbol only. Amounts are not converted.',
    recurrenceHint: 'Repeating entries continue from this date with no end date.',
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
    dayAccessibilityLabel: (day) => `Day ${day}`,
    dayNetAccessibilityValue: (value) => `Net ${value}`,
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
    saveThisAndFuture: 'Save this and future',
    editEntry: (name) => `Edit ${name}`,
    deleteEntry: 'Delete entry',
    deleteConfirmTitle: 'Delete this entry?',
    deleteConfirmMessage: 'This cannot be undone.',
    deleteRecurringTitle: 'Delete repeating entry?',
    deleteRecurringMessage: 'Choose whether to delete only this occurrence or this and all future repeats.',
    deleteOnlyThis: 'Delete only this',
    deleteThisAndFuture: 'Delete this and future',
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
    deleteAllDataConfirmMessage: 'This will permanently delete all entries, repeating series, and budgets. Categories, currency, and settings will be preserved.',
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
  repeats: {
    title: 'Repeats',
    activeCount: (count) => `${count} active`,
    emptyTitle: 'No active repeats',
    emptyMessage: 'Create one by setting Repeat on a new entry.',
    date: (y, m, day) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]} ${day}, ${y}`,
    next: (date) => `Next ${date}`,
    editRepeat: (name) => `Edit repeat: ${name}`,
    stopRepeat: 'Stop repeat',
    chooseCurrentCategory: 'Choose a current category before saving.',
    stopConfirmTitle: 'Stop this repeat?',
    stopConfirmMessage: 'This will stop the repeat from its next occurrence. Past entries will not change.',
    endsBefore: (date) => `Ends before ${date}`,
  },
  keypad: {
    delete: 'Delete',
  },
  corruptNotice: {
    title: 'Backup kept',
    message:
      "Your previous data couldn't be read; a backup copy was kept. You can export it from Settings.",
  },
  persistenceNotice: {
    readFailedTitle: 'Storage unavailable',
    readFailedMessage:
      'Your saved data could not be opened. The app is using a blank local ledger for now; export any important entries before closing.',
    recoveryFailedTitle: 'Backup could not be kept',
    recoveryFailedMessage:
      'Your saved data could not be read, and the unreadable backup could not be written. Export any important entries before closing.',
    saveFailedTitle: 'Changes not saved',
    saveFailedMessage:
      'This change could not be saved to this device. Export your entries now and try restarting before making more changes.',
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
    importFailedTitle: 'Import failed',
    importFailedMessage:
      'Your ledger was not changed. Try exporting the CSV again, or choose a different backup file.',
    exportFailedTitle: 'Export failed',
    exportFailedMessage:
      'Your ledger was not changed. Check storage or sharing permissions, then try exporting again.',
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
  a11y: {
    selected: '選択中',
    notSelected: '未選択',
    textInput: 'テキスト入力',
    categoryName: 'カテゴリ名',
    symbolOnlyCurrencyHint: '表示する通貨記号だけを変更します。金額は換算されません。',
    recurrenceHint: 'この日から終了日なしで繰り返します。',
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
    dayAccessibilityLabel: (day) => `${day}日`,
    dayNetAccessibilityValue: (value) => `収支 ${value}`,
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
    saveThisAndFuture: 'これ以降を保存',
    editEntry: (name) => `${name}を編集`,
    deleteEntry: '記録を削除',
    deleteConfirmTitle: 'この記録を削除しますか？',
    deleteConfirmMessage: 'この操作は取り消せません。',
    deleteRecurringTitle: '繰り返しの記録を削除しますか？',
    deleteRecurringMessage: 'この回だけ、またはこの回以降のすべてを削除できます。',
    deleteOnlyThis: 'この回だけ削除',
    deleteThisAndFuture: 'この回以降を削除',
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
    deleteAllDataConfirmMessage: 'すべての記録、繰り返し、および予算が完全に削除されます。カテゴリ、通貨、および設定は保持されます。',
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
  repeats: {
    title: '繰り返し',
    activeCount: (count) => `${count}件有効`,
    emptyTitle: '有効な繰り返しはありません',
    emptyMessage: '新しい入力で「繰り返し」を設定すると作成できます。',
    date: (y, m, day) => `${y}年${m + 1}月${day}日`,
    next: (date) => `次回 ${date}`,
    editRepeat: (name) => `${name}の繰り返しを編集`,
    stopRepeat: '繰り返しを停止',
    chooseCurrentCategory: '保存する前に現在のカテゴリを選択してください。',
    stopConfirmTitle: 'この繰り返しを停止しますか？',
    stopConfirmMessage: '次回以降の繰り返しを停止します。過去の記録は変更されません。',
    endsBefore: (date) => `${date}より前に終了`,
  },
  keypad: {
    delete: '削除',
  },
  corruptNotice: {
    title: 'バックアップを保持しました',
    message: '以前のデータを読み込めませんでした。バックアップは保持されています。設定から書き出せます。',
  },
  persistenceNotice: {
    readFailedTitle: 'ストレージを開けません',
    readFailedMessage:
      '保存済みデータを開けませんでした。現在は空のローカル帳簿で動作しています。閉じる前に必要な記録を書き出してください。',
    recoveryFailedTitle: 'バックアップを保持できません',
    recoveryFailedMessage:
      '保存済みデータを読み込めず、読み取れないバックアップも保存できませんでした。閉じる前に必要な記録を書き出してください。',
    saveFailedTitle: '変更を保存できません',
    saveFailedMessage:
      'この変更を端末に保存できませんでした。今すぐ記録を書き出し、追加の変更をする前にアプリを再起動してください。',
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
    importFailedTitle: '読み込みに失敗しました',
    importFailedMessage:
      '帳簿は変更されていません。CSVをもう一度書き出すか、別のバックアップファイルを選んでください。',
    exportFailedTitle: '書き出しに失敗しました',
    exportFailedMessage:
      '帳簿は変更されていません。ストレージや共有の権限を確認してから、もう一度書き出してください。',
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
