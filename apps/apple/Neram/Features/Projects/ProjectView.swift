import NeramKit
import SwiftUI

/// A project's board. Phones show one status at a time with drag-to-reorder
/// and swipe moves; wider layouts show the three kanban columns side by side.
struct ProjectView: View {
  let projectId: DocumentID

  @Environment(AppSession.self) private var session
  @Environment(\.horizontalSizeClass) private var sizeClass
  @State private var project: LiveQuery<ProjectSummary?>
  @State private var tasks: LiveQuery<[TaskItem]>
  @State private var moves = TaskMoves()
  @State private var status: TaskStatus = .todo
  @State private var creating = false
  @State private var editing: ProjectSummary?

  init(projectId: DocumentID) {
    self.projectId = projectId
    _project = State(initialValue: LiveQuery(Queries.project(projectId)))
    _tasks = State(initialValue: LiveQuery(Queries.tasks(projectId: projectId)))
  }

  var body: some View {
    LiveContent(live: project) { project in
      if let project {
        LiveContent(live: tasks) { tasks in
          let board = moves.apply(tasks)
          if sizeClass == .compact {
            compactBoard(board)
          } else {
            KanbanBoard(tasks: board, moves: moves)
          }
        }
        .navigationTitle(project.name)
        .toolbar {
          ToolbarItem(placement: .primaryAction) {
            Menu("Project", systemImage: "ellipsis") {
              Button("Edit Project", systemImage: "pencil") { editing = project }
            }
          }
          ToolbarItem(placement: .primaryAction) {
            Button("New Task", systemImage: "plus") { creating = true }
              .disabled(!session.isConnected)
          }
        }
      } else {
        ContentUnavailableView(
          "Project not found", systemImage: "folder.badge.questionmark",
          description: Text("It may have been removed, or the link is incorrect."))
      }
    }
    .sheet(isPresented: $creating) {
      NewTaskView(projectId: projectId)
    }
    .sheet(item: $editing) { project in
      ProjectEditor(mode: .edit(project))
    }
    .incompleteSubtasksDialog(moves, client: session.client)
    .onChange(of: tasks.value) { _, value in moves.reconcile(value ?? []) }
    .task { await project.run(on: session.client) }
    .task { await tasks.run(on: session.client) }
  }

  private func compactBoard(_ board: [TaskItem]) -> some View {
    let column = TaskOrdering.column(board, status: status)
    return List {
      Picker("Status", selection: $status) {
        ForEach(TaskStatus.allCases) { option in
          Text("\(option.label) \(board.filter { $0.status == option }.count)").tag(option)
        }
      }
      .pickerStyle(.segmented)
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())

      if column.isEmpty {
        Text("Nothing here yet.").foregroundStyle(.secondary)
      }
      ForEach(column) { task in
        NavigationLink(value: AppRoute.task(task.id)) {
          TaskRow(task: task)
        }
        .swipeActions(edge: .leading) {
          ForEach(TaskStatus.allCases.filter { $0 != task.status }) { target in
            Button(target.label, systemImage: target.symbol) {
              Task { await moves.move(task, to: target, on: session.client) }
            }
            .tint(target == .done ? .accentColor : .gray)
          }
        }
        .contextMenu { moveMenu(for: task) }
      }
      .onMove { from, to in
        guard let index = from.first else { return }
        let task = column[index]
        let position = TaskOrdering.position(in: column, insertingAt: to, moving: task.id)
        Task { await moves.move(task, to: task.status, position: position, on: session.client) }
      }
    }
  }

  @ViewBuilder private func moveMenu(for task: TaskItem) -> some View {
    Menu("Move To", systemImage: "arrow.right.circle") {
      ForEach(TaskStatus.allCases.filter { $0 != task.status }) { target in
        Button(target.label, systemImage: target.symbol) {
          Task { await moves.move(task, to: target, on: session.client) }
        }
      }
    }
  }
}

/// Three columns with drag and drop, for iPad and Mac.
private struct KanbanBoard: View {
  let tasks: [TaskItem]
  let moves: TaskMoves

  @Environment(AppSession.self) private var session

  var body: some View {
    ScrollView([.horizontal, .vertical]) {
      HStack(alignment: .top, spacing: 16) {
        ForEach(TaskStatus.allCases) { status in
          column(status)
        }
      }
      .padding()
    }
  }

  private func column(_ status: TaskStatus) -> some View {
    let column = TaskOrdering.column(tasks, status: status)
    return VStack(alignment: .leading, spacing: 8) {
      Text("\(status.label) · \(column.count)")
        .font(.headline)
      if column.isEmpty {
        Text("Nothing here yet.").foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, minHeight: 60)
      }
      ForEach(Array(column.enumerated()), id: \.element.id) { index, task in
        NavigationLink(value: AppRoute.task(task.id)) {
          TaskRow(task: task)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: .rect(cornerRadius: 12))
        }
        .buttonStyle(.plain)
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
    let position = TaskOrdering.position(in: column, insertingAt: index, moving: id)
    Task { await moves.move(task, to: status, position: position, on: session.client) }
    return true
  }
}
