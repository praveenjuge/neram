import Testing

@testable import NeramKit

struct MentionTextTests {
  let bob = Mention(start: 10, length: 4, subject: "user_bob", label: "Bob")

  @Test func emojiCountsAsTwoUTF16Units() {
    // Same body and offsets as the server fixture taskComments.list.
    let segments = MentionText.segments(body: "Thanks 👋 @Bob", mentions: [bob])
    #expect(segments == [.text("Thanks 👋 "), .mention(bob)])
  }

  @Test func offsetsRoundTrip() throws {
    let text = "Hi 👩‍👩‍👧 @Bob, thanks"
    let range = try #require(text.range(of: "@Bob"))
    let (start, length) = MentionText.offsets(of: range, in: text)
    #expect(length == 4)
    #expect(MentionText.range(start: start, length: length, in: text) == range)
  }

  @Test func invalidMentionsStayPlainText() {
    let outside = Mention(start: 50, length: 3, subject: "user_x", label: "X")
    #expect(MentionText.segments(body: "Hello", mentions: [outside]) == [.text("Hello")])
  }

  @Test func textAfterMentionIsKept() {
    let segments = MentionText.segments(
      body: "@Bob please review",
      mentions: [Mention(start: 0, length: 4, subject: "user_bob", label: "Bob")])
    #expect(segments.count == 2)
    #expect(segments.last == .text(" please review"))
  }

  @Test func limitsCountUTF16UnitsAndKeepWholeCharacters() {
    #expect(String(repeating: "a", count: 90).prefix(utf16Limit: 80).count == 80)
    // 41 emoji are 82 UTF-16 units; only 40 fit in 80.
    let emoji = String(repeating: "🚀", count: 41)
    #expect(emoji.prefix(utf16Limit: 80).utf16.count == 80)
    #expect(emoji.prefix(utf16Limit: 80).count == 40)
    #expect("ok".prefix(utf16Limit: 80) == "ok")
  }
}
