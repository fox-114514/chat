package com.example.chat.data.api

import com.example.chat.data.model.AuthResponse
import com.example.chat.data.model.FileMeta
import com.example.chat.data.model.Message
import com.example.chat.data.model.Room
import com.example.chat.data.model.RoomListItem
import com.example.chat.data.model.User
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

data class LoginRequest(val username: String, val password: String)
data class RegisterRequest(val username: String, val password: String)
data class CreateRoomRequest(val name: String, val memberIds: List<String>)
data class AddMemberRequest(val userId: String)

interface ChatApiService {

    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("/api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @GET("/api/auth/me")
    suspend fun getMe(): Response<Map<String, User>>

    @POST("/api/auth/refresh")
    suspend fun refreshToken(): Response<AuthResponse>

    @GET("/api/users")
    suspend fun searchUsers(@Query("q") query: String): Response<Map<String, List<User>>>

    @GET("/api/rooms")
    suspend fun getRooms(): Response<Map<String, List<RoomListItem>>>

    @POST("/api/rooms")
    suspend fun createRoom(@Body request: CreateRoomRequest): Response<Map<String, Room>>

    @GET("/api/rooms/{id}")
    suspend fun getRoom(@Path("id") roomId: String): Response<Map<String, Room>>

    @GET("/api/direct/{userId}")
    suspend fun getDirectRoom(@Path("userId") userId: String): Response<Map<String, Room>>

    @POST("/api/rooms/{id}/members")
    suspend fun addMember(
        @Path("id") roomId: String,
        @Body request: AddMemberRequest
    ): Response<Map<String, Boolean>>

    @GET("/api/rooms/{id}/messages")
    suspend fun getMessages(
        @Path("id") roomId: String,
        @Query("before") before: String? = null,
        @Query("limit") limit: Int = 20
    ): Response<Map<String, Any>>

    @POST("/api/rooms/{id}/read")
    suspend fun markAsRead(@Path("id") roomId: String): Response<Map<String, Boolean>>

    @Multipart
    @POST("/api/files/upload")
    suspend fun uploadFile(@Part file: MultipartBody.Part): Response<Map<String, FileMeta>>
}
