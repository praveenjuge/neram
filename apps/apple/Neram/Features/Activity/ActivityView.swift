import NeramKit
import SwiftUI

struct ActivityView: View {
  @Environment(AppSession.self) private var session
  @State private var feed = PagedQuery(pageSize: 20) { Queries.activity($0) }

  var body: some View {
    Group {
      if let error = feed.error, feed.items.isEmpty {
        ContentUnavailableView(
          "Couldn't load activity", systemImage: "exclamationmark.triangle",
          description: Text(error.localizedDescription))
      } else if feed.status == .loadingFirstPage {
        ProgressView()
      } else if feed.items.isEmpty {
        ContentUnavailableView(
          "No activity yet", systemImage: "clock",
          description: Text("Changes across the workspace show up here."))
      } else {
        List {
          ForEach(feed.items) { item in
            VStack(alignment: .leading) {
              Text("\(item.actorName) \(item.action)")
              Text(item.createdDate, format: .relative(presentation: .named))
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
          PageFooter(query: feed)
        }
      }
    }
    .navigationTitle("Activity")
    .toolbar { AccountToolbar() }
    .task { await feed.run(on: session.client) }
  }
}
