import CryptoKit
import Foundation

/// Last-seen query results as JSON files, one folder per workspace. Read-only
/// data for instant launches and offline viewing; edits always go to Convex.
public struct QueryCache: Sendable {
  let root: URL

  public init(
    root: URL = URL.cachesDirectory.appending(path: "neram-queries", directoryHint: .isDirectory)
  ) {
    self.root = root
  }

  func read<Value: Decodable>(_ type: Value.Type, key: String, scope: String) -> Value? {
    guard let data = try? Data(contentsOf: file(key: key, scope: scope)) else { return nil }
    return try? JSONDecoder().decode(Value.self, from: data)
  }

  func write<Value: Encodable>(_ value: Value, key: String, scope: String) {
    let url = file(key: key, scope: scope)
    do {
      try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try JSONEncoder().encode(value).write(to: url, options: .atomic)
    } catch {
      // The cache is best effort; live data still flows without it.
    }
  }

  func clear() {
    try? FileManager.default.removeItem(at: root)
  }

  private func file(key: String, scope: String) -> URL {
    let name = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    return root.appending(path: Self.safe(scope)).appending(path: "\(name).json")
  }

  private static func safe(_ scope: String) -> String {
    String(scope.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || $0 == "_" })
  }
}
