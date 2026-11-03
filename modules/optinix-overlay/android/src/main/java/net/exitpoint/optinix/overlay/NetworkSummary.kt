package net.exitpoint.optinix.overlay

import kotlin.math.abs

object NetworkSummary {
  fun summarize(samples: List<Double?>): Map<String, Any?> {
    val valid = samples.filterNotNull().filter { it.isFinite() && it >= 0.0 }
    val differences = samples.zipWithNext().mapNotNull { (a, b) -> if (a != null && b != null && a.isFinite() && b.isFinite() && a >= 0 && b >= 0) abs(a - b) else null }
    return mapOf(
      "averageMs" to valid.takeIf { it.isNotEmpty() }?.average(),
      "minMs" to valid.minOrNull(), "maxMs" to valid.maxOrNull(),
      "jitterMs" to differences.takeIf { it.isNotEmpty() }?.average(),
      "httpFailurePercent" to if (samples.isNotEmpty()) (samples.size - valid.size) * 100.0 / samples.size else null,
      "packetLossPercent" to null, "successfulSamples" to valid.size, "attemptedSamples" to samples.size
    )
  }
}
