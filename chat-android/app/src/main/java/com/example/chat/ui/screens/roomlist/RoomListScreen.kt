package com.example.chat.ui.screens.roomlist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.chat.data.model.RoomListItem
import com.example.chat.data.model.User
import com.example.chat.ui.components.Avatar
import com.example.chat.ui.components.ErrorMessage
import com.example.chat.ui.viewmodel.RoomListNavigationEvent
import com.example.chat.ui.viewmodel.RoomListViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomListScreen(
    viewModel: RoomListViewModel,
    currentUserId: String,
    onRoomSelected: (String) -> Unit,
    onLogout: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val navEvent by viewModel.navigationEvent.collectAsState()
    var showSearch by remember { mutableStateOf(false) }
    var showCreateRoom by remember { mutableStateOf(false) }

    LaunchedEffect(navEvent) {
        when (navEvent) {
            is RoomListNavigationEvent.OpenChat -> {
                onRoomSelected((navEvent as RoomListNavigationEvent.OpenChat).roomId)
                viewModel.consumeNavigationEvent()
            }
            null -> {}
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadRooms()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chats") },
                actions = {
                    IconButton(onClick = { showSearch = true }) {
                        Icon(Icons.Default.Search, contentDescription = "Search")
                    }
                    IconButton(onClick = {
                        viewModel.logout(onLogout)
                    }) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateRoom = true }) {
                Icon(Icons.Default.Add, contentDescription = "New group")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                uiState.isLoading && uiState.rooms.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null && uiState.rooms.isEmpty() -> {
                    ErrorMessage(
                        message = uiState.error!!,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                uiState.rooms.isEmpty() -> {
                    Text(
                        text = "No conversations yet\nTap + to start",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    LazyColumn {
                        items(uiState.rooms, key = { it.id }) { room ->
                            RoomItem(
                                room = room,
                                currentUserId = currentUserId,
                                onlineUsers = uiState.onlineUsers,
                                onClick = { onRoomSelected(room.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showSearch) {
        UserSearchDialog(
            searchResults = uiState.searchResults,
            onSearch = viewModel::searchUsers,
            onUserSelected = {
                viewModel.startDirectChat(it)
                showSearch = false
                viewModel.clearSearch()
            },
            onDismiss = {
                showSearch = false
                viewModel.clearSearch()
            }
        )
    }

    if (showCreateRoom) {
        CreateRoomDialog(
            onCreate = { name, memberIds ->
                viewModel.createRoom(name, memberIds)
                showCreateRoom = false
            },
            onDismiss = { showCreateRoom = false }
        )
    }
}

@Composable
private fun RoomItem(
    room: RoomListItem,
    currentUserId: String,
    onlineUsers: Set<String>,
    onClick: () -> Unit
) {
    val displayName: String
    val avatarColor: String
    val isOnline: Boolean?

    if (room.name != null) {
        displayName = room.name
        avatarColor = "#3b82f6"
        isOnline = null
    } else {
        val other = room.members.find { it.userId != currentUserId }
        displayName = other?.username ?: "Unknown"
        avatarColor = other?.avatarColor ?: "#3b82f6"
        isOnline = other?.userId?.let { onlineUsers.contains(it) }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(username = displayName, avatarColor = avatarColor, isOnline = isOnline)

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = displayName,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (room.isDirect) "Direct message" else "${room.members.size} members",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (room.unreadCount > 0) {
            BadgedBox(badge = { Badge { Text(room.unreadCount.toString()) } }) {
                Box(modifier = Modifier.size(24.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UserSearchDialog(
    searchResults: List<User>,
    onSearch: (String) -> Unit,
    onUserSelected: (User) -> Unit,
    onDismiss: () -> Unit
) {
    var query by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Start chat") },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = {
                        query = it
                        onSearch(it)
                    },
                    label = { Text("Search username") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn(modifier = Modifier.height(300.dp)) {
                    items(searchResults) { user ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onUserSelected(user) }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Avatar(username = user.username, avatarColor = user.avatarColor, size = 32.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(user.username)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )
}

@Composable
private fun CreateRoomDialog(
    onCreate: (String, List<String>) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New group") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Group name") },
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        onCreate(name.trim(), emptyList())
                    }
                }
            ) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
