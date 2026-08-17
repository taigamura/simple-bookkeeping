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

export interface ImportSkipStrings extends ZaimSkipStrings {
  invalidDate: (n: number) => string;
  invalidAmount: (n: number) => string;
  emptyCategory: (n: number) => string;
  unsupportedType: (n: number) => string;
  outOfRange: (n: number) => string;
  unknownFormat: (n: number) => string;
  ambiguousFormat: (n: number) => string;
  currencyMismatch: (n: number) => string;
  unsupportedField: (n: number) => string;
}

export interface Strings {
  common: {
    expense: string;
    income: string;
    add: string;
    cancel: string;
    import: string;
    delete: string;
  };
  a11y: {
    loadingKaji: string;
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
    useDarkMode: string;
    useLightMode: string;
  };
  calendar: {
    previousMonth: string;
    nextMonth: string;
    in: string;
    out: string;
    net: string;
    /** Strip label for the month's remaining budget (#50). */
    budget: string;
    /** Sub-title under the month, counting the month's entries. */
    entriesThisMonth: (n: number) => string;
    /** Header toggle, labelled by the view it switches *to*. */
    showDots: string;
    showNumbers: string;
    dayAccessibilityLabel: (day: number) => string;
    dayNetAccessibilityValue: (value: string) => string;
    emptyDay: string;
  };
  summary: {
    netThisMonth: string;
    /** Hero label in annual mode, where the period is a calendar year. */
    netThisYear: string;
    spendingByCategory: string;
    noSpending: string;
    /** Empty state in annual mode. */
    noSpendingThisYear: string;
    /** Net-card label for the month's remaining budget (#51). */
    budgetLeft: string;
    /** Monthly/Annual granularity toggle. */
    monthly: string;
    annual: string;
    previousPeriod: string;
    nextPeriod: string;
  };
  entry: {
    dateRowLabel: string;
    datePlaceholder: string;
    today: string;
    useToday: string;
    invalidDate: string;
    noteRowLabel: string;
    notePlaceholder: string;
    repeatRowLabel: string;
    weekendRowLabel: string;
    repeatLabels: { never: string; daily: string; monthly: string; yearly: string };
    weekendLabels: { after: string; before: string; off: string };
    addExpense: string;
    addIncome: string;
    save: string;
    saveThisAndFuture: string;
    saveOnlyThis: string;
    saveRecurringTitle: string;
    saveRecurringMessage: string;
    editEntry: (name: string) => string;
    deleteFromList: (name: string) => string;
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
    system: string;
    dark: string;
    light: string;
    /** Motion section: whether the app animates. `system` reuses `system` above. */
    motion: string;
    motionFull: string;
    motionReduced: string;
    currency: string;
    categories: string;
    addCategory: string;
    moveCategoryUp: (name: string) => string;
    moveCategoryDown: (name: string) => string;
    removeCategory: (name: string) => string;
    data: string;
    exportData: string;
    importFromZaim: string;
    importData: string;
    loadSampleData: string;
    loadSampleDataConfirmMessage: string;
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
    clear: string;
    add: string;
    subtract: string;
    multiply: string;
    divide: string;
    equals: string;
  };
  corruptNotice: {
    title: string;
    message: string;
  };
  restoredNotice: {
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
  importData: {
    unknownFormatTitle: string;
    unknownFormatMessage: string;
    ambiguousFormatTitle: string;
    ambiguousFormatMessage: string;
    noSupportedRowsTitle: string;
    noSupportedRowsMessage: string;
    fileTooLargeTitle: string;
    fileTooLargeMessage: string;
    importFailedTitle: string;
    importFailedMessage: string;
    canceledTitle: string;
    canceledMessage: string;
    preview: (provider: string, imported: number) => string;
    duplicates: (count: number) => string;
    completeTitle: string;
    complete: (provider: string, imported: number) => string;
    skip: ImportSkipStrings;
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
  },
  a11y: {
    loadingKaji: 'Loading Suito',
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
    useDarkMode: 'Use dark mode',
    useLightMode: 'Use light mode',
  },
  calendar: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    in: 'In',
    out: 'Out',
    net: 'Net',
    budget: 'Budget',
    entriesThisMonth: (n) => `${n} ${n === 1 ? 'entry' : 'entries'} this month`,
    showDots: 'Show dots',
    showNumbers: 'Show numbers',
    dayAccessibilityLabel: (day) => `Day ${day}`,
    dayNetAccessibilityValue: (value) => `Net ${value}`,
    emptyDay: 'No entries this day. Tap ＋ to add one.',
  },
  summary: {
    netThisMonth: 'Net this month',
    netThisYear: 'Net this year',
    spendingByCategory: 'Spending by category',
    noSpending: 'No spending this month.',
    noSpendingThisYear: 'No spending this year.',
    budgetLeft: 'Budget left',
    monthly: 'Monthly',
    annual: 'Annual',
    previousPeriod: 'Previous period',
    nextPeriod: 'Next period',
  },
  entry: {
    dateRowLabel: 'Date',
    datePlaceholder: 'YYYY-MM-DD',
    today: 'Today',
    useToday: 'Use today',
    invalidDate: 'Enter a valid date.',
    noteRowLabel: 'Note',
    notePlaceholder: 'Optional',
    repeatRowLabel: '↻ Repeat',
    weekendRowLabel: 'If on weekend',
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
    saveOnlyThis: 'Save only this',
    saveRecurringTitle: 'Save repeating entry?',
    saveRecurringMessage: 'Choose whether to save only this occurrence or this and all future repeats.',
    editEntry: (name) => `Edit ${name}`,
    deleteFromList: (name) => `Delete ${name}`,
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
    system: 'System',
    dark: 'Dark',
    light: 'Light',
    motion: 'Motion',
    motionFull: 'Full',
    motionReduced: 'Reduced',
    currency: 'Currency',
    categories: 'Categories',
    addCategory: 'Add category',
    moveCategoryUp: (name) => `Move ${name} up`,
    moveCategoryDown: (name) => `Move ${name} down`,
    removeCategory: (name) => `Remove ${name}`,
    data: 'Data',
    exportData: 'Export data',
    importFromZaim: 'Import from Zaim',
    importData: 'Import data',
    loadSampleData: 'Load sample data',
    loadSampleDataConfirmMessage: 'This replaces your current entries and budgets with fictitious sample data for App Store screenshots. Categories are updated to match; theme, currency, and other settings are preserved.',
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
    clear: 'Clear',
    add: 'Add',
    subtract: 'Subtract',
    multiply: 'Multiply',
    divide: 'Divide',
    equals: 'Equals',
  },
  corruptNotice: {
    title: 'Backup kept',
    message:
      "Your previous data couldn't be read; a backup copy was kept. You can export it from Settings.",
  },
  restoredNotice: {
    title: 'Restored from a backup',
    message:
      'Your ledger was missing on launch, so it was restored from the most recent on-device backup.',
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
  importData: {
    unknownFormatTitle: 'Unsupported CSV format',
    unknownFormatMessage:
      'This file is not a supported Zaim, MoneyForward ME, or おカネレコ export. Your ledger was not changed.',
    ambiguousFormatTitle: 'CSV format is ambiguous',
    ambiguousFormatMessage:
      'This file matched more than one supported format. Your ledger was not changed.',
    noSupportedRowsTitle: 'No supported rows found',
    noSupportedRowsMessage: 'No rows can be imported from this file. Your ledger was not changed.',
    fileTooLargeTitle: 'CSV is too large',
    fileTooLargeMessage:
      'Choose a CSV no larger than 5 MB. Your ledger was not changed.',
    importFailedTitle: 'Import failed',
    importFailedMessage: 'Your ledger was not changed. Choose a supported CSV and try again.',
    canceledTitle: 'Import canceled',
    canceledMessage: 'Your ledger was not changed.',
    preview: (provider, imported) =>
      `${provider}: ${imported} ${imported === 1 ? 'entry' : 'entries'} ready to import`,
    duplicates: (count) => `${count} duplicate${count === 1 ? '' : 's'} skipped`,
    completeTitle: 'Import complete',
    complete: (provider, imported) =>
      `${provider}: imported ${imported} ${imported === 1 ? 'entry' : 'entries'}.`,
    skip: {
      transfer: (n) => `${n} transfer${n === 1 ? '' : 's'} skipped`,
      balanceAdjustment: (n) => `${n} balance adjustment${n === 1 ? '' : 's'} skipped`,
      malformedRow: (n) => `${n} malformed row${n === 1 ? '' : 's'} skipped`,
      invalidDate: (n) => `${n} invalid date${n === 1 ? '' : 's'} skipped`,
      invalidAmount: (n) => `${n} invalid amount${n === 1 ? '' : 's'} skipped`,
      emptyCategory: (n) => `${n} empty categor${n === 1 ? 'y' : 'ies'} skipped`,
      unsupportedType: (n) => `${n} unsupported type${n === 1 ? '' : 's'} skipped`,
      outOfRange: (n) => `${n} out-of-range value${n === 1 ? '' : 's'} skipped`,
      duplicate: (n) => `${n} duplicate${n === 1 ? '' : 's'} skipped`,
      unknownFormat: (n) => `${n} unknown format${n === 1 ? '' : 's'} skipped`,
      ambiguousFormat: (n) => `${n} ambiguous format${n === 1 ? '' : 's'} skipped`,
      currencyMismatch: (n) => `${n} currency mismatch${n === 1 ? '' : 'es'} skipped`,
      unsupportedField: (n) => `${n} unsupported row${n === 1 ? '' : 's'} skipped`,
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
  },
  a11y: {
    loadingKaji: 'Suitoを読み込み中',
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
    useDarkMode: 'ダークモードにする',
    useLightMode: 'ライトモードにする',
  },
  calendar: {
    previousMonth: '前の月',
    nextMonth: '次の月',
    in: '収入',
    out: '支出',
    net: '収支',
    budget: '予算',
    entriesThisMonth: (n) => `今月 ${n} 件`,
    showDots: 'ドット表示',
    showNumbers: '金額表示',
    dayAccessibilityLabel: (day) => `${day}日`,
    dayNetAccessibilityValue: (value) => `収支 ${value}`,
    emptyDay: 'この日の記録はありません。＋をタップして追加しましょう。',
  },
  summary: {
    netThisMonth: '今月の収支',
    netThisYear: '今年の収支',
    spendingByCategory: 'カテゴリ別の支出',
    noSpending: '今月の支出はありません。',
    noSpendingThisYear: '今年の支出はありません。',
    budgetLeft: '予算の残り',
    monthly: '月別',
    annual: '年別',
    previousPeriod: '前の期間',
    nextPeriod: '次の期間',
  },
  entry: {
    dateRowLabel: '日付',
    datePlaceholder: 'YYYY-MM-DD',
    today: '今日',
    useToday: '今日にする',
    invalidDate: '有効な日付を入力してください。',
    noteRowLabel: 'メモ',
    notePlaceholder: '任意',
    repeatRowLabel: '↻ 繰り返し',
    weekendRowLabel: '週末の場合',
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
    saveOnlyThis: 'この回だけ保存',
    saveRecurringTitle: '繰り返しの記録を保存しますか？',
    saveRecurringMessage: 'この回だけ、またはこの回以降のすべてに保存できます。',
    editEntry: (name) => `${name}を編集`,
    deleteFromList: (name) => `${name}を削除`,
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
    system: 'システム',
    dark: 'ダーク',
    light: 'ライト',
    motion: 'アニメーション',
    motionFull: '標準',
    motionReduced: '控えめ',
    currency: '通貨',
    categories: 'カテゴリ',
    addCategory: 'カテゴリを追加',
    moveCategoryUp: (name) => `${name}を上に移動`,
    moveCategoryDown: (name) => `${name}を下に移動`,
    removeCategory: (name) => `${name}を削除`,
    data: 'データ',
    exportData: 'データを書き出す',
    importFromZaim: 'Zaimから読み込む',
    importData: 'データを読み込む',
    loadSampleData: 'サンプルデータを読み込む',
    loadSampleDataConfirmMessage: 'App Store用のスクリーンショット向けに、現在の記録と予算を架空のサンプルデータで置き換えます。カテゴリも合わせて更新されますが、テーマ、通貨、その他の設定は保持されます。',
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
    clear: 'クリア',
    add: '足す',
    subtract: '引く',
    multiply: '掛ける',
    divide: '割る',
    equals: '計算',
  },
  corruptNotice: {
    title: 'バックアップを保持しました',
    message: '以前のデータを読み込めませんでした。バックアップは保持されています。設定から書き出せます。',
  },
  restoredNotice: {
    title: 'バックアップから復元しました',
    message: '起動時に帳簿が見つからなかったため、端末内の最新のバックアップから復元しました。',
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
  importData: {
    unknownFormatTitle: '未対応のCSV形式です',
    unknownFormatMessage:
      'このファイルは、対応するZaim、MoneyForward ME、またはおカネレコのエクスポートではありません。帳簿は変更されていません。',
    ambiguousFormatTitle: 'CSV形式を判別できません',
    ambiguousFormatMessage: 'このファイルは複数の対応形式に一致しました。帳簿は変更されていません。',
    noSupportedRowsTitle: '読み込み可能な行がありません',
    noSupportedRowsMessage: 'このファイルには読み込み可能な行がありません。帳簿は変更されていません。',
    fileTooLargeTitle: 'CSVファイルが大きすぎます',
    fileTooLargeMessage: '5 MB以下のCSVを選択してください。帳簿は変更されていません。',
    importFailedTitle: '読み込みに失敗しました',
    importFailedMessage: '帳簿は変更されていません。対応するCSVを選択して、もう一度試してください。',
    canceledTitle: '読み込みをキャンセルしました',
    canceledMessage: '帳簿は変更されていません。',
    preview: (provider, imported) => `${provider}: ${imported}件の記録を読み込めます`,
    duplicates: (count) => `重複${count}件をスキップしました`,
    completeTitle: '読み込みが完了しました',
    complete: (provider, imported) => `${provider}: ${imported}件の記録を読み込みました。`,
    skip: {
      transfer: (n) => `振替${n}件をスキップしました`,
      balanceAdjustment: (n) => `残高調整${n}件をスキップしました`,
      malformedRow: (n) => `不正な行${n}件をスキップしました`,
      invalidDate: (n) => `不正な日付${n}件をスキップしました`,
      invalidAmount: (n) => `不正な金額${n}件をスキップしました`,
      emptyCategory: (n) => `カテゴリなし${n}件をスキップしました`,
      unsupportedType: (n) => `未対応の種類${n}件をスキップしました`,
      outOfRange: (n) => `範囲外の値${n}件をスキップしました`,
      duplicate: (n) => `重複${n}件をスキップしました`,
      unknownFormat: (n) => `不明な形式${n}件をスキップしました`,
      ambiguousFormat: (n) => `判別できない形式${n}件をスキップしました`,
      currencyMismatch: (n) => `通貨が一致しない行${n}件をスキップしました`,
      unsupportedField: (n) => `未対応の行${n}件をスキップしました`,
    },
  },
};
