import Foundation

/// Comment bodies store mentions as UTF-16 offsets, the same units as
/// JavaScript strings on the server and web. Swift strings index by
/// `Character`, so all conversions go through `String.utf16`.
public enum MentionText {
  public enum Segment: Hashable, Sendable {
    case text(String)
    case mention(Mention)
  }

  /// Splits `body` into plain text and mention runs, in order. Mentions that
  /// overlap or fall outside the body are rendered as plain text.
  public static func segments(body: String, mentions: [Mention]) -> [Segment] {
    let utf16 = body.utf16
    var segments: [Segment] = []
    var cursor = 0
    for mention in mentions.sorted(by: { $0.start < $1.start }) {
      let start = Int(mention.start)
      let end = start + Int(mention.length)
      guard start >= cursor, end <= utf16.count, mention.length > 0 else { continue }
      if start > cursor, let text = substring(body, from: cursor, to: start) {
        segments.append(.text(text))
      }
      segments.append(.mention(mention))
      cursor = end
    }
    if cursor < utf16.count, let text = substring(body, from: cursor, to: utf16.count) {
      segments.append(.text(text))
    }
    return segments
  }

  /// The UTF-16 `start` and `length` of `range` within `text`.
  public static func offsets(of range: Range<String.Index>, in text: String) -> (
    start: Int, length: Int
  ) {
    let start = text.utf16.distance(from: text.startIndex, to: range.lowerBound)
    let length = text.utf16.distance(from: range.lowerBound, to: range.upperBound)
    return (start, length)
  }

  /// The `String` range for a UTF-16 `start` and `length`, if it falls on
  /// character boundaries inside `text`.
  public static func range(start: Int, length: Int, in text: String) -> Range<String.Index>? {
    let utf16 = text.utf16
    guard start >= 0, length >= 0, start + length <= utf16.count else { return nil }
    let lower = utf16.index(utf16.startIndex, offsetBy: start)
    let upper = utf16.index(lower, offsetBy: length)
    guard let lowerBound = lower.samePosition(in: text),
      let upperBound = upper.samePosition(in: text)
    else { return nil }
    return lowerBound..<upperBound
  }

  /// The `@query` being typed just before `caret`, like the web composer: the
  /// `@` must start the text or follow a space or newline, and the query
  /// stops at whitespace. `start` is the index of the `@`.
  public static func query(in text: String, caret: String.Index) -> (
    query: String, start: String.Index
  )? {
    var index = caret
    while index > text.startIndex {
      let previous = text.index(before: index)
      let character = text[previous]
      if character == "@" {
        guard
          previous == text.startIndex || [" ", "\n"].contains(text[text.index(before: previous)])
        else { return nil }
        return (String(text[text.index(after: previous)..<caret]), previous)
      }
      if character == " " || character == "\n" { return nil }
      index = previous
    }
    return nil
  }

  /// Mention spans for the tokens inserted into `body`, in text order. Each
  /// token takes the first `@label` not already taken, so mentions picked in
  /// any order (a name inserted before an earlier one) all count, and a name
  /// mentioned twice gets two spans. Tokens whose text was deleted are
  /// dropped. Offsets are UTF-16.
  public static func mentions(in body: String, tokens: [(subject: String, label: String)])
    -> [Mention]
  {
    var taken: [Range<String.Index>] = []
    var mentions: [Mention] = []
    for token in tokens {
      let text = "@\(token.label)"
      var searchFrom = body.startIndex
      var found: Range<String.Index>?
      while let range = body.range(of: text, range: searchFrom..<body.endIndex) {
        if !taken.contains(where: { $0.overlaps(range) }) {
          found = range
          break
        }
        searchFrom = body.index(after: range.lowerBound)
      }
      guard let range = found else { continue }
      taken.append(range)
      let (start, length) = offsets(of: range, in: body)
      mentions.append(
        Mention(start: start, length: length, subject: token.subject, label: token.label))
    }
    return mentions.sorted { $0.start < $1.start }
  }

  private static func substring(_ text: String, from start: Int, to end: Int) -> String? {
    range(start: start, length: end - start, in: text).map { String(text[$0]) }
  }
}

extension String {
  /// The longest prefix of whole characters that fits in `limit` UTF-16 code
  /// units. Server limits count JavaScript string length (UTF-16), so an
  /// emoji uses two of them.
  public func prefix(utf16Limit limit: Int) -> String {
    guard utf16.count > limit else { return self }
    var result = ""
    var used = 0
    for character in self {
      let size = character.utf16.count
      if used + size > limit { break }
      result.append(character)
      used += size
    }
    return result
  }
}
