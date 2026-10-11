import Foundation

/// Project icons and colors. Keys are the web's stable identifiers stored in
/// Convex (apps/web/src/lib/project-icons.ts and project-colors.ts); each icon
/// maps to the closest SF Symbol. Unknown keys fall back to the defaults, as on
/// the web.
public enum ProjectStyle {
  public static let defaultIcon = "folder-kanban"
  public static let defaultColor = "slate"

  public struct Icon: Hashable, Sendable, Identifiable {
    public let key: String
    public let symbol: String
    public var id: String { key }
    /// Search label, matching the web picker: hyphens become spaces.
    public var label: String { key.replacingOccurrences(of: "-", with: " ") }
  }

  public struct Color: Hashable, Sendable, Identifiable {
    public let key: String
    /// Tailwind 500 shade, `0xRRGGBB`.
    public let hex: UInt32
    public var id: String { key }
    public var label: String { key.prefix(1).uppercased() + key.dropFirst() }
  }

  /// Picker order matches the web.
  public static let icons: [Icon] = iconTable.map { Icon(key: $0.0, symbol: $0.1) }
  public static let colors: [Color] = colorTable.map { Color(key: $0.0, hex: $0.1) }

  public static func icon(_ key: String?) -> Icon {
    iconsByKey[key ?? ""] ?? iconsByKey[defaultIcon]!
  }

  public static func color(_ key: String?) -> Color {
    colorsByKey[key ?? ""] ?? colorsByKey[defaultColor]!
  }

  private static let iconsByKey = Dictionary(uniqueKeysWithValues: icons.map { ($0.key, $0) })
  private static let colorsByKey = Dictionary(uniqueKeysWithValues: colors.map { ($0.key, $0) })

  private static let colorTable: [(String, UInt32)] = [
    ("slate", 0x64748B), ("gray", 0x6B7280), ("zinc", 0x71717A), ("neutral", 0x737373),
    ("stone", 0x78716C), ("red", 0xEF4444), ("rose", 0xF43F5E), ("orange", 0xF97316),
    ("amber", 0xF59E0B), ("yellow", 0xEAB308), ("lime", 0x84CC16), ("green", 0x22C55E),
    ("emerald", 0x10B981), ("teal", 0x14B8A6), ("cyan", 0x06B6D4), ("sky", 0x0EA5E9),
    ("blue", 0x3B82F6), ("indigo", 0x6366F1), ("violet", 0x8B5CF6), ("purple", 0xA855F7),
    ("fuchsia", 0xD946EF), ("pink", 0xEC4899),
  ]

  private static let iconTable: [(String, String)] = [
    // Boards & planning
    ("folder-kanban", "rectangle.split.3x1"), ("list-checks", "checklist"),
    ("layout-grid", "square.grid.2x2"), ("check-check", "checkmark.circle"),
    ("folder", "folder"), ("archive", "archivebox"), ("inbox", "tray"),
    ("clipboard", "clipboard"), ("clipboard-list", "list.bullet.clipboard"),
    ("sticky-note", "note.text"), ("notebook-pen", "square.and.pencil"),
    ("file-text", "doc.text"), ("calendar", "calendar"),
    ("calendar-days", "calendar.badge.clock"), ("timer", "timer"), ("pin", "pin"),
    ("tag", "tag"), ("hash", "number"), ("flag", "flag"), ("bookmark", "bookmark"),
    ("target", "target"), ("briefcase", "briefcase"),
    // Goals & energy
    ("rocket", "paperplane"), ("star", "star"), ("sparkles", "sparkles"), ("zap", "bolt"),
    ("flame", "flame"), ("trophy", "trophy"), ("medal", "medal"), ("award", "rosette"),
    ("crown", "crown"), ("gem", "diamond"), ("diamond", "suit.diamond"), ("gift", "gift"),
    ("heart", "heart"), ("smile", "face.smiling"), ("lightbulb", "lightbulb"),
    ("compass", "safari"),
    // Engineering
    ("code", "chevron.left.forwardslash.chevron.right"), ("terminal", "terminal"),
    ("binary", "number.square"), ("git-branch", "arrow.triangle.branch"),
    ("database", "cylinder.split.1x2"), ("server", "server.rack"), ("cpu", "cpu"),
    ("component", "square.on.square"), ("layers", "square.3.layers.3d"),
    ("box", "shippingbox"), ("boxes", "square.stack.3d.up"), ("package", "cube.box"),
    ("bot", "desktopcomputer"), ("cog", "gearshape"), ("atom", "atom"), ("brain", "brain"),
    ("bug", "ladybug"), ("activity", "waveform.path.ecg"), ("wrench", "wrench.adjustable"),
    ("key", "key"), ("lock", "lock"),
    // Design & media
    ("pen-tool", "pencil.tip"), ("pencil", "pencil"), ("brush", "paintbrush.pointed"),
    ("paintbrush", "paintbrush"), ("palette", "paintpalette"), ("shapes", "square.on.circle"),
    ("ruler", "ruler"), ("scissors", "scissors"), ("image", "photo"), ("camera", "camera"),
    ("aperture", "camera.aperture"), ("film", "film"), ("video", "video"), ("mic", "mic"),
    ("music", "music.note"), ("headphones", "headphones"),
    // Communication & people
    ("mail", "envelope"), ("message-square", "text.bubble"),
    ("message-circle", "bubble.left"), ("send", "paperplane.fill"), ("phone", "phone"),
    ("megaphone", "megaphone"), ("at-sign", "at"), ("bell", "bell"), ("users", "person.2"),
    ("user", "person"), ("book-open", "book"), ("graduation-cap", "graduationcap"),
    // Places & weather
    ("globe", "globe"), ("map", "map"), ("map-pin", "mappin.and.ellipse"),
    ("plane", "airplane"), ("anchor", "ferry"), ("mountain", "mountain.2"), ("tent", "tent"),
    ("house", "house"), ("cloud", "cloud"), ("sun", "sun.max"), ("moon", "moon"),
    ("snowflake", "snowflake"), ("wind", "wind"), ("umbrella", "umbrella"),
    // Commerce
    ("shopping-cart", "cart"), ("shopping-bag", "bag"), ("credit-card", "creditcard"),
    ("wallet", "wallet.bifold"), ("dollar-sign", "dollarsign"), ("coins", "centsign.circle"),
    ("line-chart", "chart.xyaxis.line"), ("ticket", "ticket"), ("truck", "truck.box"),
    // Food & drink
    ("coffee", "cup.and.saucer"), ("cup-soda", "takeoutbag.and.cup.and.straw"),
    ("wine", "wineglass"), ("pizza", "fork.knife.circle"), ("cake", "birthday.cake"),
    ("apple", "applelogo"), ("carrot", "carrot"), ("cherry", "circle.circle"),
    ("croissant", "moon.haze"), ("ice-cream-cone", "snowflake.circle"),
    ("salad", "leaf.circle"), ("utensils", "fork.knife"),
    // Play & sport
    ("dumbbell", "dumbbell"), ("bike", "bicycle"), ("car", "car"),
    ("gamepad-2", "gamecontroller"), ("puzzle", "puzzlepiece"), ("swords", "figure.fencing"),
    ("shield", "shield"), ("ghost", "theatermasks"), ("wifi", "wifi"),
    // Nature & animals
    ("leaf", "leaf"), ("sprout", "camera.macro"), ("trees", "tree"), ("feather", "leaf.fill"),
    ("bird", "bird"), ("cat", "cat"), ("dog", "dog"), ("fish", "fish"), ("rabbit", "hare"),
    ("paw-print", "pawprint"), ("beaker", "flask"),
  ]
}
