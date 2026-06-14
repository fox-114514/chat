package com.example.chat.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.chat.di.AppModule
import com.example.chat.di.ViewModelFactory
import com.example.chat.ui.screens.auth.AuthScreen
import com.example.chat.ui.screens.chat.ChatScreen
import com.example.chat.ui.screens.roomlist.RoomListScreen
import com.example.chat.ui.screens.serverconfig.ServerConfigScreen
import com.example.chat.ui.viewmodel.AuthViewModel
import com.example.chat.ui.viewmodel.ChatViewModel
import com.example.chat.ui.viewmodel.RoomListViewModel
import com.example.chat.ui.viewmodel.ServerConfigViewModel
import kotlinx.coroutines.flow.first

sealed class Screen(val route: String) {
    data object ServerConfig : Screen("server_config")
    data object Auth : Screen("auth")
    data object RoomList : Screen("room_list")
    data object Chat : Screen("chat/{roomId}") {
        fun createRoute(roomId: String) = "chat/$roomId"
    }
}

@Composable
fun AppNavigation(appModule: AppModule) {
    val navController = rememberNavController()
    val factory = ViewModelFactory(appModule)

    val serverConfigViewModel: ServerConfigViewModel = viewModel(factory = factory)
    val authViewModel: AuthViewModel = viewModel(factory = factory)
    val roomListViewModel: RoomListViewModel = viewModel(factory = factory)
    val chatViewModel: ChatViewModel = viewModel(factory = factory)

    val startDestination = Screen.ServerConfig.route

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Screen.ServerConfig.route) {
            ServerConfigScreen(
                viewModel = serverConfigViewModel,
                onConfigured = { navController.navigate(Screen.Auth.route) }
            )
        }

        composable(Screen.Auth.route) {
            AuthScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Screen.RoomList.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.RoomList.route) {
            val uiState by roomListViewModel.uiState.collectAsState()
            val navEvent by roomListViewModel.navigationEvent.collectAsState()

            LaunchedEffect(navEvent) {
                navEvent?.let { event ->
                    when (event) {
                        is com.example.chat.ui.viewmodel.RoomListNavigationEvent.OpenChat -> {
                            navController.navigate(Screen.Chat.createRoute(event.roomId))
                        }
                    }
                    roomListViewModel.consumeNavigationEvent()
                }
            }

            RoomListScreen(
                viewModel = roomListViewModel,
                currentUserId = uiState.currentUserId,
                onRoomSelected = { roomId ->
                    navController.navigate(Screen.Chat.createRoute(roomId))
                },
                onLogout = {
                    navController.navigate(Screen.Auth.route) {
                        popUpTo(Screen.RoomList.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Chat.route) { backStackEntry ->
            val roomId = backStackEntry.arguments?.getString("roomId") ?: return@composable
            var currentUserId by remember { mutableStateOf("") }

            LaunchedEffect(roomId) {
                currentUserId = appModule.dataStore.userId.first() ?: ""
                chatViewModel.loadRoom(roomId)
            }

            ChatScreen(
                viewModel = chatViewModel,
                currentUserId = currentUserId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
