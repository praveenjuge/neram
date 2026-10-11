import NeramKit
import SwiftUI

/// Tasks across every project, filtered like the web's Tasks page.
struct MyTasksView: View {
  enum Scope: String, CaseIterable, Identifiable {
    case mine = "Assigned to me"
    case unassigned = "Unassigned"
    case all = "All"
    var id: String { rawValue }
  }

  enum DueFilter: String, CaseIterable, Identifiable {
    case overdue = "Overdue"
    case dueSoon = "Due soon"
    case noDueDate = "No due date"
    var id: String { rawValue }
  }

  @Environment(AppSession.self) private var session
  @State private var scope: Scope = .mine
  @State private var due: Set<DueFilter> = []
  @State private var moves = TaskMoves()
  @State private var creating = false

  var body: some View {
    ScopedTasks(assignedToMe: scope == .mine) { tasks in
      let shown = filter(moves.apply(tasks))
      TaskBoard(
        tasks: shown, moves: moves, showsProject: true,
        emptyText: scope == .mine && tasks.isEmpty
          ? "Nothing is assigned to you yet." : "Nothing here yet."
      ) {
        filters(shownCount: shown.count)
      }
      .onChange(of: tasks) { _, value in moves.reconcile(value) }
    }
    .id(scope == .mine)
    .navigationTitle("My Tasks")
    .toolbar {
      AccountToolbar()
      ToolbarItem(placement: .primaryAction) {
        Button("New Task", systemImage: "plus") { creating = true }
          .disabled(!session.isConnected)
      }
    }
    .sheet(isPresented: $creating) { NewTaskView() }
    .incompleteSubtasksDialog(moves, client: session.client)
  }

  private func filters(shownCount: Int) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Picker("Scope", selection: $scope) {
        ForEach(Scope.allCases) { Text($0.rawValue).tag($0) }
      }
      .pickerStyle(.segmented)
      // The count and Clear sit beside the chips when they fit, else below.
      // With large text the chips scroll sideways rather than run off-screen.
      ViewThatFits(in: .horizontal) {
        HStack {
          chips
          Spacer()
          summary(shownCount: shownCount)
        }
        VStack(alignment: .leading, spacing: 8) {
          HStack { chips }
          HStack { summary(shownCount: shownCount) }
        }
        VStack(alignment: .leading, spacing: 8) {
          ScrollView(.horizontal) {
            HStack { chips }
          }
          .scrollIndicators(.hidden)
          HStack { summary(shownCount: shownCount) }
        }
      }
    }
  }

  private var chips: some View {
    ForEach(DueFilter.allCases) { filter in
      Toggle(
        filter.rawValue,
        isOn: Binding(
          get: { due.contains(filter) },
          set: { if $0 { due.insert(filter) } else { due.remove(filter) } })
      )
      .toggleStyle(.button)
      .buttonStyle(.bordered)
      .controlSize(.small)
      .lineLimit(1)
      .fixedSize()
    }
  }

  /// Shown when any filter differs from the default, like the web.
  @ViewBuilder private func summary(shownCount: Int) -> some View {
    if !due.isEmpty || scope != .mine {
      Text("\(shownCount) shown").font(.caption).foregroundStyle(.secondary)
      Button("Clear") {
        due = []
        scope = .mine
      }
      .controlSize(.small)
    }
  }

  /// Due chips combine with OR; Overdue and Due soon skip done tasks.
  private func filter(_ tasks: [TaskItem]) -> [TaskItem] {
    let scoped = scope == .unassigned ? tasks.filter { $0.assigneeSubject == nil } : tasks
    guard !due.isEmpty else { return scoped }
    let today = Calendar.current.startOfDay(for: .now)
    let soon = Calendar.current.date(byAdding: .day, value: 7, to: today)!
    return scoped.filter { task in
      let date = DueDate.date(from: task.dueDate)
      let open = task.status != .done
      return (due.contains(.overdue) && open && date.map { $0 < today } == true)
        || (due.contains(.dueSoon) && open && date.map { $0 >= today && $0 <= soon } == true)
        || (due.contains(.noDueDate) && date == nil)
    }
  }
}

/// `tasks:listAll` for one scope, kept live while shown.
private struct ScopedTasks<Content: View>: View {
  @Environment(AppSession.self) private var session
  @State private var tasks: LiveQuery<[TaskItem]>
  let content: ([TaskItem]) -> Content

  init(assignedToMe: Bool, @ViewBuilder content: @escaping ([TaskItem]) -> Content) {
    _tasks = State(initialValue: LiveQuery(Queries.allTasks(assignedToMe: assignedToMe)))
    self.content = content
  }

  var body: some View {
    LiveContent(live: tasks, content: content)
      .task { await tasks.run(on: session.client) }
  }
}
