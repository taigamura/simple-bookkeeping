import FoundationModels

// Guided-generation output types. The model generates properties top to bottom, so the
// fields it should decide first come first (e.g. Nudge.skip before Nudge.text).

@Generable(description: "Whether the entry is money spent or money received")
enum GenEntryType {
  case expense
  case income
}

@Generable(description: "One household-budget entry read from a short phrase")
struct GenParsedEntry {
  @Guide(description: "The words in the phrase that say WHEN, copied exactly, e.g. 昨日, おととい, 先週の金曜, 10/3, 3日前, yesterday, last Friday. Empty if the phrase does not say when.")
  var dateText: String

  @Guide(description: "The money amount as a whole number with no currency symbol. 千 = 1000, 万 = 10000 (1.2万 = 12000). Round decimals (12.50 = 13). Never use a number that is part of a date. Omit if the phrase has no amount.")
  var amount: Int?

  @Guide(description: "income for salary, wages, bonus, refunds, gifts received, selling things (給料, ボーナス, 臨時収入, 返金); otherwise expense")
  var type: GenEntryType

  @Guide(description: "Exactly one category name copied from the allowed list for this type, or omit if none fits")
  var category: String?

  @Guide(description: "The leftover words that say what it was, such as a shop or item (スタバ, coffee with Ken). Exclude the amount, the date words and the category name. Empty if nothing is left.")
  var note: String
}

@Generable(description: "A short, kind monthly letter about the user's household budget")
struct GenLetter {
  @Guide(description: "2 or 3 short paragraphs of 1 to 3 sentences each. Numbers appear only as fact tokens like {f:expense-total}.", .count(2...3))
  var paragraphs: [String]
}

@Generable(description: "At most one gentle observation for the Summary screen")
struct GenNudge {
  @Guide(description: "true when none of the facts is worth mentioning today; then the text is ignored")
  var skip: Bool

  @Guide(description: "One short sentence that cites at least one fact token like {f:no-spend-days}. Empty when skip is true.")
  var text: String
}

@Generable(description: "What kind of question the user asked about their money")
enum GenAskKind {
  /// A lookup the ledger can answer: totals, a category, entries, comparisons between periods.
  case lookup
  /// Open-ended advice or planning: how to save, whether to buy something, a budget plan.
  case advice
  /// Small talk or anything else.
  case other
}

@Generable(description: "Classification of a question")
struct GenAskRoute {
  @Guide(description: "lookup = asks for amounts, totals, categories, entries or comparisons; advice = asks what to do, how to save, or for a plan or prediction; other = anything else")
  var kind: GenAskKind
}

// MARK: - Ask tool arguments

@Generable(description: "Arguments for periodSummary")
struct GenPeriodArgs {
  @Guide(description: "A month as YYYY-MM, or a range of months as YYYY-MM..YYYY-MM, or a year as YYYY")
  var period: String
}

@Generable(description: "Arguments for categorySpending")
struct GenCategoryArgs {
  @Guide(description: "A category name from the user's category list")
  var category: String

  @Guide(description: "A month as YYYY-MM, or a range of months as YYYY-MM..YYYY-MM, or a year as YYYY")
  var period: String
}

@Generable(description: "Arguments for findEntries")
struct GenFindArgs {
  @Guide(description: "A month as YYYY-MM, a range YYYY-MM..YYYY-MM, or a year YYYY. Empty for recent entries.")
  var period: String

  @Guide(description: "A category name from the user's category list, or empty for all categories")
  var category: String

  @Guide(description: "Words to look for in the entry note, such as a shop name, or empty")
  var text: String
}
