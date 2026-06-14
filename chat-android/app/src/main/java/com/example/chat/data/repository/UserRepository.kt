package com.example.chat.data.repository

import com.example.chat.data.api.UserApi
import com.example.chat.data.model.User
import com.example.chat.util.Result

class UserRepository(private val userApi: UserApi) {

    suspend fun searchUsers(query: String): Result<List<User>> = userApi.searchUsers(query)
}
