package com.example.chat.data.socket

import com.example.chat.data.model.Message
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.json.JSONObject
import java.net.URISyntaxException

class SocketManager {

    private var socket: Socket? = null

    private val _newMessages = MutableSharedFlow<Message>(extraBufferCapacity = 64)
    val newMessages: SharedFlow<Message> = _newMessages.asSharedFlow()

    private val _typingUpdates = MutableSharedFlow<TypingUpdate>(extraBufferCapacity = 64)
    val typingUpdates: SharedFlow<TypingUpdate> = _typingUpdates.asSharedFlow()

    private val _presenceUpdates = MutableSharedFlow<PresenceUpdate>(extraBufferCapacity = 64)
    val presenceUpdates: SharedFlow<PresenceUpdate> = _presenceUpdates.asSharedFlow()

    private val _connectionState = MutableSharedFlow<Boolean>(extraBufferCapacity = 16)
    val connectionState: SharedFlow<Boolean> = _connectionState.asSharedFlow()

    private val _errors = MutableSharedFlow<String>(extraBufferCapacity = 16)
    val errors: SharedFlow<String> = _errors.asSharedFlow()

    fun connect(baseUrl: String, token: String) {
        disconnect()

        val options = IO.Options().apply {
            auth = mapOf("token" to token)
            transports = arrayOf("websocket", "polling")
            reconnection = true
            reconnectionAttempts = 10
            reconnectionDelay = 1000
        }

        try {
            socket = IO.socket(baseUrl, options).apply {
                on(Socket.EVENT_CONNECT) {
                    _connectionState.tryEmit(true)
                }
                on(Socket.EVENT_DISCONNECT) {
                    _connectionState.tryEmit(false)
                }
                on(Socket.EVENT_CONNECT_ERROR) { args ->
                    val error = args.firstOrNull()?.toString() ?: "Connection error"
                    _errors.tryEmit(error)
                }
                on(SocketEvents.MESSAGE_NEW) { args ->
                    val json = args.firstOrNull() as? JSONObject
                    json?.let { parseMessage(it) }?.let { _newMessages.tryEmit(it) }
                }
                on(SocketEvents.TYPING_UPDATE) { args ->
                    val json = args.firstOrNull() as? JSONObject
                    json?.let { parseTypingUpdate(it) }?.let { _typingUpdates.tryEmit(it) }
                }
                on(SocketEvents.PRESENCE_UPDATE) { args ->
                    val json = args.firstOrNull() as? JSONObject
                    json?.let { parsePresenceUpdate(it) }?.let { _presenceUpdates.tryEmit(it) }
                }
                on(SocketEvents.ERROR) { args ->
                    val json = args.firstOrNull() as? JSONObject
                    val msg = json?.optString("message") ?: "Socket error"
                    _errors.tryEmit(msg)
                }
                connect()
            }
        } catch (e: URISyntaxException) {
            _errors.tryEmit("Invalid server URL: ${e.message}")
        }
    }

    fun disconnect() {
        socket?.let {
            it.off()
            it.disconnect()
            socket = null
        }
        _connectionState.tryEmit(false)
    }

    fun joinRoom(roomId: String, callback: (Boolean, String?) -> Unit = { _, _ -> }) {
        socket?.emit(
            SocketEvents.ROOM_JOIN,
            JSONObject().put("roomId", roomId),
            Ack { args ->
                val res = args.firstOrNull() as? JSONObject
                val ok = res?.optBoolean("ok") ?: false
                val error = res?.optString("error")
                callback(ok, error)
            }
        )
    }

    fun leaveRoom(roomId: String) {
        socket?.emit(SocketEvents.ROOM_LEAVE, JSONObject().put("roomId", roomId))
    }

    fun sendMessage(
        roomId: String,
        content: String,
        type: String = "text",
        fileId: String? = null,
        callback: (Boolean, Message?, String?) -> Unit = { _, _, _ -> }
    ) {
        val payload = JSONObject().apply {
            put("roomId", roomId)
            put("content", content)
            put("type", type)
            fileId?.let { put("fileId", it) }
        }
        socket?.emit(
            SocketEvents.MESSAGE_SEND,
            payload,
            Ack { args ->
                val res = args.firstOrNull() as? JSONObject
                val ok = res?.optBoolean("ok") ?: false
                val error = res?.optString("error")
                val message = res?.optJSONObject("message")?.let { parseMessage(it) }
                callback(ok, message, error)
            }
        )
    }

    fun sendTypingStart(roomId: String) {
        socket?.emit(SocketEvents.TYPING_START, JSONObject().put("roomId", roomId))
    }

    fun sendTypingStop(roomId: String) {
        socket?.emit(SocketEvents.TYPING_STOP, JSONObject().put("roomId", roomId))
    }

    private fun parseMessage(json: JSONObject): Message {
        return Message(
            id = json.getString("id"),
            roomId = json.getString("roomId"),
            senderId = json.getString("senderId"),
            sender = com.example.chat.data.model.MessageSender(
                id = json.getJSONObject("sender").getString("id"),
                username = json.getJSONObject("sender").getString("username"),
                avatarColor = json.getJSONObject("sender").optString("avatarColor", "#3b82f6")
            ),
            content = json.optString("content", ""),
            type = json.optString("type", "text"),
            file = json.optJSONObject("file")?.let { fileJson ->
                com.example.chat.data.model.FileMeta(
                    id = fileJson.getString("id"),
                    originalName = fileJson.optString("originalName", "file"),
                    sizeBytes = fileJson.optLong("sizeBytes", 0),
                    mimeType = fileJson.optString("mimeType", "application/octet-stream"),
                    url = fileJson.optString("url", "")
                )
            },
            createdAt = json.getString("createdAt"),
            editedAt = if (json.has("editedAt")) json.getString("editedAt") else null
        )
    }

    private fun parseTypingUpdate(json: JSONObject): TypingUpdate {
        return TypingUpdate(
            userId = json.getString("userId"),
            roomId = json.getString("roomId"),
            isTyping = json.getBoolean("isTyping")
        )
    }

    private fun parsePresenceUpdate(json: JSONObject): PresenceUpdate {
        return PresenceUpdate(
            userId = json.getString("userId"),
            online = json.getBoolean("online")
        )
    }
}
