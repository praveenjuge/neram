import Foundation
import Testing

@testable import NeramKit

struct DeepLinkTests {
  let project = "j5788d96grs607ya89ch0bb4ps89n6rh"
  let task = "j970vr3cjch4tb5c8re3dfndj58g3yb4"
  let comment = "k17awxjvwz39zf0wdykh4m6gp18g3my6"

  private func link(_ string: String) -> DeepLink? {
    DeepLink(url: URL(string: string)!)
  }

  @Test func workspacePages() {
    let base = "https://neram.praveenjuge.com/w/acme"
    #expect(link("\(base)/dashboard") == DeepLink(slug: "acme", destination: .dashboard))
    #expect(link(base) == DeepLink(slug: "acme", destination: .dashboard))
    #expect(link("\(base)/sprints") == DeepLink(slug: "acme", destination: .sprints))
    #expect(link("\(base)/activity") == DeepLink(slug: "acme", destination: .activity))
    #expect(link("\(base)/archived") == DeepLink(slug: "acme", destination: .archived))
    #expect(link("\(base)/settings") == DeepLink(slug: "acme", destination: .dashboard))
    #expect(link("https://neram.praveenjuge.com/w") == DeepLink(slug: nil, destination: .dashboard))
  }

  @Test func projectWithTaskAndComment() {
    let url =
      "https://neram.praveenjuge.com/w/acme/projects/\(project)?task=\(task)&comment=\(comment)"
    #expect(
      link(url)
        == DeepLink(slug: "acme", destination: .project(project, task: task, comment: comment)))
    // A comment only makes sense with its task.
    #expect(
      link("https://neram.praveenjuge.com/w/acme/projects/\(project)?comment=\(comment)")
        == DeepLink(slug: "acme", destination: .project(project, task: nil, comment: nil)))
  }

  @Test func tasksWithTask() {
    #expect(
      link("https://neram.praveenjuge.com/w/acme/tasks?task=\(task)")
        == DeepLink(slug: "acme", destination: .tasks(task: task)))
    #expect(
      link("https://neram.praveenjuge.com/w/acme/tasks")
        == DeepLink(slug: "acme", destination: .tasks(task: nil)))
  }

  @Test func rejectsOtherHostsSchemesAndBadInput() {
    #expect(link("https://example.com/w/acme/dashboard") == nil)
    #expect(link("http://neram.praveenjuge.com/w/acme/dashboard") == nil)
    #expect(link("https://neram.praveenjuge.com/docs") == nil)
    #expect(link("https://neram.praveenjuge.com/w/Acme_Co/dashboard") == nil)
    #expect(
      link("https://neram.praveenjuge.com/w/acme/projects/not-an-id")
        == DeepLink(slug: "acme", destination: .dashboard))
    #expect(
      link("https://neram.praveenjuge.com/w/acme/tasks?task=../x")
        == DeepLink(slug: "acme", destination: .tasks(task: nil)))
  }
}
