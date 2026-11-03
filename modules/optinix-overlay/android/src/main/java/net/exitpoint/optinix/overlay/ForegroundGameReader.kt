package net.exitpoint.optinix.overlay

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process

class ForegroundGameReader(private val context: Context) {
  private var since = System.currentTimeMillis() - 300_000L
  private var current: String? = null

  fun hasAccess(): Boolean = try {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  } catch (_: Exception) { false }

  fun read(): String? {
    if (!hasAccess()) { current = null; return null }
    return try {
      val now = System.currentTimeMillis()
      val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usage.queryEvents(since, now)
      val event = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        when (event.eventType) {
          1 -> current = event.packageName
          2, 23 -> if (current == event.packageName) current = null
          15, 17 -> current = null
        }
      }
      since = now
      current
    } catch (_: Exception) { current = null; null }
  }
}
