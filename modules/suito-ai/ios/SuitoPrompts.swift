import Foundation

// All instructions in English (Apple's guidance for the on-device model) with the user's locale
// stated; output language follows the locale. Same approach as voice-memo's koemori-ai.

enum SuitoPrompts {
  static func localeLine(_ locale: String) -> String {
    locale == "ja" ? "The user's locale is ja_JP. Write in natural, warm Japanese." : "The user's locale is en_US. Write in plain, warm English."
  }

  static let noDashLine = "Never use em dashes (\u{2014}) or horizontal bars (\u{2015})."

  static let tokenRules = """
  Numbers: every amount, percentage, count or date number must be written ONLY as a fact token \
  copied from the list, exactly like {f:expense-total}. Never write digits (0-9) yourself, not even \
  for months or days; say "last month" / 先月 instead of a month number. Never invent a token id that \
  is not in the list.
  """

  static let kindRules = """
  Tone: kind, calm and encouraging, like a friend who is good with money. Never scold, warn, shame or \
  pressure. Spending more is described neutrally ("food came to {f:x}"), never as a failure. Celebrate \
  small wins such as no-spend days or a budget kept.
  """

  // MARK: parse

  static func parseInstructions(locale: String) -> String {
    """
    You read one short phrase a user typed or dictated into a household budget app (家計簿) and \
    fill in one entry. \(localeLine(locale))
    Only use what the phrase says; leave a field empty when the phrase does not say it. The category \
    must be copied exactly from the allowed list for the entry's type. Words such as 給料, ボーナス, \
    salary, paycheck mean income. Most phrases are expenses.
    """
  }

  static func parsePrompt(text: String, expCats: [String], incCats: [String], today: String) -> String {
    """
    Today: \(today)
    Expense categories: \(expCats.joined(separator: ", "))
    Income categories: \(incCats.joined(separator: ", "))
    Phrase: \"\"\"\(text)\"\"\"
    """
  }

  // MARK: letter / nudge

  static func letterInstructions(locale: String) -> String {
    """
    You write a short monthly letter to the user of a household budget app, looking back on one month. \
    \(localeLine(locale))
    Write 2 or 3 short paragraphs: first how the month went overall, then one or two things worth \
    noticing, then a gentle word for the coming month. Pick only the most interesting facts; you do not \
    need to use them all.
    \(tokenRules)
    \(kindRules)
    \(noDashLine)
    """
  }

  static func nudgeInstructions(locale: String) -> String {
    """
    You pick at most one gentle observation for the Summary screen of a household budget app. \
    \(localeLine(locale))
    Choose the single fact most worth a short remark today, or set skip to true when nothing stands \
    out. Saying nothing is fine. The remark is one short sentence (about forty Japanese characters or \
    fifteen English words at most) and must cite the fact with its token.
    \(tokenRules)
    \(kindRules)
    \(noDashLine)
    """
  }

  /// Facts as id + label + tone. The model cites `{f:<id>}`; the app renders the display string.
  static func factLines(_ facts: [FactIn]) -> String {
    facts.map { "- {f:\($0.id)}: \($0.label) (tone: \($0.tone))" }.joined(separator: "\n")
  }

  static func letterPrompt(monthName: String, facts: [FactIn]) -> String {
    """
    The letter is about \(monthName).
    Facts (cite with the token on the left):
    \(factLines(facts))
    """
  }

  static func nudgePrompt(facts: [FactIn]) -> String {
    """
    Facts (cite with the token on the left):
    \(factLines(facts))
    """
  }

  // MARK: ask

  static func askRouteInstructions() -> String {
    """
    Classify the user's question to a household budget app. lookup = it asks for amounts, totals, \
    spending by category, entries, or a comparison between periods. advice = it asks what they should \
    do, how to save, whether to buy something, for a plan, or for a prediction. other = anything else.
    """
  }

  static func askInstructions(locale: String, today: String, thisMonth: String, expCats: [String], incCats: [String], currency: String) -> String {
    """
    You answer questions about the user's own household budget inside the app Suito. \(localeLine(locale))
    Today is \(today); this month is \(thisMonth). Amounts are in \(currency).
    Expense categories: \(expCats.joined(separator: ", "))
    Income categories: \(incCats.joined(separator: ", "))
    Rules:
    1. Get every number from the tools (periodSummary, categorySpending, findEntries). Never calculate, \
    estimate or guess an amount yourself; repeat the tool's amounts exactly as written.
    2. Months are written YYYY-MM when calling tools. "This month" is \(thisMonth).
    3. If the tools do not give the answer, say you don't know (わかりません) and say briefly what is missing.
    4. Be brief: one to three sentences unless the user asks for a list. Be kind; never scold.
    5. For advice or planning, give at most one gentle, general idea based on the numbers.
    \(noDashLine)
    """
  }

  static func askPrompt(question: String, history: [(role: String, text: String)]) -> String {
    var parts: [String] = []
    if !history.isEmpty {
      let lines = history.map { ($0.role == "assistant" ? "Assistant: " : "User: ") + $0.text }
      parts.append("Conversation so far:\n" + lines.joined(separator: "\n"))
    }
    parts.append("Question: \(question)")
    return parts.joined(separator: "\n\n")
  }

  static func monthName(m0: Int) -> String {
    let names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    let index = max(0, min(11, m0))
    // No year: digits in the prompt invite digits in the output (which the app rejects).
    return names[index]
  }
}
