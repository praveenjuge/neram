package com.praveenjuge.neram.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** A project's icon on a tint of its color, like the web's icon box. */
@Composable
fun ProjectBadge(icon: String?, color: String?, size: Dp = 36.dp) {
    val tint = ProjectStyle.color(color).color
    Box(
        Modifier.size(size).background(tint.copy(alpha = 0.15f), RoundedCornerShape(size * 0.28f)),
        Alignment.Center,
    ) {
        Icon(
            ProjectStyle.icon(icon).vector,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(size * 0.55f),
        )
    }
}
