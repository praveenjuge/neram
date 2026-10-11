import NeramKit
import SwiftUI

/// The optional Sprint: one shared focus list across projects.
struct FocusView: View {
  @Environment(AppSession.self) private var session
  @State private var current = LiveQuery(Queries.currentSprint)
  @State private var workspace = LiveQuery(Queries.currentOrganization)
  @State private var moves = TaskMoves()
  @State private var action = Action()
  @State private var sheet: Sheet?
  @State private var confirmingEnd = false

  enum Sheet: String, Identifiable {
    case start, backlog, history, duration, goal, newTask
    var id: String { rawValue }
  }

  private var defaultDuration: SprintDuration {
    workspace.value?.settings?.sprintDuration ?? .twoWeeks
  }

  var body: some View {
    LiveContent(live: current) { current in
      if let current {
        activeSprint(current)
      } else {
        ContentUnavailableView {
          Label("Choose what matters now", systemImage: "scope")
        } description: {
          Text(
            "Start an optional Sprint with an empty focus list. Your projects and Backlog keep working even when no Sprint is active."
          )
        } actions: {
          Button("Start a Sprint") { sheet = .start }
            .buttonStyle(.borderedProminent)
            .disabled(!session.isConnected)
        }
      }
    }
    .navigationTitle("Focus")
    .toolbar {
      AccountToolbar()
      ToolbarItem(placement: .primaryAction) {
        Menu("Sprint", systemImage: "ellipsis") {
          Button("History", systemImage: "clock.arrow.circlepath") { sheet = .history }
          Button("Default Duration", systemImage: "calendar") { sheet = .duration }
        }
      }
    }
    .sheet(item: $sheet) { sheet in
      switch sheet {
      case .start: StartSprintView(defaultDuration: defaultDuration)
      case .backlog: BacklogPickerView()
      case .history: SprintHistoryView(current: current.value ?? nil)
      case .duration: SprintDurationView(current: defaultDuration)
      case .goal: SprintGoalView(goal: current.value??.sprint.goal ?? "")
      case .newTask: NewTaskView()
      }
    }
    .incompleteSubtasksDialog(moves, client: session.client)
    .actionAlert(action)
    .onChange(of: current.value) { _, value in moves.reconcile(value??.tasks ?? []) }
    .task { await current.run(on: session.client) }
    .task { await workspace.run(on: session.client) }
  }

  private func activeSprint(_ current: CurrentSprint) -> some View {
    let open = moves.apply(current.tasks).filter { $0.status != .done }
    let done = current.tasks.count - current.tasks.filter { $0.status != .done }.count
    return TaskBoard(
      tasks: open, moves: moves, statuses: [.todo, .inProgress], showsProject: true,
      rowActions: { task in
        AnyView(
          Button("Return to Backlog", systemImage: "arrow.uturn.backward") {
            Task {
              await action.run { () async throws(NeramError) in
                try await session.client.run(Calls.returnToBacklog([task.id]))
              }
            }
          })
      },
      emptyText: emptyText(current, open: open)
    ) {
      VStack(alignment: .leading, spacing: 10) {
        Text("\(current.sprint.dateRange) · \(current.sprint.remaining())")
          .font(.subheadline)
          .foregroundStyle(.secondary)
        Button {
          sheet = .goal
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Text("Goal").font(.caption).foregroundStyle(.secondary)
            Text(current.sprint.goal ?? "Not set yet")
              .foregroundStyle(current.sprint.goal == nil ? .secondary : .primary)
          }
        }
        .buttonStyle(.plain)
        ProgressView(value: Double(done), total: Double(max(current.tasks.count, 1))) {
          Text("\(done) of \(current.tasks.count) completed").font(.caption)
        }
        HStack {
          Button("Add Task", systemImage: "plus") { sheet = .newTask }
          Button("Add from Backlog", systemImage: "text.badge.plus") { sheet = .backlog }
          Spacer()
          Button("End Sprint", systemImage: "stop.fill", role: .destructive) {
            confirmingEnd = true
          }
          // Attached to the button so the popover points at it.
          .confirmationDialog(
            "End this Sprint?", isPresented: $confirmingEnd, titleVisibility: .visible
          ) {
            Button("End Sprint", role: .destructive) {
              Task {
                await action.run { () async throws(NeramError) in
                  _ = try await session.client.run(Calls.endSprint)
                }
              }
            }
          } message: {
            Text(
              "The Sprint will be saved to History. \(open.count) unfinished task\(open.count == 1 ? "" : "s") will return to Backlog, and the next Sprint will start empty."
            )
          }
        }
        .labelStyle(.titleOnly)
        .lineLimit(1)
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(!session.isConnected)
      }
    }
  }

  /// What an empty column says; matches the web when nothing is left open.
  private func emptyText(_ current: CurrentSprint, open: [TaskItem]) -> String {
    guard open.isEmpty else { return "Nothing here yet." }
    return current.tasks.isEmpty
      ? "Choose a few Backlog tasks to focus on." : "Everything in this Sprint is complete."
  }
}
