package com.example.chat.data.api

import com.example.chat.data.model.User
import com.example.chat.util.Result

class UserApi(private val apiService: ChatApiService) {

    suspend fun searchUsers(query: String): Result<List<User>> {
        return try {
            val response = apiService.searchUsers(query)
            if (response.isSuccessful) {
                val body = response.body()
                Result.Success(body?.get("users") ?: emptyList())
            } else {
                Result.Error(response.errorBody()?.string() ?: response.message())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
