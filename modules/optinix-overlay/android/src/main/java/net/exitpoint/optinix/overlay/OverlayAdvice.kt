package net.exitpoint.optinix.overlay

import java.util.Locale

object OverlayAdvice {
  fun summarize(metrics: Map<String, Any?>): String {
    fun reading(key: String) = (metrics[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
    val cpu = reading("cpuPercent")
    val ram = reading("ramPercent")
    val temp = reading("temperatureC")
    val battery = reading("batteryPercent")
    val thermal = reading("thermalStatus")
    val parts = ArrayList<String>()
    if (thermal != null && thermal >= 2) {
      val label = metrics["thermalLabel"] as? String ?: "elevated"
      parts.add("Android reports $label thermal load. Lower game settings or take a break.")
    }
    if (cpu != null && cpu >= 90) parts.add("CPU use is high. Lower game settings if play feels uneven.")
    if (ram != null && ram >= 80) parts.add("RAM use is high (${ram.toInt()}%, measured).")
    if (temp != null && temp >= 45) parts.add("${metrics["temperatureSource"] ?: "Sensor"}: ${String.format(Locale.US, "%.1f", temp)}°C. Consider a break.")
    if (battery != null && battery <= 20) parts.add("Battery is low (${battery.toInt()}%).")
    if (parts.isNotEmpty()) return parts.joinToString(" ")
    return if (listOf(cpu, ram, temp, battery, thermal).all { it == null })
      "No readings available for an assessment. Missing metrics are not treated as healthy."
    else "No threshold crossed in available readings. Unavailable readings are not assessed."
  }
}
