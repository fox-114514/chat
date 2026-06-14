package com.example.chat.data.model

data class MessageSender(
    val id: String,
    val username: String,
    val avatarColor: String
)

data class FileMeta(
    val id: String,
    val originalName: String,
    val sizeBytes: Long,
    val mimeType: String,
    val url: String
)

data class Message(
    val id: String,
    val roomId: String,
    val senderId: String,
    val sender: MessageSender,
    val content: String,
    val type: String, // text | file | image
    val file: FileMeta?,
    val createdAt: String,
    val editedAt: String? = null
)
