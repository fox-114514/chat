package com.example.chat.data.model

data class AuthResponse(
    val user: User,
    val accessToken: String,
    val refreshToken: String
)
