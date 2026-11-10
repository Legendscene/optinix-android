package net.exitpoint.optinix.overlay

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process

class ForegroundGameReader(private val context: Context) {
  private var since = System.currentTimeMillis() - 300_000L
  private val state = ForegroundState()

  fun hasAccess(): Boolean = try {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  } catch (_: Exception) { false }

  fun read(): String? {
    if (!hasAccess()) { state.clear(); return null }
    return try {
      val now = System.currentTimeMillis()
      if (now < since) { state.clear(); since = now - 300_000L }
      val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usage.queryEvents((since - 10_000L).coerceAtLeast(0L), now)
      val event = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        state.accept(event.eventType, event.packageName, event.className, event.timeStamp)
      }
      since = now
      state.packageName
    } catch (_: Exception) { state.clear(); null }
  }
}
