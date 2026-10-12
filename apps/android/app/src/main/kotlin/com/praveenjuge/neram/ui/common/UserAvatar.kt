package com.praveenjuge.neram.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.praveenjuge.neram.data.initials

/** Initials in a muted circle, like the web's UserAvatar. */
@Composable
fun UserAvatar(name: String, modifier: Modifier = Modifier, size: Dp = 24.dp) {
    Box(
        modifier
            .size(size)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest, CircleShape),
        Alignment.Center,
    ) {
        Text(
            initials(name),
            fontSize = (size.value * 0.42f).sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
