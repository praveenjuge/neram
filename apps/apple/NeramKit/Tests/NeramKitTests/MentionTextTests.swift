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

  @Test func queryNeedsAnAtAfterSpaceOrStart() {
    let text = "Hi @bo"
    let found = MentionText.query(in: text, caret: text.endIndex)
    #expect(found?.query == "bo")
    #expect(found.map { text[$0.start...] } == "@bo")
    #expect(MentionText.query(in: "@", caret: "@".endIndex)?.query == "")
    #expect(MentionText.query(in: "mail@bo", caret: "mail@bo".endIndex) == nil)
    #expect(MentionText.query(in: "@bo b", caret: "@bo b".endIndex) == nil)
    let multiline = "Hey\n@al"
    #expect(MentionText.query(in: multiline, caret: multiline.endIndex)?.query == "al")
  }

  @Test func mentionsFollowTokensInOrderWithUTF16Offsets() {
    let body = "👋 @Bob and @Al, then @Bob"
    let mentions = MentionText.mentions(
      in: body,
      tokens: [("user_bob", "Bob"), ("user_al", "Al"), ("user_bob", "Bob"), ("user_cy", "Cy")])
    #expect(mentions.map(\.subject) == ["user_bob", "user_al", "user_bob"])
    // The emoji is two UTF-16 units, so "@Bob" starts at 3, not 2.
    #expect(mentions.map { Int($0.start) } == [3, 12, 22])
    #expect(MentionText.segments(body: body, mentions: mentions).count == 6)
  }

  @Test func mentionsPickedOutOfTextOrderAllCount() {
    // @Bob was picked first, then @Al inserted before it.
    let mentions = MentionText.mentions(
      in: "@Al @Bob", tokens: [("user_bob", "Bob"), ("user_al", "Al")])
    #expect(mentions.map(\.subject) == ["user_al", "user_bob"])
    #expect(mentions.map { Int($0.start) } == [0, 4])
    let twice = MentionText.mentions(
      in: "@Bob and @Bob", tokens: [("user_bob", "Bob"), ("user_bob", "Bob")])
    #expect(twice.map { Int($0.start) } == [0, 9])
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
