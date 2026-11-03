package net.exitpoint.optinix.overlay

import android.app.ActivityManager
import android.content.Context
import java.io.File
import java.util.Locale

class OverlayTools(private val context: Context) {
  fun boost(): String = try {
    val info = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
    "${bytes(info.availMem)} available RAM. Android manages cached apps; no other apps were killed."
  } catch (_: Exception) { "Memory information unavailable. No processes were changed." }

  fun clearCache(): String {
    var freed = 0L
    var failed = 0
    listOfNotNull(context.cacheDir, context.externalCacheDir).forEach { dir ->
      val root = dir.canonicalPath + File.separator
      fun remove(file: File) {
        if (Thread.currentThread().isInterrupted) return
        try {
          if (!file.canonicalPath.startsWith(root)) return
          if (file.isDirectory) { file.listFiles()?.forEach { remove(it) }; file.delete() }
          else {
            val size = file.length()
            if (file.delete()) freed += size else failed++
          }
        } catch (_: Exception) { failed++ }
      }
      dir.listFiles()?.forEach { remove(it) }
    }
    return "Deleted ${bytes(freed)} from Optinix cache${if (failed > 0) "; $failed files could not be removed" else ""}. Other apps' caches unchanged."
  }

  private fun bytes(value: Long) = if (value < 1024 * 1024) String.format(Locale.US, "%.1f KB", value / 1024.0) else String.format(Locale.US, "%.1f MB", value / 1048576.0)
}
