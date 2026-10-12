package com.praveenjuge.neram.ui.tasks

import android.content.ClipData
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import android.text.TextPaint
import android.text.TextUtils
import android.view.View
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.praveenjuge.neram.data.model.DocumentId
import com.praveenjuge.neram.data.model.TaskItem
import kotlinx.coroutines.flow.collectLatest

// Tasks drag between rows, columns, and status buttons with the platform's drag and drop, started
// by a long press. The dragged task's ID travels as the drag's local state, so drops from other
// apps are ignored.
//
// Compose's own drag source isn't used: its start detector consumes the press, so the row could no
// longer be tapped to open. A long click starting the platform drag keeps both.

/** Tap to open the task; long-press to drag it. */
@Composable
fun Modifier.openAndDrag(task: TaskItem, enabled: Boolean, onOpen: () -> Unit): Modifier {
    val view = LocalView.current
    val density = LocalDensity.current
    val colors = MaterialTheme.colorScheme
    val typography = MaterialTheme.typography.bodyLarge
    var size by remember { mutableStateOf(IntSize.Zero) }
    return onSizeChanged { size = it }
        .combinedClickable(
            onClick = onOpen,
            onLongClickLabel = "Drag to move",
            onLongClick =
                if (enabled) {
                    {
                        val shadow =
                            TaskShadow(
                                title = task.title,
                                width = size.width,
                                height = size.height,
                                background = colors.surfaceContainerHighest.toArgb(),
                                foreground = colors.onSurface.toArgb(),
                                textSize = with(density) { typography.fontSize.toPx() },
                                padding = with(density) { 16.dp.toPx() },
                            )
                        view.startDragAndDrop(
                            ClipData.newPlainText("task", task.id),
                            shadow,
                            task.id,
                            0,
                        )
                    }
                } else null,
        )
}

/** The drag image: the task's title on a raised card the size of its row. */
private class TaskShadow(
    private val title: String,
    private val width: Int,
    private val height: Int,
    private val background: Int,
    private val foreground: Int,
    textSize: Float,
    private val padding: Float,
) : View.DragShadowBuilder() {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = background }
    private val text =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = foreground
            this.textSize = textSize
        }

    override fun onProvideShadowMetrics(outShadowSize: Point, outShadowTouchPoint: Point) {
        outShadowSize.set(width.coerceAtLeast(1), height.coerceAtLeast(1))
        outShadowTouchPoint.set(width / 2, height / 2)
    }

    override fun onDrawShadow(canvas: Canvas) {
        canvas.drawRoundRect(0f, 0f, width.toFloat(), height.toFloat(), padding, padding, fill)
        val line = TextUtils.ellipsize(title, text, width - padding * 2, TextUtils.TruncateAt.END)
        val baseline = height / 2f - (text.descent() + text.ascent()) / 2
        canvas.drawText(line, 0, line.length, padding, baseline, text)
    }
}

private val DragAndDropEvent.taskId: DocumentId?
    get() = toAndroidDragEvent().localState as? String

/**
 * Accepts dropped tasks. [onHover] reports the task dragged over this target, or null once it
 * leaves; [scroller] scrolls the surrounding list while the drag nears its edges.
 */
@Composable
fun Modifier.taskDropTarget(
    scroller: DragScroller?,
    onHover: (DocumentId?) -> Unit = {},
    onDrop: (DocumentId) -> Unit,
): Modifier {
    val hover by rememberUpdatedState(onHover)
    val drop by rememberUpdatedState(onDrop)
    val target = remember {
        object : DragAndDropTarget {
            override fun onEntered(event: DragAndDropEvent) = hover(event.taskId)

            override fun onExited(event: DragAndDropEvent) = hover(null)

            override fun onMoved(event: DragAndDropEvent) {
                scroller?.track(event)
            }

            override fun onEnded(event: DragAndDropEvent) {
                hover(null)
                scroller?.stop()
            }

            override fun onDrop(event: DragAndDropEvent): Boolean {
                val id = event.taskId ?: return false
                hover(null)
                scroller?.stop()
                drop(id)
                return true
            }
        }
    }
    return dragAndDropTarget(shouldStartDragAndDrop = { it.taskId != null }, target = target)
}

/**
 * Scrolls a lazy list while a drag hovers near its top or bottom edge. Attach [bounds] to the list
 * and pass this to every drop target inside it.
 */
class DragScroller internal constructor(private val edge: Float) {
    private var area = Rect.Zero
    internal var direction by mutableFloatStateOf(0f)

    val bounds: Modifier = Modifier.onGloballyPositioned { area = it.boundsInRoot() }

    internal fun track(event: DragAndDropEvent) {
        // Drag events report positions in the window's view, which is the Compose root.
        val y = event.toAndroidDragEvent().y
        direction =
            when {
                y < area.top + edge -> -1f
                y > area.bottom - edge -> 1f
                else -> 0f
            }
    }

    internal fun stop() {
        direction = 0f
    }
}

@Composable
fun rememberDragScroller(list: LazyListState): DragScroller {
    val density = LocalDensity.current
    val scroller = remember { DragScroller(edge = with(density) { 64.dp.toPx() }) }
    val step = with(density) { 12.dp.toPx() }
    LaunchedEffect(scroller, list) {
        snapshotFlow { scroller.direction }
            .collectLatest { direction ->
                while (direction != 0f) {
                    list.scrollBy(direction * step)
                    withFrameNanos {}
                }
            }
    }
    return scroller
}
