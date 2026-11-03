package net.exitpoint.optinix.device

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.display.DisplayManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.view.Choreographer
import android.view.Display
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class OptinixDeviceModule : Module() {
  private fun context(): Context =
    appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("OptinixDevice")

    Constant("isSupported") { true }

    AsyncFunction("getSnapshot") {
      buildSnapshot()
    }

    AsyncFunction("getCpuLoad") {
      val previous = readProcStat()
      Thread.sleep(SAMPLE_WINDOW_MS)
      val current = readProcStat()
      cpuPayload(previous, current)
    }

    AsyncFunction("getFps") { durationMs: Int, promise: Promise ->
      measureFps(durationMs.coerceIn(250, 5000), promise)
    }
  }

  private fun buildSnapshot(): Map<String, Any?> {
    val previous = readProcStat()
    Thread.sleep(SAMPLE_WINDOW_MS)
    val current = readProcStat()

    return mapOf(
      "capturedAt" to System.currentTimeMillis(),
      "device" to devicePayload(),
      "cpu" to cpuPayload(previous, current),
      "memory" to memoryPayload(),
      "storage" to storagePayload(),
      "battery" to batteryPayload(),
      "thermal" to thermalPayload(),
      "display" to displayPayload(),
      "network" to networkPayload(),
      "uptimeMs" to SystemClock.elapsedRealtime()
    )
  }

  private fun devicePayload(): Map<String, Any?> = mapOf(
    "manufacturer" to Build.MANUFACTURER,
    "brand" to Build.BRAND,
    "model" to Build.MODEL,
    "device" to Build.DEVICE,
    "product" to Build.PRODUCT,
    "hardware" to Build.HARDWARE,
    "board" to Build.BOARD,
    "sdkInt" to Build.VERSION.SDK_INT,
    "release" to Build.VERSION.RELEASE,
    "abis" to Build.SUPPORTED_ABIS.toList(),
    "cores" to Runtime.getRuntime().availableProcessors()
  )

  private fun cpuPayload(previous: List<LongArray>, current: List<LongArray>): Map<String, Any?> {
    val perCore = ArrayList<Double?>(current.size)
    for (index in current.indices) {
      perCore.add(coreLoad(previous.getOrNull(index), current[index]))
    }
    val overall = if (perCore.isEmpty() || perCore.any { it == null }) null else perCore.filterNotNull().average()
    val maxFreqKhz = readMaxCpuFrequencyKhz()
    return mapOf(
      "cores" to Runtime.getRuntime().availableProcessors(),
      "perCore" to perCore,
      "overall" to overall?.let { round1(it) },
      "maxFreqKhz" to maxFreqKhz
    )
  }

  private fun coreLoad(previous: LongArray?, current: LongArray): Double? {
    if (previous == null) return null
    val deltaTotal = (current[1] - previous[1]).toDouble()
    val deltaIdle = (current[0] - previous[0]).toDouble()
    if (deltaTotal <= 0.0 || deltaIdle < 0) return null
    return ((deltaTotal - deltaIdle) / deltaTotal * 100.0).coerceIn(0.0, 100.0)
  }

  private fun readProcStat(): List<LongArray> {
    val rows = ArrayList<LongArray>()
    val file = File("/proc/stat")
    if (!file.exists()) return rows
    try {
      file.useLines { lines ->
        for (line in lines) {
          if (!line.startsWith("cpu")) continue
          val parts = line.trim().split(WHITESPACE)
          if (parts.isEmpty() || parts[0] == "cpu") continue
          val values = ArrayList<Long>(parts.size)
          for (index in 1 until parts.size) {
            val parsed = parts[index].toLongOrNull() ?: break
            values.add(parsed)
          }
          if (values.size < 4) continue
          val idle = values[3] + if (values.size > 4) values[4] else 0L
          rows.add(longArrayOf(idle, values.take(8).sum()))
        }
      }
    } catch (_: Exception) {
    }
    return rows
  }

  private fun readMaxCpuFrequencyKhz(): Long? {
    val file = File("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq")
    if (!file.exists()) return null
    return try {
      file.readText().trim().toLongOrNull()
    } catch (_: Exception) {
      null
    }
  }

  private fun memoryPayload(): Map<String, Any?> {
    val manager = context().getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      ?: return mapOf("available" to false)
    val info = ActivityManager.MemoryInfo()
    manager.getMemoryInfo(info)
    val used = info.totalMem - info.availMem
    return mapOf(
      "available" to true,
      "totalBytes" to info.totalMem,
      "availBytes" to info.availMem,
      "usedBytes" to used,
      "percent" to if (info.totalMem > 0L) round1(used * 100.0 / info.totalMem) else null,
      "lowMemory" to info.lowMemory,
      "thresholdBytes" to info.threshold
    )
  }

  private fun storagePayload(): Map<String, Any?> {
    return try {
      val stat = StatFs(Environment.getDataDirectory().absolutePath)
      val total = stat.blockCountLong * stat.blockSizeLong
      val free = stat.availableBlocksLong * stat.blockSizeLong
      val used = total - free
      mapOf(
        "available" to true,
        "totalBytes" to total,
        "freeBytes" to free,
        "usedBytes" to used,
        "percent" to if (total > 0L) round1(used * 100.0 / total) else null
      )
    } catch (_: Exception) {
      mapOf("available" to false)
    }
  }

  private fun batteryPayload(): Map<String, Any?> {
    val intent = try {
      context().registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    } catch (_: Exception) {
      null
    }
    if (intent == null) return mapOf("available" to false)

    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val percent = if (level >= 0 && scale > 0) round1(level * 100.0 / scale) else null

    val temperature = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
    val voltage = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)
    val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
    val health = intent.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)
    val technology = intent.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)

    val manager = context().getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
    val currentNow = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
    val chargeCounter = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER)

    return mapOf(
      "available" to true,
      "percent" to percent,
      "temperatureC" to if (temperature == Int.MIN_VALUE) null else round1(temperature / 10.0),
      "voltageMv" to if (voltage > 0) voltage else null,
      "currentUa" to if (currentNow != null && currentNow != Int.MIN_VALUE) currentNow else null,
      "chargeCounterUah" to if (chargeCounter != null && chargeCounter != Int.MIN_VALUE) chargeCounter else null,
      "status" to batteryStatusLabel(status),
      "plugged" to pluggedLabel(plugged),
      "health" to batteryHealthLabel(health),
      "technology" to technology
    )
  }

  private fun thermalPayload(): Map<String, Any?> {
    val zones = ArrayList<Map<String, Any?>>()
    var hottest: Double? = null
    val base = File("/sys/class/thermal")
    val entries = base.listFiles()
    if (entries != null) {
      for (entry in entries) {
        if (!entry.name.startsWith("thermal_zone")) continue
        val type = try {
          File(entry, "type").readText().trim()
        } catch (_: Exception) {
          entry.name
        }
        val raw = try {
          File(entry, "temp").readText().trim().toDouble()
        } catch (_: Exception) {
          continue
        }
        val celsius = if (raw > 1000.0) raw / 1000.0 else raw
        if (!celsius.isFinite() || celsius <= 0.0 || celsius > 150.0) continue
        if (hottest == null || celsius > hottest) hottest = celsius
        if (zones.size < 24) {
          zones.add(mapOf("name" to type, "celsius" to round1(celsius)))
        }
      }
    }

    val power = context().getSystemService(Context.POWER_SERVICE) as? PowerManager
    val status = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      power?.currentThermalStatus ?: -1
    } else {
      -1
    }

    return mapOf(
      "celsius" to hottest?.let { round1(it) },
      "status" to status,
      "statusLabel" to thermalStatusLabel(status),
      "zones" to zones
    )
  }

  private fun displayPayload(): Map<String, Any?> {
    val manager = context().getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
    val refreshRate = try {
      manager?.getDisplay(Display.DEFAULT_DISPLAY)?.refreshRate
    } catch (_: Exception) {
      null
    }
    val metrics = context().resources.displayMetrics
    return mapOf(
      "refreshRate" to refreshRate,
      "widthPx" to metrics.widthPixels,
      "heightPx" to metrics.heightPixels,
      "density" to metrics.density,
      "densityDpi" to metrics.densityDpi,
      "scaledDensity" to metrics.scaledDensity
    )
  }

  private fun networkPayload(): Map<String, Any?> {
    val manager = context().getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      ?: return mapOf("available" to false)

    val caps = try {
      manager.getNetworkCapabilities(manager.activeNetwork)
    } catch (_: Exception) {
      null
    }

    val transport = when {
      caps == null -> "none"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
      else -> "other"
    }

    var rssi: Int? = null
    var linkSpeedMbps: Int? = null
    if (transport == "wifi") {
      val wifi = context().applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      @Suppress("DEPRECATION")
      val info = try {
        wifi?.connectionInfo
      } catch (_: Exception) {
        null
      }
      if (info != null) {
        rssi = info.rssi.takeIf { it in -126..-1 }
        linkSpeedMbps = if (info.linkSpeed > 0) info.linkSpeed else null
      }
    }

    return mapOf(
      "available" to true,
      "type" to transport,
      "validated" to (caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) ?: false),
      "metered" to (caps != null && !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)),
      "downKbps" to caps?.linkDownstreamBandwidthKbps?.takeIf { it > 0 },
      "upKbps" to caps?.linkUpstreamBandwidthKbps?.takeIf { it > 0 },
      "rssi" to rssi,
      "linkSpeedMbps" to linkSpeedMbps
    )
  }

  private fun measureFps(durationMs: Int, promise: Promise) {
    val handler = Handler(Looper.getMainLooper())
    handler.post {
      try {
        if (appContext.currentActivity?.hasWindowFocus() != true) { promise.resolve(null); return@post }
        val choreographer = Choreographer.getInstance()
        var frames = 0
        var finished = false
        var startedAt: Long? = null

        val callback = object : Choreographer.FrameCallback {
          override fun doFrame(frameTimeNanos: Long) {
            if (finished) return
            if (appContext.currentActivity?.hasWindowFocus() != true) { finished = true; promise.resolve(null); return }
            if (startedAt == null) { startedAt = frameTimeNanos; choreographer.postFrameCallback(this); return }
            frames += 1
            val elapsedMs = (frameTimeNanos - startedAt!!) / 1_000_000.0
            if (elapsedMs < durationMs) {
              choreographer.postFrameCallback(this)
              return
            }
            finished = true
            val seconds = (elapsedMs / 1000.0).coerceAtLeast(0.001)
            promise.resolve(
              mapOf(
                "fps" to round1(frames / seconds),
                "source" to "optinix-choreographer",
                "frames" to frames,
                "durationMs" to Math.round(elapsedMs).toInt(),
                "refreshRate" to displayPayload()["refreshRate"]
              )
            )
          }
        }

        choreographer.postFrameCallback(callback)
        handler.postDelayed({
          if (!finished) {
            finished = true
            choreographer.removeFrameCallback(callback)
            promise.resolve(null)
          }
        }, durationMs + 1000L)
      } catch (error: Exception) {
        promise.reject("ERR_FPS", error.message, error)
      }
    }
  }

  private fun batteryStatusLabel(status: Int): String = when (status) {
    BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
    BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
    BatteryManager.BATTERY_STATUS_FULL -> "full"
    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
    else -> "unknown"
  }

  private fun pluggedLabel(plugged: Int): String = when {
    plugged == 0 -> "unplugged"
    plugged and BatteryManager.BATTERY_PLUGGED_AC != 0 -> "ac"
    plugged and BatteryManager.BATTERY_PLUGGED_USB != 0 -> "usb"
    plugged and BatteryManager.BATTERY_PLUGGED_WIRELESS != 0 -> "wireless"
    else -> "unknown"
  }

  private fun batteryHealthLabel(health: Int): String = when (health) {
    BatteryManager.BATTERY_HEALTH_GOOD -> "good"
    BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
    BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
    BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
    BatteryManager.BATTERY_HEALTH_COLD -> "cold"
    BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "failure"
    else -> "unknown"
  }

  private fun thermalStatusLabel(status: Int): String = when (status) {
    0 -> "none"
    1 -> "light"
    2 -> "moderate"
    3 -> "severe"
    4 -> "critical"
    5 -> "emergency"
    6 -> "shutdown"
    else -> "unknown"
  }

  private fun round1(value: Double): Double = Math.round(value * 10.0) / 10.0

  companion object {
    private const val SAMPLE_WINDOW_MS = 220L
    private val WHITESPACE = Regex("\\s+")
  }
}
