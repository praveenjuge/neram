import NeramKit
import SwiftUI

/// The last row of a paginated list. Requests the next page when it appears,
/// and again if a page finishes loading while it is still on screen.
struct PageFooter<Item: Codable & Sendable & Identifiable>: View {
  let query: PagedQuery<Item>
  @State private var isVisible = false

  var body: some View {
    if query.status == .canLoadMore || query.status == .loadingMore {
      ProgressView()
        .frame(maxWidth: .infinity)
        .onAppear {
          isVisible = true
          query.loadMore()
        }
        .onDisappear { isVisible = false }
        .onChange(of: query.status) { _, status in
          if isVisible, status == .canLoadMore { query.loadMore() }
        }
    }
  }
}
