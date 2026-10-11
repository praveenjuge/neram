import Foundation

public struct Organization: Codable, Sendable, Hashable, Identifiable {
  public enum State: String, Codable, Sendable, Hashable {
    case active
    case deleting
  }

  public var id: DocumentID
  public var organizationId: String
  public var slug: String
  public var name: String
  public var state: State

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case organizationId, slug, name, state
  }
}

public struct Member: Codable, Sendable, Hashable, Identifiable {
  public var id: DocumentID
  public var organizationId: String
  public var membershipId: String
  public var userId: String
  public var role: OrganizationRole
  public var displayName: String
  public var email: String?
  public var imageUrl: String?

  enum CodingKeys: String, CodingKey {
    case id = "_id"
    case organizationId, membershipId, userId, role, displayName, email, imageUrl
  }
}

/// Default length for new Sprints: 1, 2, or 4 weeks, or no fixed end.
public enum SprintDuration: Sendable, Hashable, CaseIterable {
  case oneWeek
  case twoWeeks
  case fourWeeks
  case open

  public var label: String {
    switch self {
    case .oneWeek: "1 week"
    case .twoWeeks: "2 weeks"
    case .fourWeeks: "4 weeks"
    case .open: "No fixed end"
    }
  }
}

extension SprintDuration: Codable {
  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let weeks = try? container.decode(Double.self) {
      switch weeks {
      case 1: self = .oneWeek
      case 2: self = .twoWeeks
      case 4: self = .fourWeeks
      default:
        throw DecodingError.dataCorruptedError(
          in: container, debugDescription: "Unknown Sprint duration \(weeks)")
      }
    } else if try container.decode(String.self) == "open" {
      self = .open
    } else {
      throw DecodingError.dataCorruptedError(
        in: container, debugDescription: "Unknown Sprint duration")
    }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .oneWeek: try container.encode(1.0)
    case .twoWeeks: try container.encode(2.0)
    case .fourWeeks: try container.encode(4.0)
    case .open: try container.encode("open")
    }
  }
}

public struct OrganizationSettings: Codable, Sendable, Hashable {
  public var sprintDuration: SprintDuration
}

/// `organizations:current`: the active workspace and the caller's membership.
public struct CurrentOrganization: Codable, Sendable, Hashable {
  public var organization: Organization
  public var membership: Member
  public var settings: OrganizationSettings?

  public var isAdmin: Bool { membership.role == .admin }
}
