package com.example.chat.data.api

import com.example.chat.data.model.Room
import com.example.chat.data.model.RoomListItem
import com.example.chat.util.Result

class RoomApi(private val apiService: ChatApiService) {

    suspend fun getRooms(): Result<List<RoomListItem>> {
        return handleResponse { apiService.getRooms() }
            .map { it["rooms"] ?: emptyList() }
    }

    suspend fun getRoom(roomId: String): Result<Room> {
        return handleResponse { apiService.getRoom(roomId) }
            .map { it["room"] ?: throw IllegalStateException("Room not found") }
    }

    suspend fun createRoom(name: String, memberIds: List<String>): Result<Room> {
        return handleResponse { apiService.createRoom(CreateRoomRequest(name, memberIds)) }
            .map { it["room"] ?: throw IllegalStateException("Room not found") }
    }

    suspend fun getDirectRoom(userId: String): Result<Room> {
        return handleResponse { apiService.getDirectRoom(userId) }
            .map { it["room"] ?: throw IllegalStateException("Room not found") }
    }

    suspend fun addMember(roomId: String, userId: String): Result<Boolean> {
        return handleResponse { apiService.addMember(roomId, AddMemberRequest(userId)) }
            .map { it["ok"] == true }
    }

    suspend fun markAsRead(roomId: String): Result<Boolean> {
        return handleResponse { apiService.markAsRead(roomId) }
            .map { it["ok"] == true }
    }

    private suspend fun <T> handleResponse(call: suspend () -> retrofit2.Response<T>): Result<T> {
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
