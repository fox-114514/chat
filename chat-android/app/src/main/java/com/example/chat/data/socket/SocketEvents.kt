package com.example.chat.data.socket

import io.socket.client.Socket

object SocketEvents {
    const val CONNECT = Socket.EVENT_CONNECT
    const val DISCONNECT = Socket.EVENT_DISCONNECT
    const val CONNECT_ERROR = Socket.EVENT_CONNECT_ERROR

    const val MESSAGE_NEW = "message:new"
    const val TYPING_UPDATE = "typing:update"
    const val PRESENCE_UPDATE = "presence:update"
    const val ERROR = "error"

    const val ROOM_JOIN = "room:join"
    const val ROOM_LEAVE = "room:leave"
    const val MESSAGE_SEND = "message:send"
    const val TYPING_START = "typing:start"
    const val TYPING_STOP = "typing:stop"
}

data class TypingUpdate(
    val userId: String,
    val roomId: String,
    val isTyping: Boolean
)

data class PresenceUpdate(
    val userId: String,
    val online: Boolean
)

data class SocketAckResponse(
    val ok: Boolean = false,
    val message: com.example.chat.data.model.Message? = null,
    val error: String? = null,
    val code: String? = null
)
