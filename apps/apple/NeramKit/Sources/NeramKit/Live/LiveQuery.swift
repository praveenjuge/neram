import Observation

/// One live Convex query for a view. Call ``run(on:)`` from `.task`; the value
/// stays current until the view goes away.
@MainActor
@Observable
public final class LiveQuery<Value: Codable & Sendable> {
  public private(set) var value: Value?
  public private(set) var error: NeramError?

  @ObservationIgnored public let query: Query<Value>

  public init(_ query: Query<Value>) {
    self.query = query
  }

  public func run(on client: NeramClient) async {
    error = nil
    do {
      try await client.observe(query) { self.value = $0 }
    } catch {
      self.error = error
    }
  }
}
