import NeramKit
import SwiftUI

private let goalLimit = 500

struct StartSprintView: View {
  let defaultDuration: SprintDuration

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var goal = ""
  @State private var duration: SprintDuration?
  @State private var action = Action()

  var body: some View {
    NavigationStack {
      Form {
        Section("Goal (optional)") {
          TextField("What outcome matters most?", text: $goal, axis: .vertical)
            .onChange(of: goal) { _, value in
              if value.utf16.count > goalLimit { goal = value.prefix(utf16Limit: goalLimit) }
            }
        }
        Section {
          DurationPicker(
            selection: Binding(get: { duration ?? defaultDuration }, set: { duration = $0 }))
        }
      }
      .formStyle(.grouped)
      .navigationTitle("Start a Sprint")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Start") { Task { await start() } }
            .disabled(action.isRunning || !session.isConnected)
        }
      }
      .actionAlert(action)
    }
  }

  private func start() async {
    let trimmed = goal.trimmingCharacters(in: .whitespacesAndNewlines)
    let chosen = duration ?? defaultDuration
    let finished = await action.run { () async throws(NeramError) in
      _ = try await session.client.run(
        Calls.startSprint(goal: trimmed.isEmpty ? nil : trimmed, duration: chosen))
    }
    if finished { dismiss() }
  }
}

struct SprintGoalView: View {
  let goal: String

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var draft: String?
  @State private var action = Action()

  var body: some View {
    NavigationStack {
      Form {
        TextField(
          "What outcome matters most?",
          text: Binding(get: { draft ?? goal }, set: { draft = $0.prefix(utf16Limit: goalLimit) }),
          axis: .vertical)
      }
      .formStyle(.grouped)
      .navigationTitle("Sprint Goal")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { Task { await save() } }
            .disabled(action.isRunning || !session.isConnected)
        }
      }
      .actionAlert(action)
    }
  }

  private func save() async {
    let value = (draft ?? goal).trimmingCharacters(in: .whitespacesAndNewlines)
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.updateSprintGoal(value.isEmpty ? nil : value))
    }
    if finished { dismiss() }
  }
}

struct SprintDurationView: View {
  let current: SprintDuration

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var selection: SprintDuration?
  @State private var action = Action()

  var body: some View {
    NavigationStack {
      Form {
        Section {
          DurationPicker(selection: Binding(get: { selection ?? current }, set: { selection = $0 }))
        } footer: {
          Text("Applied when the next Sprint starts. The active Sprint does not change.")
        }
      }
      .formStyle(.grouped)
      .navigationTitle("Default Duration")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { Task { await save() } }
            .disabled(action.isRunning || !session.isConnected)
        }
      }
      .actionAlert(action)
    }
  }

  private func save() async {
    let chosen = selection ?? current
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.updateSprintDuration(chosen))
    }
    if finished { dismiss() }
  }
}

private struct DurationPicker: View {
  @Binding var selection: SprintDuration

  var body: some View {
    Picker("Duration", selection: $selection) {
      Text("1 week").tag(SprintDuration.oneWeek)
      Text("2 weeks").tag(SprintDuration.twoWeeks)
      Text("4 weeks").tag(SprintDuration.fourWeeks)
      Text("No fixed end date").tag(SprintDuration.open)
    }
  }
}

/// "Add focused work": pick Backlog tasks, grouped by project.
struct BacklogPickerView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var backlog = LiveQuery(Queries.backlog)
  @State private var search = ""
  @State private var selected: Set<DocumentID> = []
  @State private var action = Action()

  var body: some View {
    NavigationStack {
      LiveContent(live: backlog) { tasks in
        let groups = grouped(tasks)
        List {
          if groups.isEmpty {
            Text(tasks.isEmpty ? "Backlog is empty." : "No matching Backlog tasks.")
              .foregroundStyle(.secondary)
          }
          ForEach(groups, id: \.name) { group in
            Section(group.name) {
              ForEach(group.tasks) { task in
                Button {
                  if selected.contains(task.id) {
                    selected.remove(task.id)
                  } else {
                    selected.insert(task.id)
                  }
                } label: {
                  let isSelected = selected.contains(task.id)
                  Label {
                    Text(task.title)
                  } icon: {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                      .foregroundStyle(
                        isSelected ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                  }
                }
                .foregroundStyle(.primary)
              }
            }
          }
        }
      }
      .searchable(text: $search)
      .navigationTitle("Add Focused Work")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add \(selected.count) Task\(selected.count == 1 ? "" : "s")") {
            Task { await add() }
          }
          .disabled(selected.isEmpty || action.isRunning || !session.isConnected)
        }
      }
      .actionAlert(action)
      .task { await backlog.run(on: session.client) }
      // Drop picks that left the Backlog (planned, completed, or deleted
      // elsewhere); search only hides rows, so it keeps them.
      .onChange(of: backlog.value) { _, tasks in
        guard let tasks else { return }
        selected.formIntersection(tasks.map(\.id))
      }
    }
  }

  private func grouped(_ tasks: [TaskItem]) -> [(name: String, tasks: [TaskItem])] {
    let query = search.trimmingCharacters(in: .whitespaces).lowercased()
    let matches = tasks.filter {
      query.isEmpty || "\($0.title) \($0.projectName ?? "")".lowercased().contains(query)
    }
    return Dictionary(grouping: matches) { $0.projectName ?? "" }
      .map { (name: $0.key, tasks: $0.value.sorted { $0.position < $1.position }) }
      .sorted { $0.name < $1.name }
  }

  private func add() async {
    let ids = Array(selected)
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.planSprint(ids))
    }
    if finished { dismiss() }
  }
}

/// Completed work in the current Sprint, then closed Sprints.
struct SprintHistoryView: View {
  let current: CurrentSprint?

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var history = PagedQuery(pageSize: 10) { Queries.sprintHistory($0) }

  var body: some View {
    NavigationStack {
      List {
        let completed = current?.tasks.filter { $0.status == .done } ?? []
        if !completed.isEmpty {
          Section("Completed this Sprint") {
            ForEach(completed) { TaskRow(task: $0, showsProject: true) }
          }
        }
        Section("Closed Sprints") {
          if history.status == .exhausted, history.items.isEmpty, completed.isEmpty {
            Text("No completed work or closed Sprints yet.").foregroundStyle(.secondary)
          }
          ForEach(history.items) { sprint in
            let total = Int(sprint.baselineCount ?? 0)
            let doneCount = Int(sprint.completedCount ?? 0)
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text(sprint.dateRange)
                Spacer()
                Text("\(doneCount) of \(total)").font(.caption).foregroundStyle(.secondary)
              }
              if let goal = sprint.goal { Text(goal).font(.subheadline) }
              Text(
                doneCount >= total
                  ? "All committed work completed" : "\(total - doneCount) unfinished"
              )
              .font(.caption)
              .foregroundStyle(.secondary)
            }
          }
          PageFooter(query: history)
        }
      }
      .navigationTitle("Sprint History")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
      }
      .task { await history.run(on: session.client) }
    }
  }
}
