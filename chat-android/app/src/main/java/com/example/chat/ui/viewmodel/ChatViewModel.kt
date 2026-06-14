package com.example.chat.ui.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.chat.data.api.FileApi
import com.example.chat.data.model.FileMeta
import com.example.chat.data.model.Message
import com.example.chat.data.repository.MessageRepository
import com.example.chat.data.repository.RoomRepository
import com.example.chat.data.socket.SocketManager
import com.example.chat.data.socket.TypingUpdate
import com.example.chat.util.Result
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ChatViewModel(
    private val roomRepository: RoomRepository,
    private val messageRepository: MessageRepository,
    private val fileApi: FileApi,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState

    private var typingStopJob: Job? = null

    fun loadRoom(roomId: String) {
        if (_uiState.value.roomId == roomId) return
        _uiState.value = ChatUiState(roomId = roomId, isLoading = true)

        viewModelScope.launch {
            socketManager.leaveRoom(_uiState.value.roomId)
            socketManager.joinRoom(roomId)

            val roomResult = roomRepository.getRoom(roomId)
            val messagesResult = messageRepository.getMessages(roomId)

            if (roomResult is Result.Success && messagesResult is Result.Success) {
                roomRepository.markAsRead(roomId)
                _uiState.value = _uiState.value.copy(
                    roomId = roomId,
                    room = roomResult.data,
                    messages = messagesResult.data.first,
                    hasMore = messagesResult.data.second,
                    isLoading = false
                )
            } else {
                val error = when {
                    roomResult is Result.Error -> roomResult.message
                    messagesResult is Result.Error -> messagesResult.message
                    else -> "Failed to load chat"
                }
                _uiState.value = _uiState.value.copy(isLoading = false, error = error)
            }
        }

        observeSocketEvents()
    }

    fun loadMoreMessages() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore || state.messages.isEmpty()) return

        _uiState.value = state.copy(isLoadingMore = true)
        viewModelScope.launch {
            val before = state.messages.first().id
            when (val result = messageRepository.getMessages(state.roomId, before)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        messages = result.data.first + state.messages,
                        hasMore = result.data.second,
                        isLoadingMore = false
                    )
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoadingMore = false, error = result.message)
                }
            }
        }
    }

    fun sendMessage(content: String) {
        val roomId = _uiState.value.roomId
        socketManager.sendMessage(roomId, content, "text") { ok, message, error ->
            if (ok && message != null) {
                _uiState.update { it.copy(messages = it.messages + message) }
            } else {
                _uiState.update { it.copy(error = error ?: "Failed to send") }
            }
        }
    }

    fun uploadAndSendFile(uri: Uri, type: String) {
        val roomId = _uiState.value.roomId
        _uiState.update { it.copy(isUploading = true, uploadProgress = 0f) }
        viewModelScope.launch {
            when (val uploadResult = fileApi.uploadFile(uri)) {
                is Result.Success -> {
                    val fileMeta = uploadResult.data
                    _uiState.update { it.copy(uploadProgress = 0.9f) }
                    socketManager.sendMessage(
                        roomId,
                        fileMeta.originalName,
                        type,
                        fileMeta.id
                    ) { ok, message, error ->
                        if (ok && message != null) {
                            _uiState.update {
                                it.copy(
                                    messages = it.messages + message,
                                    isUploading = false,
                                    uploadProgress = 0f
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    error = error ?: "Failed to send file",
                                    isUploading = false,
                                    uploadProgress = 0f
                                )
                            }
                        }
                    }
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(
                            error = uploadResult.message,
                            isUploading = false,
                            uploadProgress = 0f
                        )
                    }
                }
            }
        }
    }

    fun onTyping() {
        val roomId = _uiState.value.roomId
        socketManager.sendTypingStart(roomId)
        typingStopJob?.cancel()
        typingStopJob = viewModelScope.launch {
            delay(1000)
            socketManager.sendTypingStop(roomId)
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    override fun onCleared() {
        super.onCleared()
        typingStopJob?.cancel()
        socketManager.leaveRoom(_uiState.value.roomId)
    }

    private fun observeSocketEvents() {
        viewModelScope.launch {
            socketManager.newMessages.collect { message ->
                if (message.roomId == _uiState.value.roomId) {
                    _uiState.update { it.copy(messages = it.messages + message) }
                }
            }
        }
        viewModelScope.launch {
            socketManager.typingUpdates.collect { update ->
                if (update.roomId == _uiState.value.roomId) {
                    updateTyping(update)
                }
            }
        }
        viewModelScope.launch {
            socketManager.errors.collect { error ->
                _uiState.update { it.copy(error = error) }
            }
        }
    }

    private fun updateTyping(update: TypingUpdate) {
        _uiState.update { state ->
            val current = state.typingUsers.toMutableMap()
            if (update.isTyping) {
                current[update.userId] = System.currentTimeMillis()
            } else {
                current.remove(update.userId)
            }
            state.copy(typingUsers = current)
        }
    }
}

data class ChatUiState(
    val roomId: String = "",
    val room: com.example.chat.data.model.Room? = null,
    val messages: List<Message> = emptyList(),
    val typingUsers: Map<String, Long> = emptyMap(),
    val hasMore: Boolean = false,
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val isUploading: Boolean = false,
    val uploadProgress: Float = 0f,
    val error: String? = null
)
