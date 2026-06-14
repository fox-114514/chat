package com.example.chat.data.repository

import com.example.chat.data.api.MessageApi
import com.example.chat.data.model.Message
import com.example.chat.util.Result

class MessageRepository(private val messageApi: MessageApi) {

    suspend fun getMessages(
        roomId: String,
        before: String? = null,
        limit: Int = 20
    ): Result<Pair<List<Message>, Boolean>> = messageApi.getMessages(roomId, before, limit)
}
