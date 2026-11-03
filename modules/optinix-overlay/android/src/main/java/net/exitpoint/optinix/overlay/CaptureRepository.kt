package net.exitpoint.optinix.overlay

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class CaptureRepository(private val context: Context) {
  private val prefs = GamingStore(context).preferences

  fun create(record: Boolean): Uri {
    val name = "Optinix-${System.currentTimeMillis()}.${if (record) "mp4" else "png"}"
    val uri = if (Build.VERSION.SDK_INT >= 29) {
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, name)
        put(MediaStore.MediaColumns.MIME_TYPE, if (record) "video/mp4" else "image/png")
        put(MediaStore.MediaColumns.RELATIVE_PATH, "${if (record) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES}/Optinix")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      context.contentResolver.insert(if (record) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Could not create the capture file.")
    } else {
      val dir = File(context.filesDir, "captures").apply { mkdirs() }
      val file = File(dir, name).apply { createNewFile() }
      FileProvider.getUriForFile(context, "${context.packageName}.captures", file)
    }
    prefs.edit().putString("pendingCapture", uri.toString()).apply()
    return uri
  }

  fun finish(uri: Uri, record: Boolean) {
    if (Build.VERSION.SDK_INT >= 29) {
      val updated = context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
      check(updated > 0) { "Media file could not be finalized." }
    }
    val item = mapOf("id" to uri.toString(), "uri" to uri.toString(), "kind" to if (record) "video" else "image", "createdAt" to System.currentTimeMillis())
    prefs.edit().putString("captures", JSONArray((listOf(item) + list()).take(100)).toString()).remove("pendingCapture").apply()
  }

  fun discard(uri: Uri) { try { context.contentResolver.delete(uri, null, null) } catch (_: Exception) {}; prefs.edit().remove("pendingCapture").apply() }

  fun recover() {
    prefs.getString("pendingCapture", null)?.let { discard(Uri.parse(it)) }
  }

  fun list(): List<Map<String, Any?>> = try {
    val entries = JSONArray(prefs.getString("captures", "[]") ?: "[]")
    (0 until entries.length()).mapNotNull { entries.optJSONObject(it)?.toValues() }
  } catch (_: Exception) { emptyList() }

  fun open(id: String): Map<String, Any?> {
    val item = list().find { it["id"] == id } ?: return GamingActions.result(false, "Capture is not in your local history.")
    return try {
      context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(item["uri"].toString()), if (item["kind"] == "video") "video/mp4" else "image/png").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
      GamingActions.result(true, "Capture opened in your media viewer.")
    } catch (_: Exception) { GamingActions.result(false, "No compatible media viewer is installed, or the file was removed.") }
  }

  fun delete(id: String): Map<String, Any?> {
    val items = list()
    if (items.none { it["id"] == id }) return GamingActions.result(false, "Unknown capture.")
    return try {
      val count = context.contentResolver.delete(Uri.parse(id), null, null)
      prefs.edit().putString("captures", JSONArray(items.filter { it["id"] != id }).toString()).apply()
      GamingActions.result(true, if (count > 0) "Capture deleted." else "Capture was already absent; history updated.")
    } catch (_: Exception) { GamingActions.result(false, "Android refused deletion. Use your media manager to remove this capture.") }
  }
}
