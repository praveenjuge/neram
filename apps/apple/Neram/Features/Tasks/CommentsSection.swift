import NeramKit
import SwiftUI

/// A task's comments, like the web: a composer, threaded replies that load
/// in pages, and, when opened from a link, the linked comment's thread.
/// Authors edit their comments; authors and admins delete them.
struct CommentsSection: View {
  let taskId: DocumentID
  let targetCommentId: DocumentID?
  let members: [Member]
  /// Scrolls the task view to a row id once the linked thread loads.
  let scrollTo: (String) -> Void

  @Environment(AppSession.self) private var session
  @State private var roots: PagedQuery<TaskComment>
  @State private var workspace = LiveQuery(Queries.currentOrganization)
  @State private var sheet: CommentSheet?
  @State private var action = Action()

  static let linkedThreadId = "linked-thread"

  init(
    taskId: DocumentID, targetCommentId: DocumentID?, members: [Member],
    scrollTo: @escaping (String) -> Void
  ) {
    self.taskId = taskId
    self.targetCommentId = targetCommentId
    self.members = members
    self.scrollTo = scrollTo
    _roots = State(
      initialValue: PagedQuery(pageSize: 20) { Queries.comments(taskId: taskId, $0) })
  }

  private var context: CommentContext {
    let current = workspace.value ?? nil
    return CommentContext(
      taskId: taskId, currentSubject: current?.membership.userId,
      isAdmin: current?.isAdmin ?? false, targetId: targetCommentId
    ) { action in
      switch action {
      case .reply(let comment): sheet = .reply(comment)
      case .edit(let comment): sheet = .edit(comment)
      case .delete(let comment): Task { await delete(comment) }
      }
    }
  }

  var body: some View {
    if let targetCommentId {
      Section("Linked thread") {
        LinkedThread(targetId: targetCommentId, context: context) {
          scrollTo(Self.linkedThreadId)
        }
        .id(Self.linkedThreadId)
      }
    }
    Section("Comments") {
      CommentComposer(members: members) { body, mentions throws(NeramError) in
        _ = try await session.client.run(
          Calls.createComment(taskId: taskId, body: body, mentions: mentions))
      }
      .task { await roots.run(on: session.client) }
      .task { await workspace.run(on: session.client) }
      .sheet(item: $sheet) { sheet in
        CommentEditor(sheet: sheet, members: members)
      }
      .actionAlert(action)

      if let error = roots.error, roots.items.isEmpty {
        Text(error.localizedDescription).foregroundStyle(.secondary)
      } else if roots.status == .loadingFirstPage {
        ProgressView().frame(maxWidth: .infinity)
      } else if roots.items.isEmpty {
        Text("No comments yet.").foregroundStyle(.secondary)
      }
      ForEach(roots.items) { comment in
        CommentNode(comment: comment, depth: 0, context: context)
      }
      PageFooter(query: roots)
    }
  }

  private func delete(_ comment: TaskComment) async {
    await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.removeComment(comment.id))
    }
  }
}

// MARK: - Shared

/// What every comment in a task needs to know to render and act.
struct CommentContext {
  let taskId: DocumentID
  let currentSubject: String?
  let isAdmin: Bool
  let targetId: DocumentID?
  let perform: (CommentAction) -> Void
}

enum CommentAction {
  case reply(TaskComment)
  case edit(TaskComment)
  case delete(TaskComment)
}

enum CommentSheet: Identifiable {
  case reply(TaskComment)
  case edit(TaskComment)

  var id: String {
    switch self {
    case .reply(let comment): "reply-\(comment.id)"
    case .edit(let comment): "edit-\(comment.id)"
    }
  }
}

// MARK: - Thread

/// One comment and, below it, its replies. Indentation stops after three
/// levels, as on the web.
private struct CommentNode: View {
  let comment: TaskComment
  let depth: Int
  let context: CommentContext
  var showsReplies = true

  @State private var confirmingDelete = false

  private var canEdit: Bool {
    !comment.isDeleted && comment.authorSubject == context.currentSubject
  }
  private var canDelete: Bool { !comment.isDeleted && (canEdit || context.isAdmin) }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        UserAvatar(name: comment.authorName, size: 24)
          .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        VStack(alignment: .leading, spacing: 4) {
          header
          CommentBody(comment: comment)
          Button("Reply") {
            context.perform(.reply(comment))
          }
          .font(.caption)
          .buttonStyle(.borderless)
        }
      }
      .padding(6)
      .background(
        comment.id == context.targetId ? Color.accentColor.opacity(0.12) : .clear,
        in: .rect(cornerRadius: 8))
      if showsReplies {
        CommentReplies(parent: comment, depth: depth + 1, context: context)
          .padding(.leading, depth < 3 ? 14 : 0)
          .overlay(alignment: .leading) {
            if depth < 3 { Rectangle().fill(.quaternary).frame(width: 1).padding(.leading, 4) }
          }
      }
    }
  }

  private var header: some View {
    HStack(spacing: 4) {
      Text(comment.authorName).fontWeight(.medium).lineLimit(1)
      if comment.isEdited, !comment.isDeleted {
        Text("· edited").foregroundStyle(.secondary)
      }
      Text("· \(comment.createdDate.formatted(.relative(presentation: .named)))")
        .foregroundStyle(.secondary)
        .lineLimit(1)
      Spacer(minLength: 0)
      if canEdit || canDelete {
        Menu("Comment Actions", systemImage: "ellipsis") {
          if canEdit {
            Button("Edit", systemImage: "pencil") { context.perform(.edit(comment)) }
          }
          if canDelete {
            Button("Delete", systemImage: "trash", role: .destructive) {
              confirmingDelete = true
            }
          }
        }
        .labelStyle(.iconOnly)
        .buttonStyle(.borderless)
        .confirmationDialog(
          "Delete this comment?", isPresented: $confirmingDelete, titleVisibility: .visible
        ) {
          Button("Delete Comment", role: .destructive) { context.perform(.delete(comment)) }
        } message: {
          Text("Replies stay, and the comment shows as deleted.")
        }
      }
    }
    .font(.subheadline)
  }
}

/// A comment's text with mentions emphasized, or a deleted placeholder.
private struct CommentBody: View {
  let comment: TaskComment

  var body: some View {
    if comment.isDeleted {
      Text("Comment deleted").italic().foregroundStyle(.secondary)
    } else {
      Text(attributed).textSelection(.enabled)
    }
  }

  private var attributed: AttributedString {
    MentionText.segments(body: comment.body, mentions: comment.mentions).reduce(
      into: AttributedString()
    ) { result, segment in
      switch segment {
      case .text(let text):
        result += AttributedString(text)
      case .mention(let mention):
        var run = AttributedString("@\(mention.label)")
        run.foregroundColor = .accentColor
        run.font = .body.weight(.medium)
        result += run
      }
    }
  }
}

/// A comment's replies, ten at a time.
private struct CommentReplies: View {
  let depth: Int
  let context: CommentContext

  @Environment(AppSession.self) private var session
  @State private var replies: PagedQuery<TaskComment>

  init(parent: TaskComment, depth: Int, context: CommentContext) {
    self.depth = depth
    self.context = context
    _replies = State(
      initialValue: PagedQuery(pageSize: 10) {
        Queries.comments(taskId: parent.taskId, parentCommentId: parent.id, $0)
      })
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(replies.items) { reply in
        CommentNode(comment: reply, depth: depth, context: context)
      }
      if replies.status == .canLoadMore {
        Button("Load more replies") { replies.loadMore() }
          .font(.caption)
          .buttonStyle(.borderless)
      } else if replies.status == .loadingMore {
        ProgressView().controlSize(.small)
      }
    }
    .task { await replies.run(on: session.client) }
  }
}

// MARK: - Linked thread

/// The chain from a linked comment's root down to it, with the linked
/// comment's own replies, like the web. Very deep chains load older
/// comments in pages of 100.
private struct LinkedThread: View {
  let targetId: DocumentID
  let context: CommentContext
  let onLoad: () -> Void

  @Environment(AppSession.self) private var session
  @State private var ancestry: LiveQuery<CommentAncestry>

  init(targetId: DocumentID, context: CommentContext, onLoad: @escaping () -> Void) {
    self.targetId = targetId
    self.context = context
    self.onLoad = onLoad
    _ancestry = State(
      initialValue: LiveQuery(Queries.commentAncestry(commentId: targetId, limit: 100)))
  }

  var body: some View {
    Group {
      if let page = ancestry.value {
        if page.taskId == context.taskId {
          AncestryPage(page: page, targetId: targetId, context: context)
        } else {
          unavailable
        }
      } else if ancestry.error != nil {
        unavailable
      } else {
        ProgressView().frame(maxWidth: .infinity)
      }
    }
    .task { await ancestry.run(on: session.client) }
    .onChange(of: ancestry.value != nil) { _, loaded in
      if loaded { onLoad() }
    }
  }

  private var unavailable: some View {
    Text("Linked comment unavailable.").foregroundStyle(.secondary)
  }
}

private struct AncestryPage: View {
  let page: CommentAncestry
  let targetId: DocumentID
  let context: CommentContext

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if let older = page.nextCommentId {
        OlderAncestry(startId: older, targetId: targetId, context: context)
      }
      ForEach(Array(page.comments.enumerated()), id: \.element.id) { index, comment in
        CommentNode(
          comment: comment, depth: index, context: context,
          showsReplies: comment.id == targetId
        )
        .padding(.leading, CGFloat(min(index, 3)) * 12)
      }
    }
  }
}

/// Older comments above a deep chain, loaded when asked for.
private struct OlderAncestry: View {
  let startId: DocumentID
  let targetId: DocumentID
  let context: CommentContext

  @Environment(AppSession.self) private var session
  @State private var shown = false
  @State private var ancestry: LiveQuery<CommentAncestry>

  init(startId: DocumentID, targetId: DocumentID, context: CommentContext) {
    self.startId = startId
    self.targetId = targetId
    self.context = context
    _ancestry = State(
      initialValue: LiveQuery(
        Queries.commentAncestry(commentId: targetId, startCommentId: startId, limit: 100)))
  }

  var body: some View {
    if !shown {
      Button("Show earlier comments") { shown = true }
        .font(.caption)
        .buttonStyle(.borderless)
    } else if let page = ancestry.value {
      AncestryPage(page: page, targetId: targetId, context: context)
    } else {
      ProgressView()
        .task { await ancestry.run(on: session.client) }
    }
  }
}

// MARK: - Reply and edit

private struct CommentEditor: View {
  let sheet: CommentSheet
  let members: [Member]

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      Form {
        switch sheet {
        case .reply(let parent):
          Section("Replying to \(parent.authorName)") {
            CommentBody(comment: parent).lineLimit(4)
          }
          Section {
            CommentComposer(
              members: members, placeholder: "Reply to \(parent.authorName)…", autoFocus: true
            ) { body, mentions throws(NeramError) in
              _ = try await session.client.run(
                Calls.replyToComment(parent.id, body: body, mentions: mentions))
              dismiss()
            }
          }
        case .edit(let comment):
          Section {
            CommentComposer(
              members: members, initialBody: comment.body, initialMentions: comment.mentions,
              autoFocus: true
            ) { body, mentions throws(NeramError) in
              try await session.client.run(
                Calls.editComment(comment.id, body: body, mentions: mentions))
              dismiss()
            }
          }
        }
      }
      .navigationTitle(title)
      #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
      #endif
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
      }
    }
  }

  private var title: String {
    switch sheet {
    case .reply: "Reply"
    case .edit: "Edit Comment"
    }
  }
}
