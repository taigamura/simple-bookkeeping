// Compiled into the MAIN APP TARGET only (copied by plugins/withSuitoAppIntents.js).
// App Shortcuts surface the intents in Siri, Spotlight, Shortcuts and the Action Button picker
// with no setup. Base phrases are English; the Japanese phrases are their translations in
// ja.lproj/AppShortcuts.strings (written by the plugin: JA_APP_SHORTCUTS). Siri only matches
// phrases for the languages the app is localized in, so JA phrases must live there, one
// translation per English phrase (keep the two lists aligned).
// Phrases with \(\.$category) are filled from CategoryQuery.suggestedEntities() whenever
// SuitoShortcutsUpdater.update() runs (after each Siri snapshot write).

import AppIntents

struct SuitoAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddEntryIntent(),
      phrases: [
        "Add an entry in \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "Add to \(.applicationName)",
        "Log \(\.$category) in \(.applicationName)",
        "Record \(\.$category) in \(.applicationName)",
      ],
      shortTitle: "Add Entry",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: PeriodSummaryIntent(),
      phrases: [
        "\(.applicationName) summary",
        "Show my \(.applicationName) balance",
        "\(.applicationName) summary for \(\.$period)",
        "How much did I spend \(\.$period) in \(.applicationName)",
      ],
      shortTitle: "Summary",
      systemImageName: "chart.bar"
    )
    AppShortcut(
      intent: CategorySpendingIntent(),
      phrases: [
        "\(\.$category) spending in \(.applicationName)",
        "How much on \(\.$category) in \(.applicationName)",
        "Spending by category in \(.applicationName)",
      ],
      shortTitle: "Spending by Category",
      systemImageName: "chart.pie"
    )
    AppShortcut(
      intent: FindEntriesIntent(),
      phrases: [
        "Find entries in \(.applicationName)",
      ],
      shortTitle: "Find Entries",
      systemImageName: "magnifyingglass"
    )
  }
}
