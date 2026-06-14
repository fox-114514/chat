package com.example.chat.data.api

import com.example.chat.data.model.Message
import com.example.chat.util.Result
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class MessageApi(private val apiService: ChatApiService, private val gson: Gson) {

    suspend fun getMessages(
        roomId: String,
        before: String? = null,
        limit: Int = 20
    ): Result<Pair<List<Message>, Boolean>> {
        return try {
            val response = apiService.getMessages(roomId, before, limit)
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    val messagesJson = gson.toJsonTree(body["messages"])
                    val messagesType = object : TypeToken<List<Message>>() {}.type
                    val messages: List<Message> = gson.fromJson(messagesJson, messagesType)
                    val hasMore = body["hasMore"] as? Boolean ?: false
                    Result.Success(messages to hasMore)
                } else {
                    Result.Error("Empty response")
                }
            } else {
                Result.Error(response.errorBody()?.string() ?: response.message())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Network error")
        }
    }
}
