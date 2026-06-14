package com.example.chat

import android.app.Application
import com.example.chat.di.AppModule

class ChatApplication : Application() {

    lateinit var appModule: AppModule
        private set

    override fun onCreate() {
        super.onCreate()
        appModule = AppModule(this)
    }
}
