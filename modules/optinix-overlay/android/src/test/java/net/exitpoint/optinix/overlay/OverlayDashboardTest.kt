package net.exitpoint.optinix.overlay

import org.junit.Assert.*
import org.junit.Test

class OverlayDashboardTest {
  @Test fun modesMapOnlyToExistingOptinixProfiles() {
    assertEquals("battery", OverlayDashboard.profileForMode("power"))
    assertEquals("balanced", OverlayDashboard.profileForMode("balanced"))
    assertEquals("maximum", OverlayDashboard.profileForMode("pro"))
    assertNull(OverlayDashboard.profileForMode("turbo"))
    assertNull(OverlayDashboard.profileForMode(""))
  }

  @Test fun profileIdsRoundTripToModes() {
    assertEquals("power", OverlayDashboard.modeForProfile("battery"))
    assertEquals("pro", OverlayDashboard.modeForProfile("maximum"))
    assertEquals("pro", OverlayDashboard.modeForProfile("competitive"))
    assertEquals("balanced", OverlayDashboard.modeForProfile("balanced"))
    assertEquals("balanced", OverlayDashboard.modeForProfile(null))
  }

  @Test fun onlyProGamerAsksForConfirmation() {
    assertTrue(OverlayDashboard.needsConfirmation("pro"))
    assertFalse(OverlayDashboard.needsConfirmation("balanced"))
    assertFalse(OverlayDashboard.needsConfirmation("power"))
  }

  @Test fun brightnessClampsToTheSystemRangeAndSurvivesNonFiniteInput() {
    assertEquals(0, OverlayDashboard.brightnessLevel(-1f, 255))
    assertEquals(255, OverlayDashboard.brightnessLevel(2f, 255))
    assertEquals(128, OverlayDashboard.brightnessLevel(0.5f, 255))
    assertEquals(0, OverlayDashboard.brightnessLevel(Float.NaN, 255))
    assertEquals(0, OverlayDashboard.brightnessLevel(0.5f, 0))
  }

  @Test fun scaleAndOpacitySnapToTheirPresets() {
    assertEquals(1.0, OverlayDashboard.nearestScale(0.99), 0.0)
    assertEquals(0.85, OverlayDashboard.nearestScale(0.7), 0.0)
    assertEquals(1.2, OverlayDashboard.nearestScale(1.6), 0.0)
    assertEquals(0.9, OverlayDashboard.nearestOpacity(0.94), 0.0)
    assertEquals(1.0, OverlayDashboard.nearestOpacity(1.4), 0.0)
    assertEquals(1.2, OverlayDashboard.nextScale(1.0), 0.0)
    assertEquals(0.85, OverlayDashboard.nextScale(1.2), 0.0)
  }

  @Test fun sectionsCoverEveryPanelDestinationWithDistinctIcons() {
    assertEquals(3, OverlayDashboard.sections.size)
    assertEquals(listOf("tools", "boost", "stats"), OverlayDashboard.sections.map { it.id })
    assertEquals(listOf("Tools", "Boost", "Stats"), OverlayDashboard.sections.map { it.label })
    assertEquals(3, OverlayDashboard.sections.map { it.icon }.toSet().size)
    assertEquals(listOf("cpu", "ram", "temp", "battery", "refresh"), OverlayDashboard.metrics().map { it.first })
    assertEquals(listOf("topLeft", "topRight", "bottomLeft", "bottomRight"), OverlayDashboard.corners().map { it.first })
  }
}
