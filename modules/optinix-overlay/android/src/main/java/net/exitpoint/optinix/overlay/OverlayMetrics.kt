package net.exitpoint.optinix.overlay

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.display.DisplayManager
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.view.Display
import java.io.File

class OverlayMetrics(private val context: Context) {
  private var lastTotal: Long? = null
  private var lastIdle: Long? = null
  private val zones by lazy { File("/sys/class/thermal").listFiles { file -> file.name.startsWith("thermal_zone") }?.toList() ?: emptyList() }

  fun sample(): Map<String, Any?> {
    val battery = try { context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) } catch (_: Exception) { null }
    val memory = try {
      val info = ActivityManager.MemoryInfo()
      (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
      info
    } catch (_: Exception) { null }
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val tenths = battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
    val batteryTemp = tenths?.takeIf { it != Int.MIN_VALUE }?.div(10.0)?.takeIf { it.isFinite() && it in -20.0..100.0 }
    val accessible = zones.mapNotNull { zone ->
      try {
        val raw = File(zone, "temp").readText().trim().toDouble()
        val value = if (raw > 1000) raw / 1000.0 else raw
        if (value.isFinite() && value in 5.0..120.0) value to File(zone, "type").readText().trim() else null
      } catch (_: Exception) { null }
    }.maxByOrNull { it.first }
    val status = try { if (Build.VERSION.SDK_INT >= 29) (context.getSystemService(Context.POWER_SERVICE) as PowerManager).currentThermalStatus else null } catch (_: Exception) { null }
    val charge = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val refresh = try { (context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager).getDisplay(Display.DEFAULT_DISPLAY)?.refreshRate?.toDouble() } catch (_: Exception) { null }
    val cpu = cpu()
    return mapOf(
      "cpuPercent" to cpu,
      "cpuReason" to if (cpu == null) "CPU load is restricted or awaiting a second sample" else null,
      "ramPercent" to memory?.takeIf { it.totalMem > 0 }?.let { (it.totalMem - it.availMem).toDouble() / it.totalMem * 100.0 },
      "ramFreeBytes" to memory?.availMem, "ramTotalBytes" to memory?.totalMem,
      "lowMemory" to memory?.lowMemory,
      "temperatureC" to (accessible?.first ?: batteryTemp),
      "temperatureSource" to (accessible?.second ?: if (batteryTemp != null) "Battery sensor" else null),
      "batteryPercent" to if (level >= 0 && scale > 0) level.toDouble() / scale * 100.0 else null,
      "charging" to charge?.takeIf { it >= 0 }?.let { it == BatteryManager.BATTERY_STATUS_CHARGING || it == BatteryManager.BATTERY_STATUS_FULL },
      "thermalStatus" to status,
      "thermalLabel" to status?.let { listOf("None", "Light", "Moderate", "Severe", "Critical", "Emergency", "Shutdown").getOrNull(it) },
      "refreshRate" to refresh?.takeIf { it.isFinite() && it > 0 },
      "gameFps" to null,
      "capturedAt" to System.currentTimeMillis()
    )
  }

  private fun cpu(): Double? = try {
    val values = File("/proc/stat").useLines { it.firstOrNull() }?.trim()?.split(Regex("\\s+"))?.drop(1)?.take(8)?.map { it.toLong() }
    if (values == null || values.size < 8) null else {
      val total = values.sum()
      val idle = values[3] + values[4]
      val delta = lastTotal?.let { total - it }
      val idleDelta = lastIdle?.let { idle - it }
      lastTotal = total
      lastIdle = idle
      if (delta == null || idleDelta == null || delta <= 0 || idleDelta < 0) null
      else ((delta - idleDelta).toDouble() / delta * 100).coerceIn(0.0, 100.0)
    }
  } catch (_: Exception) { lastTotal = null; lastIdle = null; null }
}
