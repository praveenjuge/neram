import NeramKit
import SwiftUI

/// Invite someone to the workspace through Neram's server-checked invite.
struct InviteView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var email = ""
  @State private var sentTo: String?
  @State private var action = Action()

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("name@example.com", text: $email)
            .textContentType(.emailAddress)
            #if os(iOS)
              .keyboardType(.emailAddress)
              .textInputAutocapitalization(.never)
            #endif
            .autocorrectionDisabled()
            .onChange(of: email) { _, value in
              if value.count > 254 { email = String(value.prefix(254)) }
            }
        } footer: {
          Text("Invite someone to this workspace. They can view and work on every project.")
        }
        if let sentTo {
          Label("Invitation sent to \(sentTo).", systemImage: "checkmark.circle")
            .foregroundStyle(.green)
        }
      }
      .formStyle(.grouped)
      .navigationTitle("Share Projects")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Done") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(action.isRunning ? "Sending…" : "Send Invite") { Task { await send() } }
            .disabled(trimmed.isEmpty || action.isRunning || !session.isConnected)
        }
      }
      .actionAlert(action, title: "Couldn't send the invitation")
    }
  }

  private var trimmed: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

  private func send() async {
    let address = trimmed
    let finished = await action.run { () async throws(NeramError) in
      try await session.client.run(Calls.invite(email: address))
    }
    if finished {
      sentTo = address
      email = ""
    }
  }
}
