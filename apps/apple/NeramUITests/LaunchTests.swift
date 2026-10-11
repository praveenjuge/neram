import XCTest

final class LaunchTests: XCTestCase {
  /// A fresh install has no Clerk session, so the app must land on sign-in.
  @MainActor
  func testLaunchShowsSignIn() {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    // Clerk's AuthView exposes stable accessibility identifiers.
    let email = app.descendants(matching: .any)["clerk.auth.start.identifier"]
    XCTAssertTrue(email.waitForExistence(timeout: 30), "Expected Clerk's sign-in form")
    XCTAssertTrue(app.buttons["clerk.auth.start.continue"].exists)
  }
}
