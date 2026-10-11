import NeramKit
import SwiftUI

extension Color {
  init(_ style: ProjectStyle.Color) {
    self.init(
      red: Double((style.hex >> 16) & 0xFF) / 255,
      green: Double((style.hex >> 8) & 0xFF) / 255,
      blue: Double(style.hex & 0xFF) / 255)
  }
}

/// A project's icon on a tint of its color, like the web's icon box.
struct ProjectBadge: View {
  let icon: String?
  let color: String?
  var size: CGFloat = 32

  var body: some View {
    let tint = Color(ProjectStyle.color(color))
    Image(systemName: ProjectStyle.icon(icon).symbol)
      .font(.system(size: size * 0.5, weight: .medium))
      .foregroundStyle(tint)
      .frame(width: size, height: size)
      .background(tint.opacity(0.15), in: .rect(cornerRadius: size * 0.28))
      .accessibilityHidden(true)
  }
}
