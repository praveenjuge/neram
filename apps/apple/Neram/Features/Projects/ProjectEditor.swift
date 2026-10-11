import NeramKit
import SwiftUI

/// Create or edit a project: name, color, and icon. Mirrors the web's
/// NewProjectDialog / EditProjectDialog.
struct ProjectEditor: View {
  enum Mode {
    case create
    case edit(ProjectSummary)
  }

  let mode: Mode
  var onCreated: (DocumentID) -> Void = { _ in }

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var icon = ProjectStyle.defaultIcon
  @State private var color = ProjectStyle.defaultColor
  @State private var iconSearch = ""
  @State private var confirmingArchive = false
  @State private var action = Action()

  static let nameLimit = 80

  var body: some View {
    NavigationStack {
      Form {
        Section {
          preview
        }
        Section("Name") {
          TextField("Project name", text: $name)
            .onChange(of: name) { _, value in
              if value.utf16.count > Self.nameLimit {
                name = value.prefix(utf16Limit: Self.nameLimit)
              }
            }
        }
        Section("Color") {
          colorGrid
        }
        Section("Icon") {
          TextField("Search icons", text: $iconSearch)
          iconGrid
        }
        if case .edit(let project) = mode, project.role == .admin {
          Section {
            Button("Archive Project", role: .destructive) { confirmingArchive = true }
          } footer: {
            Text(
              "This hides the project from your dashboard and sidebar. You can unarchive or permanently delete it later from Archived."
            )
          }
        }
      }
      .formStyle(.grouped)
      .navigationTitle(title)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(saveLabel) { Task { await save() } }
            .disabled(trimmedName.isEmpty || action.isRunning || !session.isConnected)
        }
      }
      .confirmationDialog(
        "Archive \(trimmedName)?", isPresented: $confirmingArchive, titleVisibility: .visible
      ) {
        Button("Archive", role: .destructive) { Task { await archive() } }
      } message: {
        Text("You can unarchive or permanently delete it later from Archived.")
      }
      .actionAlert(action)
    }
    .onAppear(perform: load)
  }

  private var preview: some View {
    HStack(spacing: 12) {
      ProjectBadge(icon: icon, color: color, size: 44)
      VStack(alignment: .leading) {
        Text(trimmedName.isEmpty ? "Untitled project" : trimmedName)
          .font(.headline)
        Text("\(ProjectStyle.color(color).label) · \(ProjectStyle.icon(icon).label)")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      Spacer()
      if case .create = mode {
        Button("Shuffle", systemImage: "shuffle", action: shuffle)
          .labelStyle(.iconOnly)
          .buttonStyle(.borderless)
      }
    }
  }

  private var colorGrid: some View {
    LazyVGrid(columns: [GridItem(.adaptive(minimum: 36))], spacing: 12) {
      ForEach(ProjectStyle.colors) { option in
        Button {
          color = option.key
        } label: {
          Circle()
            .fill(Color(option))
            .frame(width: 30, height: 30)
            .overlay {
              if option.key == color {
                Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(.white)
              }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(option.key == color ? .isSelected : [])
      }
    }
    .padding(.vertical, 4)
  }

  private var iconGrid: some View {
    let query = iconSearch.trimmingCharacters(in: .whitespaces).lowercased()
    let matches =
      query.isEmpty ? ProjectStyle.icons : ProjectStyle.icons.filter { $0.label.contains(query) }
    return Group {
      if matches.isEmpty {
        Text("No icons match \"\(iconSearch)\"").foregroundStyle(.secondary)
      } else {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 40))], spacing: 8) {
          ForEach(matches) { option in
            Button {
              icon = option.key
            } label: {
              Image(systemName: option.symbol)
                .frame(width: 36, height: 36)
                .foregroundStyle(option.key == icon ? Color(ProjectStyle.color(color)) : .primary)
                .background(
                  option.key == icon ? Color(ProjectStyle.color(color)).opacity(0.15) : .clear,
                  in: .rect(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(option.label)
            .accessibilityAddTraits(option.key == icon ? .isSelected : [])
          }
        }
        .padding(.vertical, 4)
      }
    }
  }

  private var title: String {
    if case .edit = mode { return "Edit Project" }
    return "New Project"
  }

  private var saveLabel: String {
    if case .edit = mode { return "Save" }
    return "Create"
  }

  private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

  private func load() {
    switch mode {
    case .create:
      name = ""
      shuffle()
    case .edit(let project):
      name = project.name
      icon = ProjectStyle.icon(project.icon).key
      color = ProjectStyle.color(project.color).key
    }
  }

  private func shuffle() {
    icon = ProjectStyle.icons.randomElement()!.key
    color = ProjectStyle.colors.randomElement()!.key
  }

  private func save() async {
    let finished = await action.run { () async throws(NeramError) in
      switch mode {
      case .create:
        let id = try await session.client.run(
          Calls.createProject(name: trimmedName, icon: icon, color: color))
        onCreated(id)
      case .edit(let project):
        try await session.client.run(
          Calls.updateProject(project.id, name: trimmedName, icon: icon, color: color))
      }
    }
    if finished { dismiss() }
  }

  private func archive() async {
    guard case .edit(let project) = mode else { return }
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.archiveProject(project.id))
    }
    if finished { dismiss() }
  }
}
