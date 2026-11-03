package net.exitpoint.optinix.overlay

import org.junit.Assert.*
import org.junit.Test

class GamingContractsTest {
  @Test fun timerDoesNotCountPausedTimeOrDoublePause() {
    var now = 100L
    val timer = SessionClock { now }
    now += 500
    timer.pause()
    now += 5000
    timer.pause()
    assertEquals(500L, timer.elapsed())
    timer.resume()
    now += 200
    assertEquals(700L, timer.elapsed())
  }

  @Test fun failedHttpProbesDoNotBecomePacketLossOrFakeJitter() {
    val result = NetworkSummary.summarize(listOf(null, 50.0, null))
    assertEquals(50.0, result["averageMs"])
    assertNull(result["jitterMs"])
    assertNull(result["packetLossPercent"])
    assertEquals(1, result["successfulSamples"])
    assertEquals(3, result["attemptedSamples"])
    assertNull(NetworkSummary.summarize(listOf(null, null))["averageMs"])
  }

  @Test fun sessionDoesNotInventCpuOrDischargeRates() {
    val session = OverlaySession()
    session.add(mapOf("ramPercent" to 55.0, "batteryPercent" to 80.0, "charging" to false), 0)
    session.add(mapOf("ramPercent" to 65.0, "batteryPercent" to 79.0, "charging" to false), 300000)
    assertNull(session.snapshot(300000)["cpuAverage"])
    assertNull(session.snapshot(300000)["batteryDrainPerHour"])
    assertEquals(60.0, session.snapshot(300000)["ramAverage"])
    assertNull(session.snapshot(600000)["batteryDrainPerHour"])
    session.add(mapOf("batteryPercent" to 79.0, "charging" to false), 600000)
    assertEquals(6.0, session.snapshot(600000)["batteryDrainPerHour"])
    session.add(mapOf("charging" to true, "batteryPercent" to 80.0), 610000)
    assertNull(session.snapshot(700000)["batteryDrainPerHour"])
  }

  @Test fun nativeMacroRejectsCrossAppInputAndUnboundedSequences() {
    fun config(type: String, repeats: Int = 1, duration: Long = 1000) = mapOf<String, Any?>("name" to "Test", "repeats" to repeats, "steps" to listOf(mapOf("type" to type, "durationMs" to duration)))
    assertEquals(1, MacroSpec.parse(config("delay")).steps.size)
    listOf(config("tap"), config("delay", 0), config("delay", 21), config("delay", 20, 60000), config("delay", 1, -1)).forEach {
      try { MacroSpec.parse(it); fail("Unsafe macro should be rejected") } catch (_: IllegalArgumentException) {}
    }
  }

  @Test fun pausedSessionDoesNotAttributeIdleBatteryDrainToActiveTime() {
    val session = OverlaySession()
    session.add(mapOf("batteryPercent" to 80.0, "charging" to false), 0)
    session.invalidateDrain()
    session.add(mapOf("batteryPercent" to 70.0, "charging" to false), 600000)
    assertNull(session.snapshot(600000)["batteryDrainPerHour"])
  }
}
