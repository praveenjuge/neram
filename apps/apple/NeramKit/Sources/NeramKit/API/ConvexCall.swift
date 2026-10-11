import ConvexMobile
import Foundation

/// A Convex argument value. Numbers are always `Double`: ConvexMobile encodes
/// Swift integers as Convex int64, which `v.number()` validators reject.
public enum Arg: Sendable, Hashable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case null
  case array([Arg])
  case object([String: Arg])

  var encodable: ConvexEncodable? {
    switch self {
    case let .string(value): value
    case let .number(value): value
    case let .bool(value): value
    case .null: nil
    case let .array(values): values.map(\.encodable)
    case let .object(fields): fields.mapValues(\.encodable)
    }
  }

  /// Stable JSON text, used as a cache key.
  var canonical: String {
    switch self {
    case let .string(value):
      String(decoding: (try? JSONEncoder().encode(value)) ?? Data(), as: UTF8.self)
    case let .number(value): String(value)
    case let .bool(value): String(value)
    case .null: "null"
    case let .array(values): "[" + values.map(\.canonical).joined(separator: ",") + "]"
    case let .object(fields):
      "{"
        + fields.keys.sorted().map { "\(Arg.string($0).canonical):\(fields[$0]!.canonical)" }
        .joined(separator: ",") + "}"
    }
  }
}

extension Arg: ExpressibleByStringLiteral, ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral {
  public init(stringLiteral value: String) { self = .string(value) }
  public init(floatLiteral value: Double) { self = .number(value) }
  public init(booleanLiteral value: Bool) { self = .bool(value) }
}

typealias Args = [String: Arg]

extension [String: Arg] {
  var encodable: [String: ConvexEncodable?] { mapValues(\.encodable) }
}

/// Decodes a Convex `null` result, for functions that return nothing.
public struct NoResult: Codable, Sendable, Hashable {
  public init() {}
  public init(from decoder: Decoder) throws {
    _ = try decoder.singleValueContainer().decodeNil()
  }
  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encodeNil()
  }
}

/// A typed reference to a Convex query and its arguments.
public struct Query<Value: Codable & Sendable>: Sendable, Hashable {
  public let name: String
  let args: Args

  init(_ name: String, _ args: Args = [:]) {
    self.name = name
    self.args = args
  }

  /// Identifies this exact query and arguments, e.g. for the offline cache.
  public var key: String { name + Arg.object(args).canonical }
}

/// A typed reference to a Convex mutation or action and its arguments.
public struct Call<Value: Codable & Sendable>: Sendable, Hashable {
  public enum Kind: Sendable, Hashable {
    case mutation
    case action
  }

  public let name: String
  let kind: Kind
  let args: Args

  init(mutation name: String, _ args: Args = [:]) {
    self.name = name
    self.kind = .mutation
    self.args = args
  }

  init(action name: String, _ args: Args = [:]) {
    self.name = name
    self.kind = .action
    self.args = args
  }
}

/// `paginationOpts` for Convex paginated queries.
public struct PageRequest: Sendable, Hashable {
  public var numItems: Int
  public var cursor: String?
  public var endCursor: String?

  public init(numItems: Int, cursor: String? = nil, endCursor: String? = nil) {
    self.numItems = numItems
    self.cursor = cursor
    self.endCursor = endCursor
  }

  var arg: Arg {
    var fields: [String: Arg] = [
      "numItems": .number(Double(numItems)),
      "cursor": cursor.map(Arg.string) ?? .null,
    ]
    if let endCursor { fields["endCursor"] = .string(endCursor) }
    return .object(fields)
  }
}

extension Optional where Wrapped == String {
  var arg: Arg? { map(Arg.string) }
}
