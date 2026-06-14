package com.example.chat.data.repository

import com.example.chat.data.api.AuthApi
import com.example.chat.data.local.DataStoreManager
import com.example.chat.data.model.AuthResponse
import com.example.chat.data.model.User
import com.example.chat.util.Result
import kotlinx.coroutines.flow.Flow

class AuthRepository(
    private val authApi: AuthApi,
    private val dataStore: DataStoreManager
) {

    val accessToken: Flow<String?> = dataStore.accessToken

    suspend fun login(username: String, password: String): Result<User> {
        return when (val result = authApi.login(username, password)) {
            is Result.Success -> {
                saveAuth(result.data)
                Result.Success(result.data.user)
            }
            is Result.Error -> result
        }
    }

    suspend fun register(username: String, password: String): Result<User> {
        return when (val result = authApi.register(username, password)) {
            is Result.Success -> {
                saveAuth(result.data)
                Result.Success(result.data.user)
            }
            is Result.Error -> result
        }
    }

    suspend fun restoreSession(): Result<User> {
        return when (val result = authApi.getMe()) {
            is Result.Success -> Result.Success(result.data)
            is Result.Error -> {
                dataStore.clearTokens()
                result
            }
        }
    }

    suspend fun logout() {
        dataStore.clearTokens()
    }

    private suspend fun saveAuth(response: AuthResponse) {
        dataStore.saveTokens(response.accessToken, response.refreshToken, response.user.id)
    }
}
