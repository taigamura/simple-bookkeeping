// Compiled into the MAIN APP TARGET only (copied by plugins/withSuitoAppIntents.js).
// App Shortcuts surface the intents in Siri, Spotlight, Shortcuts and the Action Button picker
// with no setup. Japanese and English phrases share one list (no per-locale string catalog yet).
// Phrases with \(\.$category) are filled from CategoryQuery.suggestedEntities() whenever
// SuitoShortcutsUpdater.update() runs (after each Siri snapshot write).

import AppIntents

struct SuitoAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddEntryIntent(),
      phrases: [
        "\(.applicationName)で記録",
        "\(.applicationName)に記録",
        "\(.applicationName)で\(\.$category)を記録",
        "Add an entry in \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "Log \(\.$category) in \(.applicationName)",
      ],
      shortTitle: "Add Entry",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: PeriodSummaryIntent(),
      phrases: [
        "\(.applicationName)の収支",
        "\(.applicationName)で\(\.$period)の収支",
        "\(.applicationName)で\(\.$period)いくら使った",
        "\(.applicationName) summary",
        "\(.applicationName) summary for \(\.$period)",
        "How much did I spend \(\.$period) in \(.applicationName)",
      ],
      shortTitle: "Summary",
      systemImageName: "chart.bar"
    )
    AppShortcut(
      intent: CategorySpendingIntent(),
      phrases: [
        "\(.applicationName)で\(\.$category)はいくら",
        "\(.applicationName)の\(\.$category)",
        "\(.applicationName)でカテゴリ別の支出",
        "\(\.$category) spending in \(.applicationName)",
        "Spending by category in \(.applicationName)",
      ],
      shortTitle: "Spending by Category",
      systemImageName: "chart.pie"
    )
    AppShortcut(
      intent: FindEntriesIntent(),
      phrases: [
        "\(.applicationName)で記録を探す",
        "Find entries in \(.applicationName)",
      ],
      shortTitle: "Find Entries",
      systemImageName: "magnifyingglass"
    )
  }
}
