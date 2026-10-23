import ExpoModulesCore
import FoundationModels

/// JS-facing error codes (`error.code` on the rejected promise). Adapted from koemori-ai.
enum SuitoAiErrorCode: String {
  case context = "ERR_CONTEXT" // exceeded the ~4K context window
  case guardrail = "ERR_GUARDRAIL" // guardrail violation or model refusal
  case unavailable = "ERR_UNAVAILABLE" // model not available / assets missing
  case language = "ERR_LANGUAGE" // unsupported language or locale
  case busy = "ERR_BUSY" // rate limited (e.g. app in background) or concurrent requests
  case decoding = "ERR_DECODING" // guided generation could not be decoded
  case cancelled = "ERR_CANCELLED"
  case input = "ERR_INPUT" // malformed JSON from JS
  case io = "ERR_IO" // snapshot / inbox / Spotlight write failed
  case generation = "ERR_GENERATION" // anything else
}

func suitoException(_ code: SuitoAiErrorCode, _ message: String) -> Exception {
  Exception(name: code.rawValue, description: message, code: code.rawValue)
}

func mapSuitoError(_ error: Error) -> Exception {
  if let exception = error as? Exception { return exception }
  if error is CancellationError { return suitoException(.cancelled, "Generation was cancelled") }
  if let generationError = error as? LanguageModelSession.GenerationError {
    switch generationError {
    case .exceededContextWindowSize(let context):
      return suitoException(.context, context.debugDescription)
    case .guardrailViolation(let context):
      return suitoException(.guardrail, context.debugDescription)
    case .refusal(_, let context):
      return suitoException(.guardrail, "Refusal: \(context.debugDescription)")
    case .assetsUnavailable(let context):
      return suitoException(.unavailable, context.debugDescription)
    case .unsupportedLanguageOrLocale(let context):
      return suitoException(.language, context.debugDescription)
    case .rateLimited(let context):
      return suitoException(.busy, "Rate limited: \(context.debugDescription)")
    case .concurrentRequests(let context):
      return suitoException(.busy, "Concurrent requests: \(context.debugDescription)")
    case .decodingFailure(let context):
      return suitoException(.decoding, context.debugDescription)
    case .unsupportedGuide(let context):
      return suitoException(.decoding, "Unsupported guide: \(context.debugDescription)")
    @unknown default:
      return suitoException(.generation, generationError.localizedDescription)
    }
  }
  if let toolError = error as? LanguageModelSession.ToolCallError {
    return suitoException(.generation, "Tool \(toolError.tool.name) failed: \(toolError.underlyingError.localizedDescription)")
  }
  if error is DecodingError { return suitoException(.input, "Malformed input: \(error)") }
  return suitoException(.generation, error.localizedDescription)
}
