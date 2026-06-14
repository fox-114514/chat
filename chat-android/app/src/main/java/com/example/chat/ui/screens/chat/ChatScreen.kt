package com.example.chat.ui.screens.chat

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.chat.data.model.Message
import com.example.chat.data.model.Room
import com.example.chat.data.model.RoomMember
import com.example.chat.ui.components.Avatar
import com.example.chat.ui.components.ErrorMessage
import com.example.chat.ui.viewmodel.ChatUiState
import com.example.chat.ui.viewmodel.ChatViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    currentUserId: String,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            ChatTopBar(room = uiState.room, currentUserId = currentUserId, onBack = onBack)
        },
        bottomBar = {
            ChatInput(
                isUploading = uiState.isUploading,
                uploadProgress = uiState.uploadProgress,
                onSend = { viewModel.sendMessage(it) },
                onTyping = { viewModel.onTyping() },
                onFileSelected = { uri, type -> viewModel.uploadAndSendFile(uri, type) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            uiState.error?.let {
                ErrorMessage(message = it)
            }

            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f),
                    reverseLayout = false
                ) {
                    items(uiState.messages, key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            isMe = message.senderId == currentUserId
                        )
                    }
                }

                val typingNames = uiState.typingUsers.keys.mapNotNull { userId ->
                    uiState.room?.members?.find { it.userId == userId }?.username
                }
                if (typingNames.isNotEmpty()) {
                    Text(
                        text = if (typingNames.size == 1) "${typingNames[0]} is typing..." else "${typingNames.joinToString(", ")} are typing...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatTopBar(room: Room?, currentUserId: String, onBack: () -> Unit) {
    val (title, subtitle, avatarColor) = remember(room, currentUserId) {
        if (room == null) Triple("Chat", "", "#3b82f6")
        else if (room.name != null) Triple(room.name, "${room.members.size} members", "#3b82f6")
        else {
            val other = room.members.find { it.userId != currentUserId }
            Triple(
                other?.username ?: "Unknown",
                "Direct message",
                other?.avatarColor ?: "#3b82f6"
            )
        }
    }

    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(username = title, avatarColor = avatarColor, size = 36.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(text = title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        }
    )
}

@Composable
private fun MessageBubble(message: Message, isMe: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(
                    if (isMe) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceVariant
                )
                .padding(12.dp)
        ) {
            if (!isMe) {
                Text(
                    text = message.sender.username,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isMe) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(2.dp))
            }

            when (message.type) {
                "image" -> {
                    AsyncImage(
                        model = message.file?.url,
                        contentDescription = message.file?.originalName,
                        modifier = Modifier
                            .height(200.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Fit
                    )
                }
                "file" -> {
                    Text(
                        text = "📎 ${message.file?.originalName ?: message.content}",
                        color = if (isMe) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                else -> {
                    Text(
                        text = message.content,
                        color = if (isMe) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = formatTime(message.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = if (isMe) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ChatInput(
    isUploading: Boolean,
    uploadProgress: Float,
    onSend: (String) -> Unit,
    onTyping: () -> Unit,
    onFileSelected: (Uri, String) -> Unit
) {
    var text by remember { mutableStateOf("") }
    val context = LocalContext.current

    val fileLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val mimeType = context.contentResolver.getType(uri) ?: "*/*"
            val extension = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    cursor.getString(nameIndex)?.substringAfterLast('.', "")?.lowercase() ?: ""
                } else ""
            } ?: ""
            val imageExtensions = setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg")
            val type = if (mimeType.startsWith("image/") || imageExtensions.contains(extension)) "image" else "file"
            onFileSelected(uri, type)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        if (isUploading) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Uploading file…",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = "${(uploadProgress * 100).toInt()}%",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = { fileLauncher.launch("*/*") },
                enabled = !isUploading
            ) {
                Icon(Icons.Default.AttachFile, contentDescription = "Attach file")
            }

            OutlinedTextField(
                value = text,
                onValueChange = {
                    text = it
                    onTyping()
                },
                placeholder = { Text("Type a message...") },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (text.isNotBlank()) {
                        onSend(text)
                        text = ""
                    }
                }),
                modifier = Modifier.weight(1f),
                enabled = !isUploading
            )

            IconButton(
                onClick = {
                    if (text.isNotBlank()) {
                        onSend(text)
                        text = ""
                    }
                },
                enabled = text.isNotBlank() && !isUploading
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send")
            }
        }
    }
}

private fun formatTime(iso: String): String {
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        val date = parser.parse(iso) ?: Date()
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
    } catch (e: Exception) {
        ""
    }
}
