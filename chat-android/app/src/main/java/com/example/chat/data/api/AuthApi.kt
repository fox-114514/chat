package com.example.chat.data.api

import com.example.chat.data.model.AuthResponse
import com.example.chat.data.model.User
import com.example.chat.util.Result
import retrofit2.Response

class AuthApi(private val apiService: ChatApiService) {

    suspend fun login(username: String, password: String): Result<AuthResponse> {
        return handleResponse {
            apiService.login(LoginRequest(username, password))
        }
    }

    suspend fun register(username: String, password: String): Result<AuthResponse> {
        return handleResponse {
            apiService.register(RegisterRequest(username, password))
        }
    }

    suspend fun getMe(): Result<User> {
        return handleResponse {
            apiService.getMe()
        }.map { it["user"] ?: throw IllegalStateException("User not found") }
    }

    suspend fun refreshToken(): Result<AuthResponse> {
        return handleResponse {
            apiService.refreshToken()
        }
    }

    private suspend fun <T> handleResponse(call: suspend () -> Response<T>): Result<T> {
        return try {
            val response = call()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) Result.Success(body)
                else Result.Error("Empty response")
            } else {
                val errorMsg = response.errorBody()?.string() ?: response.message()
                Result.Error(errorMsg)
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
