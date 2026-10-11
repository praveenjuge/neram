import NeramKit
import SwiftUI

/// Initials in a muted circle, like the web's UserAvatar.
struct UserAvatar: View {
  let name: String
  var size: CGFloat = 22

  var body: some View {
    Text(initials(name))
      .font(.system(size: size * 0.42, weight: .semibold))
      .foregroundStyle(.secondary)
      .frame(width: size, height: size)
      .background(.quaternary, in: .circle)
      .accessibilityHidden(true)
  }
}

/// Every workspace member, loaded in full for pickers and mentions.
@MainActor
@Observable
final class Members {
  let query = PagedQuery(pageSize: 100, loadsAllPages: true) { Queries.members($0) }

  var all: [Member] { query.items }

  func run(on client: NeramClient) async {
    await query.run(on: client)
  }
}
