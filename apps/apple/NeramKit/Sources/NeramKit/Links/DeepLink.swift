import Foundation

/// A Universal Link into the app. These are the web's own workspace URLs, so
/// one link works in the browser and in the app:
///
/// - `/w`: the workspace picker
/// - `/w/{slug}/dashboard`
/// - `/w/{slug}/projects/{id}?task={taskId}&comment={commentId}`
/// - `/w/{slug}/tasks?task={taskId}`
/// - `/w/{slug}/sprints`, `/w/{slug}/activity`, `/w/{slug}/archived`
public struct DeepLink: Hashable, Sendable {
  public enum Destination: Hashable, Sendable {
    case dashboard
    case project(DocumentID, task: DocumentID?, comment: DocumentID?)
    case tasks(task: DocumentID?)
    case sprints
    case activity
    case archived
  }

  /// The workspace (Clerk organization) slug; `nil` for the workspace picker.
  public var slug: String?
  public var destination: Destination

  public static let host = "neram.praveenjuge.com"

  /// Parses `url`, or returns `nil` when it isn't a workspace link on
  /// ``host``. Unknown pages inside a workspace open its dashboard, like the
  /// web's fallback.
  public init?(url: URL) {
    guard url.scheme == "https", url.host()?.lowercased() == Self.host,
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else { return nil }
    let parts = components.path.split(separator: "/").map(String.init)
    guard parts.first == "w" else { return nil }
    guard parts.count > 1 else {
      self.init(slug: nil, destination: .dashboard)
      return
    }
    let slug = parts[1]
    guard Self.isValidSlug(slug) else { return nil }
    let query = Dictionary(
      (components.queryItems ?? []).compactMap { item in
        item.value.flatMap(Self.documentID).map { (item.name, $0) }
      },
      uniquingKeysWith: { first, _ in first })

    let destination: Destination
    switch parts.dropFirst(2).first {
    case "projects":
      guard parts.count > 3, let projectId = Self.documentID(parts[3]) else {
        destination = .dashboard
        break
      }
      let task = query["task"]
      destination = .project(projectId, task: task, comment: task == nil ? nil : query["comment"])
    case "tasks": destination = .tasks(task: query["task"])
    case "sprints": destination = .sprints
    case "activity": destination = .activity
    case "archived": destination = .archived
    default: destination = .dashboard
    }
    self.init(slug: slug, destination: destination)
  }

  public init(slug: String?, destination: Destination) {
    self.slug = slug
    self.destination = destination
  }

  /// Same rule as the web's `workspaceHref`.
  static func isValidSlug(_ slug: String) -> Bool {
    slug.wholeMatch(of: /[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?/) != nil
  }

  /// Convex document IDs are lowercase base32-style strings; anything else
  /// is ignored rather than sent to the server.
  static func documentID(_ value: String) -> DocumentID? {
    value.wholeMatch(of: /[a-z0-9]{16,64}/) != nil ? value : nil
  }
}
