package net.exitpoint.optinix.overlay

import org.junit.Assert.*
import org.junit.Test

class OverlayAdviceTest {
  @Test fun missingOrInvalidReadingsNeverClaimHealthy() {
    assertTrue(OverlayAdvice.summarize(emptyMap()).contains("No readings available"))
    assertTrue(OverlayAdvice.summarize(mapOf("cpuPercent" to Double.NaN, "temperatureC" to Double.POSITIVE_INFINITY)).contains("No readings available"))
  }

  @Test fun androidSevereThermalsMatterEvenWhenBatterySensorIsBelow45() {
    val advice = OverlayAdvice.summarize(mapOf("thermalStatus" to 3, "thermalLabel" to "Severe", "temperatureC" to 40.8))
    assertTrue(advice.contains("Severe thermal load"))
    assertFalse(advice.contains("No threshold crossed"))
    assertFalse(advice.contains("CPU use is high"))
  }

  @Test fun measuredBatteryAndSensorWarningsKeepTheirProvenance() {
    val advice = OverlayAdvice.summarize(mapOf("temperatureC" to 46.2, "temperatureSource" to "Battery sensor", "batteryPercent" to 15))
    assertTrue(advice.contains("Battery sensor: 46.2°C"))
    assertTrue(advice.contains("Battery is low (15%)"))
  }

  @Test fun aPartialNormalReadingDoesNotAssessMissingMetrics() {
    assertEquals("No threshold crossed in available readings. Unavailable readings are not assessed.", OverlayAdvice.summarize(mapOf("ramPercent" to 50)))
  }
}
