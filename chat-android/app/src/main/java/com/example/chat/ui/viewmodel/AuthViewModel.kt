package com.example.chat.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.chat.data.local.DataStoreManager
import com.example.chat.data.model.User
import com.example.chat.data.repository.AuthRepository
import com.example.chat.data.socket.SocketManager
import com.example.chat.util.Result
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val dataStore: DataStoreManager,
    private val socketManager: SocketManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState

    private val _authEvent = MutableStateFlow<AuthEvent?>(null)
    val authEvent: StateFlow<AuthEvent?> = _authEvent

    fun onUsernameChanged(value: String) {
        _uiState.value = _uiState.value.copy(username = value, error = null)
    }

    fun onPasswordChanged(value: String) {
        _uiState.value = _uiState.value.copy(password = value, error = null)
    }

    fun onConfirmPasswordChanged(value: String) {
        _uiState.value = _uiState.value.copy(confirmPassword = value, error = null)
    }

    fun consumeEvent() {
        _authEvent.value = null
    }

    private suspend fun connectSocket() {
        val token = dataStore.accessToken.first() ?: return
        val baseUrl = dataStore.serverUrl.first()
        socketManager.connect(baseUrl, token)
    }

    fun restoreSession() {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = authRepository.restoreSession()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, user = result.data)
                    connectSocket()
                    _authEvent.value = AuthEvent.NavigateToChat
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            }
        }
    }

    fun login() {
        val state = _uiState.value
        if (!validate(state, requireConfirm = false)) return

        _uiState.value = state.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = authRepository.login(state.username.trim(), state.password)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, user = result.data)
                    connectSocket()
                    _authEvent.value = AuthEvent.NavigateToChat
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    fun register() {
        val state = _uiState.value
        if (!validate(state, requireConfirm = true)) return

        _uiState.value = state.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = authRepository.register(state.username.trim(), state.password)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, user = result.data)
                    connectSocket()
                    _authEvent.value = AuthEvent.NavigateToChat
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    private fun validate(state: AuthUiState, requireConfirm: Boolean): Boolean {
        return when {
            state.username.trim().isEmpty() -> {
                _uiState.value = state.copy(error = "Username is required")
                false
            }
            state.password.length < 8 -> {
                _uiState.value = state.copy(error = "Password must be at least 8 characters")
                false
            }
            requireConfirm && state.password != state.confirmPassword -> {
                _uiState.value = state.copy(error = "Passwords do not match")
                false
            }
            else -> true
        }
    }
}

data class AuthUiState(
    val username: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val user: User? = null
)

sealed class AuthEvent {
    data object NavigateToChat : AuthEvent()
}
