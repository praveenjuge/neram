import ConvexMobile
import Foundation

/// The `ConvexError` payload every Neram function throws: `{ code, message }`
/// plus extra fields for the errors clients resolve with a confirm-and-retry.
/// Shapes are pinned by `packages/convex/fixtures/errors.*.json`.
public struct ServerError: Codable, Sendable, Hashable {
  public var code: String
  public var message: String
  /// `EDIT_CONFLICT`: the field that changed and its newest value.
  public var field: String?
  public var latestValue: String?
  /// `INCOMPLETE_SUBTASKS`
  public var unfinishedCount: Double?
  public var totalSubtasks: Double?
  public var completedSubtasks: Double?
  /// `CASCADE_CONFIRMATION_REQUIRED`
  public var subtaskCount: Double?
  public var commentCount: Double?
}

public enum NeramError: Error, LocalizedError, Sendable, Hashable {
  /// A deliberate error from a Neram function, such as validation or permissions.
  case server(ServerError)
  /// There is no active Clerk session to authenticate with.
  case signedOut
  /// Anything else: transport failures, unexpected server errors, bad payloads.
  case unexpected(String)

  public init(_ error: any Error) {
    if let error = error as? NeramError {
      self = error
      return
    }
    if case let .ConvexError(data) = error as? ClientError {
      if let payload = try? JSONDecoder().decode(ServerError.self, from: Data(data.utf8)) {
        self = .server(payload)
      } else {
        self = .unexpected(data)
      }
      return
    }
    self = .unexpected(String(describing: error))
  }

  public var code: String? {
    if case let .server(payload) = self { return payload.code }
    return nil
  }

  public var errorDescription: String? {
    switch self {
    case let .server(payload): payload.message
    case .signedOut: "Sign in to continue."
    case .unexpected: "Something went wrong. Try again."
    }
  }
}
