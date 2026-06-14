package com.example.chat.data.model

data class RoomMember(
    val userId: String,
    val username: String,
    val avatarColor: String,
    val role: String,
    val joinedAt: String,
    val lastReadAt: String
)

data class Room(
    val id: String,
    val name: String?,
    val isDirect: Boolean,
    val createdBy: String,
    val createdAt: String,
    val members: List<RoomMember> = emptyList()
)

data class RoomListItem(
    val id: String,
    val name: String?,
    val isDirect: Boolean,
    val createdBy: String,
    val createdAt: String,
    val members: List<RoomMember> = emptyList(),
    val unreadCount: Int = 0
)
