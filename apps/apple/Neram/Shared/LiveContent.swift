import NeramKit
import SwiftUI

/// Loading, error, and loaded states for a ``LiveQuery``.
struct LiveContent<Value: Codable & Sendable, Content: View>: View {
  let live: LiveQuery<Value>
  @ViewBuilder let content: (Value) -> Content

  var body: some View {
    if let value = live.value {
      content(value)
    } else if let error = live.error {
      ContentUnavailableView(
        "Couldn't load this", systemImage: "exclamationmark.triangle",
        description: Text(error.localizedDescription))
    } else {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}
