package com.example.chat.di

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.chat.ui.viewmodel.AuthViewModel
import com.example.chat.ui.viewmodel.ChatViewModel
import com.example.chat.ui.viewmodel.RoomListViewModel
import com.example.chat.ui.viewmodel.ServerConfigViewModel

@Suppress("UNCHECKED_CAST")
class ViewModelFactory(private val appModule: AppModule) : ViewModelProvider.Factory {

    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(ServerConfigViewModel::class.java) -> {
                ServerConfigViewModel(appModule.dataStore) as T
            }
            modelClass.isAssignableFrom(AuthViewModel::class.java) -> {
                AuthViewModel(
                    appModule.authRepository,
                    appModule.dataStore,
                    appModule.socketManager
                ) as T
            }
            modelClass.isAssignableFrom(RoomListViewModel::class.java) -> {
                RoomListViewModel(
                    appModule.authRepository,
                    appModule.roomRepository,
                    appModule.userRepository,
                    appModule.dataStore,
                    appModule.socketManager
                ) as T
            }
            modelClass.isAssignableFrom(ChatViewModel::class.java) -> {
                ChatViewModel(
                    appModule.roomRepository,
                    appModule.messageRepository,
                    appModule.fileApi,
                    appModule.socketManager
                ) as T
            }
            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}
