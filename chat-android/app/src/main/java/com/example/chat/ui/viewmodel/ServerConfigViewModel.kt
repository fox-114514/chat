package com.example.chat.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.chat.data.local.DataStoreManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ServerConfigViewModel(private val dataStore: DataStoreManager) : ViewModel() {

    private val _uiState = MutableStateFlow(ServerConfigUiState())
    val uiState: StateFlow<ServerConfigUiState> = _uiState

    init {
        viewModelScope.launch {
            val saved = dataStore.serverUrl.first()
            _uiState.value = ServerConfigUiState(serverUrl = saved, hasExistingConfig = true)
        }
    }

    fun onServerUrlChanged(url: String) {
        _uiState.value = _uiState.value.copy(serverUrl = url, error = null)
    }

    fun saveServerUrl(onSuccess: () -> Unit) {
        viewModelScope.launch {
            val url = _uiState.value.serverUrl.trim()
            if (!isValidUrl(url)) {
                _uiState.value = _uiState.value.copy(error = "Please enter a valid URL")
                return@launch
            }
            dataStore.setServerUrl(url)
            onSuccess()
        }
    }

    private fun isValidUrl(url: String): Boolean {
        return url.startsWith("http://") || url.startsWith("https://")
    }
}

data class ServerConfigUiState(
    val serverUrl: String = "http://64.90.30.102",
    val hasExistingConfig: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null
)
