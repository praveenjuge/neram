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

  private static func substring(_ text: String, from start: Int, to end: Int) -> String? {
    range(start: start, length: end - start, in: text).map { String(text[$0]) }
  }
}
