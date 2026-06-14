package com.example.chat.data.model

data class User(
    val id: String,
    val username: String,
    val avatarColor: String = "#3b82f6",
    val publicKey: String? = null,
    val createdAt: String? = null
)
