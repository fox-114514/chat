package com.example.chat.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.chat.data.model.Room
import com.example.chat.data.model.RoomListItem
import com.example.chat.data.model.User
import com.example.chat.data.local.DataStoreManager
import com.example.chat.data.repository.AuthRepository
import com.example.chat.data.repository.RoomRepository
import com.example.chat.data.repository.UserRepository
import com.example.chat.data.socket.PresenceUpdate
import com.example.chat.data.socket.SocketManager
import com.example.chat.util.Result
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class RoomListViewModel(
    private val authRepository: AuthRepository,
    private val roomRepository: RoomRepository,
    private val userRepository: UserRepository,
    private val dataStore: DataStoreManager,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(RoomListUiState())
    val uiState: StateFlow<RoomListUiState> = _uiState

    private val _navigationEvent = MutableStateFlow<RoomListNavigationEvent?>(null)
    val navigationEvent: StateFlow<RoomListNavigationEvent?> = _navigationEvent

    init {
        loadCurrentUser()
        loadRooms()
        observePresence()
        observeNewMessages()
    }

    private fun loadCurrentUser() {
        viewModelScope.launch {
            val id = dataStore.userId.first()
            _uiState.value = _uiState.value.copy(currentUserId = id ?: "")
        }
    }

    fun consumeNavigationEvent() {
        _navigationEvent.value = null
    }

    fun loadRooms() {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = roomRepository.getRooms()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rooms = result.data
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            socketManager.disconnect()
            onLoggedOut()
        }
    }

    fun searchUsers(query: String) {
        if (query.length < 2) {
            _uiState.value = _uiState.value.copy(searchResults = emptyList())
            return
        }
        viewModelScope.launch {
            when (val result = userRepository.searchUsers(query)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(searchResults = result.data)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(searchResults = emptyList())
                }
            }
        }
    }

    fun startDirectChat(user: User) {
        viewModelScope.launch {
            when (val result = roomRepository.getDirectRoom(user.id)) {
                is Result.Success -> {
                    upsertRoom(result.data)
                    _navigationEvent.value = RoomListNavigationEvent.OpenChat(result.data.id)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(error = result.message)
                }
            }
        }
    }

    fun createRoom(name: String, memberIds: List<String>) {
        viewModelScope.launch {
            when (val result = roomRepository.createRoom(name, memberIds)) {
                is Result.Success -> {
                    upsertRoom(result.data)
                    _navigationEvent.value = RoomListNavigationEvent.OpenChat(result.data.id)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(error = result.message)
                }
            }
        }
    }

    fun clearSearch() {
        _uiState.value = _uiState.value.copy(searchResults = emptyList())
    }

    private fun upsertRoom(room: Room) {
        _uiState.update { state ->
            val existing = state.rooms.find { it.id == room.id }
            val newItem = RoomListItem(
                id = room.id,
                name = room.name,
                isDirect = room.isDirect,
                createdBy = room.createdBy,
                createdAt = room.createdAt,
                members = room.members,
                unreadCount = existing?.unreadCount ?: 0
            )
            val rooms = if (existing != null) {
                state.rooms.map { if (it.id == room.id) newItem else it }
            } else {
                listOf(newItem) + state.rooms
            }
            state.copy(rooms = rooms)
        }
    }

    private fun observePresence() {
        viewModelScope.launch {
            socketManager.presenceUpdates.collect { update ->
                _uiState.update { state ->
                    val onlineUsers = state.onlineUsers.toMutableSet().apply {
                        if (update.online) add(update.userId) else remove(update.userId)
                    }
                    state.copy(onlineUsers = onlineUsers)
                }
            }
        }
    }

    private fun observeNewMessages() {
        viewModelScope.launch {
            socketManager.newMessages.collect { message ->
                _uiState.update { state ->
                    val updatedRooms = state.rooms.map { room ->
                        if (room.id == message.roomId) {
                            room.copy(unreadCount = room.unreadCount + 1)
                        } else room
                    }
                    state.copy(rooms = updatedRooms)
                }
            }
        }
    }
}

data class RoomListUiState(
    val rooms: List<RoomListItem> = emptyList(),
    val searchResults: List<User> = emptyList(),
    val onlineUsers: Set<String> = emptySet(),
    val currentUserId: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
)

sealed class RoomListNavigationEvent {
    data class OpenChat(val roomId: String) : RoomListNavigationEvent()
}
