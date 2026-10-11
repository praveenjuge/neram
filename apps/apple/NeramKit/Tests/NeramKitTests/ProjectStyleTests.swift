import Foundation
import Testing

@testable import NeramKit

#if canImport(AppKit)
  import AppKit
#endif

/// Keeps the native icon and color sets identical to the web's, which own the
/// keys stored in Convex.
struct ProjectStyleTests {
  static let webLib = FixtureTests.fixtures
    .deletingLastPathComponent()  // convex
    .deletingLastPathComponent()  // packages
    .deletingLastPathComponent()  // repository root
    .appending(path: "apps/web/src/lib")

  /// Keys declared inside `export const <name> = { ... }` in a web lib file.
  static func webKeys(file: String, object: String, pattern: String) throws -> [String] {
    let source = try String(contentsOf: webLib.appending(path: file), encoding: .utf8)
    let start = try #require(source.range(of: "\(object) = {"))
    let end = try #require(source.range(of: "\n}", range: start.upperBound..<source.endIndex))
    let body = String(source[start.upperBound..<end.lowerBound])
    let regex = try Regex(pattern).anchorsMatchLineEndings()
    return body.matches(of: regex).compactMap { $0.output[1].substring.map(String.init) }
  }

  @Test func iconKeysMatchTheWebInOrder() throws {
    let web = try Self.webKeys(
      file: "project-icons.ts", object: "PROJECT_ICONS",
      pattern: #"^\s+"?([a-z0-9-]+)"?:\s*[A-Z]"#)
    #expect(web.count == 142)
    #expect(ProjectStyle.icons.map(\.key) == web)
  }

  @Test func colorKeysMatchTheWebInOrder() throws {
    let web = try Self.webKeys(
      file: "project-colors.ts", object: "PROJECT_COLORS", pattern: #"^  ([a-z]+): \{"#)
    #expect(ProjectStyle.colors.map(\.key) == web)
  }

  @Test func unknownKeysFallBackToDefaults() {
    #expect(ProjectStyle.icon("not-an-icon").key == ProjectStyle.defaultIcon)
    #expect(ProjectStyle.icon(nil).key == ProjectStyle.defaultIcon)
    #expect(ProjectStyle.color("plaid").key == ProjectStyle.defaultColor)
  }

  #if canImport(AppKit)
    @Test func everySymbolExists() {
      let missing = ProjectStyle.icons.filter {
        NSImage(systemSymbolName: $0.symbol, accessibilityDescription: nil) == nil
      }
      #expect(missing.isEmpty, "Missing SF Symbols: \(missing.map(\.symbol))")
    }
  #endif
}
