package com.praveenjuge.neram.data

import com.praveenjuge.neram.data.DeepLink.Destination
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeepLinkTest {
    private val project = "j5788d96grs607ya89ch0bb4ps89n6rh"
    private val task = "j970vr3cjch4tb5c8re3dfndj58g3yb4"
    private val comment = "k17awxjvwz39zf0wdykh4m6gp18g3my6"
    private val base = "https://neram.praveenjuge.com/w/acme"

    @Test
    fun workspacePages() {
        assertEquals(DeepLink("acme", Destination.Dashboard), DeepLink.parse("$base/dashboard"))
        assertEquals(DeepLink("acme", Destination.Dashboard), DeepLink.parse(base))
        assertEquals(DeepLink("acme", Destination.Sprints), DeepLink.parse("$base/sprints"))
        assertEquals(DeepLink("acme", Destination.Activity), DeepLink.parse("$base/activity"))
        assertEquals(DeepLink("acme", Destination.Archived), DeepLink.parse("$base/archived"))
        assertEquals(DeepLink("acme", Destination.Dashboard), DeepLink.parse("$base/settings"))
        assertEquals(
            DeepLink(null, Destination.Dashboard),
            DeepLink.parse("https://neram.praveenjuge.com/w"),
        )
    }

    @Test
    fun projectWithTaskAndComment() {
        assertEquals(
            DeepLink("acme", Destination.Project(project, task, comment)),
            DeepLink.parse("$base/projects/$project?task=$task&comment=$comment"),
        )
        // A comment only makes sense with its task.
        assertEquals(
            DeepLink("acme", Destination.Project(project, null, null)),
            DeepLink.parse("$base/projects/$project?comment=$comment"),
        )
    }

    @Test
    fun tasksWithTask() {
        assertEquals(
            DeepLink("acme", Destination.Tasks(task)),
            DeepLink.parse("$base/tasks?task=$task"),
        )
        assertEquals(DeepLink("acme", Destination.Tasks(null)), DeepLink.parse("$base/tasks"))
    }

    @Test
    fun rejectsOtherHostsSchemesAndBadInput() {
        assertNull(DeepLink.parse("https://example.com/w/acme/dashboard"))
        assertNull(DeepLink.parse("http://neram.praveenjuge.com/w/acme/dashboard"))
        assertNull(DeepLink.parse("https://neram.praveenjuge.com/docs"))
        assertNull(DeepLink.parse("https://neram.praveenjuge.com/w/Acme_Co/dashboard"))
        assertNull(DeepLink.parse("not a url"))
        assertEquals(
            DeepLink("acme", Destination.Dashboard),
            DeepLink.parse("$base/projects/not-an-id"),
        )
        assertEquals(
            DeepLink("acme", Destination.Tasks(null)),
            DeepLink.parse("$base/tasks?task=../x"),
        )
    }
}
