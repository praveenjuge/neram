import NeramKit
import SwiftUI

/// A comment field with @mention suggestions, like the web composer. Typing
/// `@` after a space suggests members; picking one inserts `@Name ` and
/// records it, and Post sends UTF-16 mention spans for the names still in
/// the text.
struct CommentComposer: View {
  let members: [Member]
  var placeholder = "Write a comment…"
  var initialBody = ""
  var initialMentions: [Mention] = []
  var autoFocus = false
  var onCancel: (() -> Void)?
  let onSubmit: (_ body: String, _ mentions: [Mention]) async throws(NeramError) -> Void

  @Environment(AppSession.self) private var session
  @State private var draft = ""
  @State private var tokens: [Token] = []
  @State private var selection: TextSelection?
  @State private var action = Action()
  @State private var loaded = false
  @FocusState private var focused: Bool

  static let limit = 5000

  private struct Token: Hashable {
    let subject: String
    let label: String
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField(
        placeholder,
        text: Binding(get: { draft }, set: { draft = $0.prefix(utf16Limit: Self.limit) }),
        selection: $selection, axis: .vertical
      )
      .lineLimit(2...10)
      .focused($focused)
      if !matches.isEmpty {
        suggestions
      }
      HStack {
        Spacer()
        if let onCancel {
          Button("Cancel", action: onCancel)
            .buttonStyle(.borderless)
        }
        Button(action.isRunning ? "Posting…" : "Post") {
          Task { await submit() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(!canPost)
      }
      .controlSize(.small)
    }
    .actionAlert(action)
    .onAppear {
      guard !loaded else { return }
      loaded = true
      draft = initialBody
      tokens = initialMentions.map { Token(subject: $0.subject, label: $0.label) }
      if autoFocus {
        // Editing continues from the end of the existing text.
        selection = TextSelection(insertionPoint: draft.endIndex)
        focused = true
      }
    }
  }

  private var canPost: Bool {
    !action.isRunning && session.isConnected
      && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  // MARK: - Mentions

  /// The caret, when the selection is a single insertion point.
  private var caret: String.Index? {
    guard case .selection(let range) = selection?.indices, range.isEmpty,
      range.lowerBound <= draft.endIndex
    else { return nil }
    return range.lowerBound
  }

  private var query: (query: String, start: String.Index)? {
    caret.flatMap { MentionText.query(in: draft, caret: $0) }
  }

  private var matches: [Member] {
    guard focused, let query else { return [] }
    let needle = query.query.lowercased()
    return Array(
      members.filter { needle.isEmpty || $0.displayName.lowercased().contains(needle) }.prefix(8))
  }

  private var suggestions: some View {
    VStack(alignment: .leading, spacing: 2) {
      ForEach(matches) { member in
        Button {
          insert(member)
        } label: {
          HStack {
            UserAvatar(name: member.displayName)
            Text("@\(member.displayName)")
            Spacer()
          }
          .contentShape(.rect)
        }
        .buttonStyle(.borderless)
        .foregroundStyle(.primary)
      }
    }
    .padding(.vertical, 4)
  }

  private func insert(_ member: Member) {
    guard let caret, let query else { return }
    let insertion = "@\(member.displayName) "
    var text = draft
    text.replaceSubrange(query.start..<caret, with: insertion)
    guard text.utf16.count <= Self.limit else { return }
    let offset = draft.distance(from: draft.startIndex, to: query.start) + insertion.count
    draft = text
    tokens.append(Token(subject: member.userId, label: member.displayName))
    selection = TextSelection(insertionPoint: text.index(text.startIndex, offsetBy: offset))
  }

  private func submit() async {
    guard canPost else { return }
    let text = draft
    let mentions = MentionText.mentions(
      in: text, tokens: tokens.map { (subject: $0.subject, label: $0.label) })
    let posted = await action.run { () async throws(NeramError) in
      try await onSubmit(text, mentions)
    }
    // Keep anything typed while posting; clear only what was sent.
    if posted, draft == text {
      draft = ""
      tokens = []
      selection = nil
    }
  }
}
