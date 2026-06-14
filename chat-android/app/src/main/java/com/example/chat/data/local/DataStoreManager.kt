package com.example.chat.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "chat_prefs")

class DataStoreManager(private val context: Context) {

    companion object {
        val SERVER_URL = stringPreferencesKey("server_url")
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        const val DEFAULT_SERVER_URL = "http://64.90.30.102"
    }

    val serverUrl: Flow<String> = context.dataStore.data
        .map { prefs -> prefs[SERVER_URL] ?: DEFAULT_SERVER_URL }

    val accessToken: Flow<String?> = context.dataStore.data
        .map { prefs -> prefs[ACCESS_TOKEN] }

    val refreshToken: Flow<String?> = context.dataStore.data
        .map { prefs -> prefs[REFRESH_TOKEN] }

    val userId: Flow<String?> = context.dataStore.data
        .map { prefs -> prefs[USER_ID] }

    suspend fun setServerUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[SERVER_URL] = url.trim().removeSuffix("/")
        }
    }

    suspend fun saveTokens(access: String, refresh: String, userId: String) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = access
            prefs[REFRESH_TOKEN] = refresh
            prefs[USER_ID] = userId
        }
    }

    suspend fun clearTokens() {
        context.dataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN)
            prefs.remove(REFRESH_TOKEN)
            prefs.remove(USER_ID)
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { prefs ->
            prefs.clear()
        }
    }
}
