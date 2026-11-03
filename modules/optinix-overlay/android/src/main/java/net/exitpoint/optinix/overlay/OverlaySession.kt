package net.exitpoint.optinix.overlay

class OverlaySession {
  private var samples = 0
  private var cpuSum = 0.0
  private var cpuCount = 0
  private var cpuPeak: Double? = null
  private var ramSum = 0.0
  private var ramCount = 0
  private var tempPeak: Double? = null
  private var temperatureSource: String? = null
  private var batteryStart: Double? = null
  private var batteryLast: Double? = null
  private var dischargeStartMs: Long? = null
  private var batteryLastAtMs: Long? = null
  private var chargingSeen = false
  private var pauseSeen = false

  fun invalidateDrain() { pauseSeen = true }

  fun add(metrics: Map<String, Any?>, elapsedMs: Long) {
    samples++
    fun number(key: String) = (metrics[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
    number("cpuPercent")?.let { cpuSum += it; cpuCount++; cpuPeak = maxOf(cpuPeak ?: it, it) }
    number("ramPercent")?.let { ramSum += it; ramCount++ }
    number("temperatureC")?.let {
      if (tempPeak == null || it > tempPeak!!) {
        tempPeak = it
        temperatureSource = metrics["temperatureSource"] as? String
      }
    }
    if (metrics["charging"] == true) chargingSeen = true
    number("batteryPercent")?.let {
      if (batteryStart == null) { batteryStart = it; dischargeStartMs = elapsedMs }
      if (batteryLast != null && it > batteryLast!!) chargingSeen = true
      batteryLast = it
      batteryLastAtMs = elapsedMs
    }
  }

  fun snapshot(elapsedMs: Long): Map<String, Any?> {
    val start = batteryStart
    val last = batteryLast
    val dischargeElapsed = (batteryLastAtMs ?: elapsedMs) - (dischargeStartMs ?: elapsedMs)
    val drain = if (!pauseSeen && !chargingSeen && start != null && last != null && start > last && dischargeElapsed >= 600_000L)
      (start - last) * 3_600_000.0 / dischargeElapsed else null
    return mapOf(
      "samples" to samples, "cpuAverage" to if (cpuCount > 0) cpuSum / cpuCount else null,
      "cpuPeak" to cpuPeak, "ramAverage" to if (ramCount > 0) ramSum / ramCount else null,
      "tempPeak" to tempPeak, "temperatureSource" to temperatureSource,
      "batteryDrainPerHour" to drain,
      "batteryDrainReason" to if (pauseSeen) "Timer was paused; discharge rate unavailable" else if (chargingSeen) "Charging occurred; discharge rate unavailable" else "Estimated from battery level after 10 minutes and a measurable drop"
    )
  }
}
