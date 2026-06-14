package com.example.chat.data.repository

import com.example.chat.data.api.RoomApi
import com.example.chat.data.model.Room
import com.example.chat.data.model.RoomListItem
import com.example.chat.util.Result

class RoomRepository(private val roomApi: RoomApi) {

    suspend fun getRooms(): Result<List<RoomListItem>> = roomApi.getRooms()

    suspend fun getRoom(roomId: String): Result<Room> = roomApi.getRoom(roomId)

    suspend fun createRoom(name: String, memberIds: List<String>): Result<Room> =
        roomApi.createRoom(name, memberIds)

    suspend fun getDirectRoom(userId: String): Result<Room> = roomApi.getDirectRoom(userId)

    suspend fun addMember(roomId: String, userId: String): Result<Boolean> =
        roomApi.addMember(roomId, userId)

    suspend fun markAsRead(roomId: String): Result<Boolean> = roomApi.markAsRead(roomId)
}
