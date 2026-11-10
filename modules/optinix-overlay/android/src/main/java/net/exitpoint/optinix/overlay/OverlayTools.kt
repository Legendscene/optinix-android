package net.exitpoint.optinix.overlay

import android.app.ActivityManager
import android.content.Context
import java.io.File
import java.util.Locale

class OverlayTools(private val context: Context) {
  /** Honest boost: measure available RAM, sweep Optinix's own cache, then
   *  re-measure. Android 10+ only lets a caller kill its own background
   *  processes, so every number here is measurement and nothing is killed. */
  fun boost(): String {
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      ?: return "Memory service unavailable. Nothing was changed."
    val before = ActivityManager.MemoryInfo()
    manager.getMemoryInfo(before)
    val (freed, failed) = sweepCache()
    val after = ActivityManager.MemoryInfo()
    manager.getMemoryInfo(after)
    val delta = after.availMem - before.availMem
    val cacheNote = when {
      freed > 0L -> "; ${bytes(freed)} came from Optinix's own cache"
      failed > 0 -> "; Optinix cache freed ${bytes(freed)}, $failed files stayed locked"
      else -> "; Optinix cache was already clean"
    }
    return "Boost sweep measured: ${bytes(delta)} change in available RAM (${bytes(before.availMem)} → ${bytes(after.availMem)})$cacheNote. Other apps are protected by Android and were not touched."
  }

  fun clearCache(): String {
    val (freed, failed) = sweepCache()
    return "Deleted ${bytes(freed)} from Optinix cache${if (failed > 0) "; $failed files could not be removed" else ""}. Other apps' caches unchanged."
  }

  private fun sweepCache(): Pair<Long, Int> {
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
    return freed to failed
  }

  private fun bytes(value: Long) = if (value < 1024 * 1024) String.format(Locale.US, "%.1f KB", value / 1024.0) else String.format(Locale.US, "%.1f MB", value / 1048576.0)
}
