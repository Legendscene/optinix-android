package net.exitpoint.optinix.overlay

import kotlin.math.roundToInt

/**
 * OverlayDashboard — pure presentation logic for the redesigned game panel.
 *
 * Keeping the mappings here (instead of inside the view) means the honesty
 * rules are unit-testable: a "mode" maps onto an existing Optinix profile,
 * never onto a CPU/GPU claim, and every numeric control clamps.
 */
object OverlayDashboard {
  const val TOOLS = 0
  const val BOOST = 1
  const val STATS = 2

  data class Section(val id: String, val label: String, val icon: String)

  // Three destinations only — the Realme-assistant level of simplicity:
  // Tools (do things), Boost (feel faster), Stats (see numbers).
  val sections = listOf(
    Section("tools", "Tools", IconView.TOOLS),
    Section("boost", "Boost", IconView.OPTIMIZE),
    Section("stats", "Stats", IconView.STATS),
  )

  /** Which Optinix profile a panel mode applies. `null` = unknown mode. */
  fun profileForMode(mode: String): String? = when (mode) {
    "power" -> "battery"
    "balanced" -> "balanced"
    "pro" -> "maximum"
    else -> null
  }

  /** Which panel mode a session profile shows as active. */
  fun modeForProfile(id: String?): String = when (id) {
    "battery" -> "power"
    "maximum", "competitive" -> "pro"
    else -> "balanced"
  }

  /** A mode that needs a confirmation sheet before it is applied. */
  fun needsConfirmation(mode: String): Boolean = mode == "pro"

  fun brightnessLevel(fraction: Float, max: Int): Int {
    if (!fraction.isFinite() || max <= 0) return 0
    return (fraction.coerceIn(0f, 1f) * max).roundToInt().coerceIn(0, max)
  }

  fun scaleOptions(): List<Pair<Double, String>> = listOf(0.85 to "Small", 1.0 to "Normal", 1.2 to "Large")

  fun opacityOptions(): List<Pair<Double, String>> = listOf(0.4 to "40%", 0.7 to "70%", 0.9 to "90%", 1.0 to "100%")

  fun corners(): List<Pair<String, String>> = listOf(
    "topLeft" to "Top left",
    "topRight" to "Top right",
    "bottomLeft" to "Bottom left",
    "bottomRight" to "Bottom right",
  )

  fun metrics(): List<Pair<String, String>> = listOf(
    "cpu" to "CPU load",
    "ram" to "RAM usage",
    "temp" to "Temperature",
    "battery" to "Battery",
    "refresh" to "Display refresh",
  )

  fun metricLabel(id: String): String = metrics().firstOrNull { it.first == id }?.second ?: id

  /** Nearest preset for a stored scale, so a custom value still shows a pill. */
  fun nearestScale(value: Double): Double = scaleOptions().minByOrNull { kotlin.math.abs(it.first - value) }?.first ?: 1.0

  fun nearestOpacity(value: Double): Double = opacityOptions().minByOrNull { kotlin.math.abs(it.first - value) }?.first ?: 0.9

  /** The next preset in the cycle, used by quick +/- steps. */
  fun nextScale(value: Double): Double {
    val options = scaleOptions().map { it.first }
    val index = options.indexOf(nearestScale(value))
    return options[(index + 1) % options.size]
  }
}
