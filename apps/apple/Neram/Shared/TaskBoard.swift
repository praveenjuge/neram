import NeramKit
import SwiftUI

/// A task board. Phones show one status at a time with drag-to-reorder and
/// swipe moves; wider layouts show kanban columns with drag and drop.
/// Positions are per project, so boards that mix projects (My Tasks, Focus)
/// order each task among its own project's tasks, as on the web.
struct TaskBoard<Header: View>: View {
  let tasks: [TaskItem]
  let moves: TaskMoves
  var statuses: [TaskStatus] = TaskStatus.allCases
  var showsProject = false
  var rowActions: (TaskItem) -> AnyView = { _ in AnyView(EmptyView()) }
  /// Shown in an empty column.
  var emptyText = "Nothing here yet."
  @ViewBuilder var header: () -> Header

  @Environment(AppSession.self) private var session
  @Environment(\.horizontalSizeClass) private var sizeClass
  @State private var selected: TaskStatus?

  var body: some View {
    if sizeClass == .compact {
      compact
    } else {
      kanban
    }
  }

  // MARK: Phone

  private var status: TaskStatus { selected ?? statuses.first ?? .todo }

  private var compact: some View {
    let column = TaskOrdering.column(tasks, status: status)
    return List {
      Section {
        if column.isEmpty {
          Text(emptyText).foregroundStyle(.secondary)
        }
        rows(column)
      } header: {
        // A section header, not a row, so the section's rounded corners
        // don't clip it and it draws no separators.
        VStack(alignment: .leading, spacing: 12) {
          header()
          Picker(
            "Status", selection: Binding(get: { status }, set: { selected = $0 })
          ) {
            ForEach(statuses) { option in
              Text("\(option.label) \(tasks.filter { $0.status == option }.count)").tag(option)
            }
          }
          .pickerStyle(.segmented)
        }
        .font(.body)
        .textCase(nil)
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 8, trailing: 0))
      }
      .headerProminence(.increased)
    }
  }

  private func rows(_ column: [TaskItem]) -> some View {
    ForEach(column) { task in
      NavigationLink(value: AppRoute.task(task.id)) {
        TaskRow(task: task, showsProject: showsProject)
      }
      .swipeActions(edge: .leading) {
        ForEach(statuses.filter { $0 != task.status }) { target in
          Button(target.label, systemImage: target.symbol) { move(task, to: target) }
            .tint(target == .done ? .accentColor : .gray)
        }
      }
      .contextMenu {
        Menu("Move To", systemImage: "arrow.right.circle") {
          ForEach(statuses.filter { $0 != task.status }) { target in
            Button(target.label, systemImage: target.symbol) { move(task, to: target) }
          }
        }
        rowActions(task)
      }
    }
    .onMove { from, to in
      guard let index = from.first else { return }
      let task = column[index]
      let position = TaskOrdering.position(inMixed: column, insertingAt: to, moving: task)
      move(task, to: task.status, position: position)
    }
  }

  // MARK: iPad and Mac

  private var kanban: some View {
    ScrollView([.horizontal, .vertical]) {
      VStack(alignment: .leading, spacing: 16) {
        header()
        HStack(alignment: .top, spacing: 16) {
          ForEach(statuses) { status in
            kanbanColumn(status)
          }
        }
      }
      .padding()
    }
  }

  private func kanbanColumn(_ status: TaskStatus) -> some View {
    let column = TaskOrdering.column(tasks, status: status)
    return VStack(alignment: .leading, spacing: 8) {
      Text("\(status.label) · \(column.count)")
        .font(.headline)
      if column.isEmpty {
        Text(emptyText).foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, minHeight: 60)
      }
      ForEach(Array(column.enumerated()), id: \.element.id) { index, task in
        NavigationLink(value: AppRoute.task(task.id)) {
          TaskRow(task: task, showsProject: showsProject)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: .rect(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .contextMenu { rowActions(task) }
        .draggable(task.id)
        .dropDestination(for: String.self) { ids, _ in
          drop(ids, into: column, status: status, at: index)
        }
      }
      Color.clear
        .frame(maxWidth: .infinity, minHeight: 80)
        .contentShape(.rect)
        .dropDestination(for: String.self) { ids, _ in
          drop(ids, into: column, status: status, at: column.count)
        }
    }
    .frame(width: 300)
    .padding(12)
    .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 16))
  }

  private func drop(_ ids: [String], into column: [TaskItem], status: TaskStatus, at index: Int)
    -> Bool
  {
    guard let id = ids.first, let task = tasks.first(where: { $0.id == id }) else { return false }
    let position = TaskOrdering.position(inMixed: column, insertingAt: index, moving: task)
    move(task, to: status, position: position)
    return true
  }

  private func move(_ task: TaskItem, to status: TaskStatus, position: Double? = nil) {
    Task { await moves.move(task, to: status, position: position, on: session.client) }
  }
}

extension TaskBoard where Header == EmptyView {
  init(
    tasks: [TaskItem], moves: TaskMoves, statuses: [TaskStatus] = TaskStatus.allCases,
    showsProject: Bool = false,
    rowActions: @escaping (TaskItem) -> AnyView = { _ in AnyView(EmptyView()) }
  ) {
    self.init(
      tasks: tasks, moves: moves, statuses: statuses, showsProject: showsProject,
      rowActions: rowActions, header: { EmptyView() })
  }
}
