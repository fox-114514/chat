package com.example.chat.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun Avatar(
    username: String,
    avatarColor: String = "#3b82f6",
    size: Dp = 40.dp,
    isOnline: Boolean? = null
) {
    val color = try {
        Color(android.graphics.Color.parseColor(avatarColor))
    } catch (e: Exception) {
        Color(0xFF3B82F6)
    }
    val initial = username.firstOrNull()?.uppercase() ?: "?"

    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initial,
                color = Color.White,
                fontSize = (size.value * 0.4).sp,
                style = MaterialTheme.typography.titleMedium
            )
        }

        isOnline?.let { online ->
            val indicatorColor = if (online) Color(0xFF22C55E) else Color.Gray
            Box(
                modifier = Modifier
                    .size(size * 0.25f)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .align(Alignment.BottomEnd)
            ) {
                Box(
                    modifier = Modifier
                        .size(size * 0.18f)
                        .clip(CircleShape)
                        .background(indicatorColor)
                        .align(Alignment.Center)
                )
            }
        }
    }
}
