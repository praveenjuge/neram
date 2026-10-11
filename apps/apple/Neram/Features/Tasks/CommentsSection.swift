import NeramKit
import SwiftUI

/// A task's comments and their live queries. Owned by the task screen and
/// run from its `.task`, because List drops rows (and cancels their tasks)
/// as they scroll away; anything long-lived must not hang off a row.
@MainActor
@Observable
final class TaskComments {
  let taskId: DocumentID
  let roots: PagedQuery<TaskComment>
  let workspace = LiveQuery(Queries.currentOrganization)
  /// The linked comment's thread, when the task was opened at a comment.
  let linked: LinkedThread?
  var sheet: CommentSheet?
  let action = Action()

  init(taskId: DocumentID, targetId: DocumentID?) {
    self.taskId = taskId
    roots = PagedQuery(pageSize: 20) { Queries.comments(taskId: taskId, $0) }
    linked = targetId.map(LinkedThread.init)
  }

  func run(on client: NeramClient) async {
    async let rootsRun: Void = roots.run(on: client)
    async let workspaceRun: Void = workspace.run(on: client)
    async let linkedRun: Void = runLinked(on: client)
    _ = await (rootsRun, workspaceRun, linkedRun)
  }

  private func runLinked(on client: NeramClient) async {
    await linked?.run(on: client)
  }

  func delete(_ comment: TaskComment, on client: NeramClient) async {
    await action.run { () async throws(NeramError) in
      try await client.run(Calls.removeComment(comment.id))
    }
  }
}

/// The comment sections of a task, like the web: a composer, threaded
/// replies that load in pages, and, when opened from a link, the linked
/// comment's thread. Authors edit their comments; authors and admins
/// delete them.
struct CommentsSection: View {
  let comments: TaskComments
  let members: [Member]

  @Environment(AppSession.self) private var session

  private var taskId: DocumentID { comments.taskId }

  private var context: CommentContext {
    let current = comments.workspace.value ?? nil
    return CommentContext(
      taskId: taskId, currentSubject: current?.membership.userId,
      isAdmin: current?.isAdmin ?? false, targetId: comments.linked?.targetId
    ) { action in
      switch action {
      case .reply(let comment): comments.sheet = .reply(comment)
      case .edit(let comment): comments.sheet = .edit(comment)
      case .delete(let comment): Task { await comments.delete(comment, on: session.client) }
      }
    }
  }

  var body: some View {
    if let linked = comments.linked {
      Section("Linked thread") { linkedRows(linked) }
    }
    Section("Comments") {
      CommentComposer(members: members) { body, mentions throws(NeramError) in
        _ = try await session.client.run(
          Calls.createComment(taskId: taskId, body: body, mentions: mentions))
      }

      let roots = comments.roots
      if let error = roots.error, roots.items.isEmpty {
        LoadErrorRow(error: error, retry: roots.retry)
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

  /// The chain from the root down to the linked comment, one row per
  /// comment so the list can scroll to the linked one.
  @ViewBuilder private func linkedRows(_ linked: LinkedThread) -> some View {
    if let linkedTask = linked.taskId, linkedTask != taskId {
      Text("Linked comment unavailable.").foregroundStyle(.secondary)
    } else {
      if linked.isLoading {
        ProgressView().frame(maxWidth: .infinity)
      } else if linked.hasOlder {
        Button("Show earlier comments") { linked.showOlder() }
          .font(.caption)
          .buttonStyle(.borderless)
      }
      ForEach(Array(linked.comments.enumerated()), id: \.element.id) { index, comment in
        CommentNode(
          comment: comment, depth: index, context: context,
          showsReplies: comment.id == linked.targetId
        )
        .padding(.leading, CGFloat(min(index, 3)) * 12)
        .id(comment.id)
      }
      if let error = linked.error {
        LoadErrorRow(error: error, retry: linked.retry)
      }
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
      if let error = replies.error, replies.items.isEmpty {
        LoadErrorRow(error: error, retry: replies.retry)
      }
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

/// The chain from a linked comment's root down to it, kept live while the
/// task is open, like the web. Very deep chains load older comments in pages
/// of 100 when asked. Pages run here rather than in row views, so rows can
/// appear and disappear without stopping updates.
@MainActor
@Observable
final class LinkedThread {
  let targetId: DocumentID
  /// Nearest page first; each later page holds older comments.
  private(set) var pages: [LiveQuery<CommentAncestry>] = []
  @ObservationIgnored private var tasks: [Task<Void, Never>] = []
  @ObservationIgnored private weak var client: NeramClient?

  init(targetId: DocumentID) {
    self.targetId = targetId
  }

  /// Keeps every loaded page live until the calling task is cancelled.
  func run(on client: NeramClient) async {
    self.client = client
    retry()
    defer { stop() }
    while !Task.isCancelled {
      try? await Task.sleep(for: .seconds(86_400))
    }
  }

  func retry() {
    stop()
    pages = []
    add(startingAt: nil)
  }

  func showOlder() {
    guard let older = pages.last?.value?.nextCommentId else { return }
    add(startingAt: older)
  }

  /// Root first, down to the linked comment.
  var comments: [TaskComment] { pages.reversed().flatMap { $0.value?.comments ?? [] } }
  var taskId: DocumentID? { pages.first?.value?.taskId }
  var isLoaded: Bool { pages.first?.value != nil }
  var isLoading: Bool { pages.contains { $0.value == nil && $0.error == nil } }
  var hasOlder: Bool { pages.last?.value?.nextCommentId != nil }
  var error: NeramError? { pages.lazy.compactMap(\.error).first }

  private func add(startingAt start: DocumentID?) {
    let page = LiveQuery(
      Queries.commentAncestry(commentId: targetId, startCommentId: start, limit: 100))
    pages.append(page)
    guard let client else { return }
    tasks.append(Task { await page.run(on: client) })
  }

  private func stop() {
    for task in tasks { task.cancel() }
    tasks = []
  }
}

/// A failed load, with a way to try again.
private struct LoadErrorRow: View {
  let error: NeramError
  let retry: () -> Void

  var body: some View {
    HStack {
      Label(error.localizedDescription, systemImage: "exclamationmark.triangle")
        .foregroundStyle(.secondary)
      Spacer()
      Button("Try Again", action: retry)
        .buttonStyle(.borderless)
    }
    .font(.caption)
  }
}

// MARK: - Reply and edit

struct CommentEditor: View {
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
