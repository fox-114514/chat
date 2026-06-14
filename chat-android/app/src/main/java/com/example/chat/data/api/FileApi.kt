package com.example.chat.data.api

import android.content.Context
import android.net.Uri
import com.example.chat.data.model.FileMeta
import com.example.chat.util.Result
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

class FileApi(
    private val apiService: ChatApiService,
    private val context: Context
) {

    suspend fun uploadFile(uri: Uri): Result<FileMeta> {
        return try {
            val (fileName, mimeType) = getFileInfo(uri)
            val extension = fileName.substringAfterLast('.', "")
            val tempFile = File.createTempFile("upload_", ".$extension", context.cacheDir)
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            }

            val requestFile = tempFile.asRequestBody(mimeType.toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("file", fileName, requestFile)
            val response = apiService.uploadFile(part)

            tempFile.delete()

            if (response.isSuccessful) {
                val body = response.body()
                val meta = body?.get("file")
                if (meta != null) Result.Success(meta)
                else Result.Error("Upload failed")
            } else {
                Result.Error(response.errorBody()?.string() ?: response.message())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Upload error")
        }
    }

    private fun getFileInfo(uri: Uri): Pair<String, String> {
        val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
        var fileName = uri.lastPathSegment ?: "file"
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) {
                    fileName = cursor.getString(nameIndex) ?: fileName
                }
            }
        }
        return fileName to mimeType
    }
}
