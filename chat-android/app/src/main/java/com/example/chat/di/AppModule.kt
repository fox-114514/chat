package com.example.chat.di

import android.content.Context
import com.example.chat.data.api.AuthApi
import com.example.chat.data.api.ChatApiService
import com.example.chat.data.api.FileApi
import com.example.chat.data.api.MessageApi
import com.example.chat.data.api.RoomApi
import com.example.chat.data.api.UserApi
import com.example.chat.data.local.DataStoreManager
import com.example.chat.data.repository.AuthRepository
import com.example.chat.data.repository.MessageRepository
import com.example.chat.data.repository.RoomRepository
import com.example.chat.data.repository.UserRepository
import com.example.chat.data.socket.SocketManager
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class AppModule(private val context: Context) {

    val dataStore by lazy { DataStoreManager(context) }
    val gson: Gson by lazy { GsonBuilder().create() }

    private val tokenInterceptor = Interceptor { chain ->
        val token = runBlocking { dataStore.accessToken.first() }
        val request = chain.request().newBuilder().apply {
            token?.let { header("Authorization", "Bearer $it") }
        }.build()
        chain.proceed(request)
    }

    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(tokenInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    fun createRetrofit(): Retrofit {
        val baseUrl = runBlocking { dataStore.serverUrl.first() }
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    val apiService: ChatApiService by lazy { createRetrofit().create(ChatApiService::class.java) }

    val authApi by lazy { AuthApi(apiService) }
    val roomApi by lazy { RoomApi(apiService) }
    val messageApi by lazy { MessageApi(apiService, gson) }
    val userApi by lazy { UserApi(apiService) }
    val fileApi by lazy { FileApi(apiService, context) }

    val socketManager by lazy { SocketManager() }

    val authRepository by lazy { AuthRepository(authApi, dataStore) }
    val roomRepository by lazy { RoomRepository(roomApi) }
    val messageRepository by lazy { MessageRepository(messageApi) }
    val userRepository by lazy { UserRepository(userApi) }
}
