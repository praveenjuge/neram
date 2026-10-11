import Foundation
import Observation

/// A live, growing list over a Convex paginated query, like convex-js
/// `usePaginatedQuery`.
///
/// Each page is its own subscription. When a later page is requested, the
/// page before it is re-subscribed with `endCursor` pinned to where it ended,
/// so inserts and deletes never shift items between pages (no duplicates or
/// gaps). A page the server asks to split is replaced by two pinned halves.
/// If a later page fails (for example a cursor became invalid), the list
/// restarts from the first page.
@MainActor
@Observable
public final class PagedQuery<Item: Codable & Sendable & Identifiable> {
  public enum Status: Sendable, Equatable {
    case loadingFirstPage
    case loadingMore
    case canLoadMore
    case exhausted
  }

  public private(set) var items: [Item] = []
  public private(set) var status: Status = .loadingFirstPage
  public private(set) var error: NeramError?

  private struct Slot {
    let id: Int
    var request: PageRequest
    var result: Page<Item>?
    var task: Task<Void, Never>?
  }

  @ObservationIgnored private let makeQuery: (PageRequest) -> Query<Page<Item>>
  @ObservationIgnored private let pageSize: Int
  @ObservationIgnored private let loadsAllPages: Bool
  @ObservationIgnored private var slots: [Slot] = []
  @ObservationIgnored private var nextSlotId = 0
  @ObservationIgnored private weak var client: NeramClient?

  /// - Parameter loadsAllPages: Keep requesting pages until the list is
  ///   exhausted, for small sets every screen needs whole (like members).
  public init(
    pageSize: Int = 20, loadsAllPages: Bool = false,
    _ makeQuery: @escaping (PageRequest) -> Query<Page<Item>>
  ) {
    self.pageSize = pageSize
    self.loadsAllPages = loadsAllPages
    self.makeQuery = makeQuery
  }

  /// Keeps the list live until the calling task is cancelled. Call from a
  /// view's `.task`.
  public func run(on client: NeramClient) async {
    self.client = client
    restart()
    defer { stopAll() }
    while !Task.isCancelled {
      try? await Task.sleep(for: .seconds(86_400))
    }
  }

  /// Requests the next page once the current last page has loaded.
  public func loadMore() {
    guard status == .canLoadMore, let last = slots.last, let result = last.result else { return }
    // Pin the current last page so the new page starts exactly where it ends.
    if last.request.endCursor == nil {
      replace(
        slotAt: slots.count - 1,
        with: [
          PageRequest(
            numItems: pageSize, cursor: last.request.cursor, endCursor: result.continueCursor)
        ], keeping: result)
    }
    append(PageRequest(numItems: pageSize, cursor: result.continueCursor))
    publish()
  }

  /// Starts over from the first page, for example after a failed load.
  public func retry() {
    restart()
  }

  // MARK: - Slots
  //
  // Slot changes don't publish; each entry point publishes once when its
  // slots are consistent. Publishing midway could start another `loadMore`
  // from the same cursor while the last page is being pinned.

  private func restart() {
    stopAll()
    slots = []
    error = nil
    append(PageRequest(numItems: pageSize))
    publish()
  }

  private func append(_ request: PageRequest) {
    slots.append(makeSlot(request))
    subscribe(slotAt: slots.count - 1)
  }

  /// Swaps one slot for new ones. `keeping` shows the old result until the
  /// first replacement delivers, so the list never flickers empty.
  private func replace(slotAt index: Int, with requests: [PageRequest], keeping result: Page<Item>?)
  {
    slots[index].task?.cancel()
    var replacements = requests.map(makeSlot)
    if requests.count == 1 { replacements[0].result = result }
    slots.replaceSubrange(index...index, with: replacements)
    for offset in replacements.indices { subscribe(slotAt: index + offset) }
  }

  private func makeSlot(_ request: PageRequest) -> Slot {
    defer { nextSlotId += 1 }
    return Slot(id: nextSlotId, request: request)
  }

  private func subscribe(slotAt index: Int) {
    guard let client else { return }
    let slot = slots[index]
    let query = makeQuery(slot.request)
    // Only the unpinned first page is cached: it's what a fresh launch shows.
    let cached = slot.request.cursor == nil && slot.request.endCursor == nil
    slots[index].task = Task { [weak self] in
      do {
        try await client.observe(query, cached: cached) { page in
          self?.receive(page, slotId: slot.id)
        }
      } catch {
        self?.fail(NeramError(error), slotId: slot.id)
      }
    }
  }

  private func receive(_ page: Page<Item>, slotId: Int) {
    guard let index = slots.firstIndex(where: { $0.id == slotId }) else { return }
    let request = slots[index].request
    if let split = page.splitCursor, page.pageStatus != nil {
      let end = request.endCursor ?? page.continueCursor
      replace(
        slotAt: index,
        with: [
          PageRequest(numItems: pageSize, cursor: request.cursor, endCursor: split),
          PageRequest(numItems: pageSize, cursor: split, endCursor: end),
        ], keeping: nil)
      publish()
      return
    }
    slots[index].result = page
    error = nil
    publish()
  }

  private func fail(_ failure: NeramError, slotId: Int) {
    guard let index = slots.firstIndex(where: { $0.id == slotId }) else { return }
    if index == 0 {
      error = failure
      publish()
    } else {
      restart()
    }
  }

  private func stopAll() {
    for slot in slots { slot.task?.cancel() }
  }

  private func publish() {
    items = slots.flatMap { $0.result?.page ?? [] }
    if slots.first?.result == nil {
      status = .loadingFirstPage
    } else if slots.contains(where: { $0.result == nil }) {
      status = .loadingMore
    } else {
      status = slots.last?.result?.isDone == true ? .exhausted : .canLoadMore
    }
    if loadsAllPages, status == .canLoadMore { loadMore() }
  }
}
