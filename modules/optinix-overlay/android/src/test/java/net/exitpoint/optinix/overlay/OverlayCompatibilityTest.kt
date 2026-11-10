package net.exitpoint.optinix.overlay

import org.junit.Assert.*
import org.junit.Test

class OverlayCompatibilityTest {
  @Test fun disabledStopsAllHudPathsAndCannotBeOverridden() {
    val policy = HudPolicy()
    policy.begin(true)
    policy.configure("disabled")
    assertFalse(policy.reopen())
    policy.begin(true)
    assertFalse(policy.requested)
    assertFalse(policy.controlAllowed(true, true))
    assertFalse(policy.statsAllowed(true, true))
  }

  @Test fun notificationReopenIsExplicitAndMinimizeLeavesNoHandle() {
    val policy = HudPolicy()
    policy.configure("notification")
    policy.begin(true)
    assertFalse(policy.controlAllowed(true, true))
    assertFalse(policy.statsAllowed(true, true))
    assertTrue(policy.reopen())
    assertTrue(policy.controlAllowed(true, true))
    policy.collapse()
    assertFalse(policy.controlAllowed(true, true))
    assertFalse(policy.statsAllowed(true, true))
  }

  @Test fun deniedPermissionAndNonGameForegroundHideBothWindows() {
    val policy = HudPolicy()
    policy.begin(true)
    assertTrue(policy.controlAllowed(true, true))
    for ((game, permission) in listOf(false to true, true to false, false to false)) {
      assertFalse(policy.controlAllowed(game, permission))
      assertFalse(policy.statsAllowed(game, permission))
    }
  }

  @Test fun newSessionAndVisibilityChangeClearExplicitOpen() {
    val policy = HudPolicy()
    policy.configure("notification")
    policy.reopen()
    policy.begin(true)
    assertFalse(policy.explicitOpen)
    policy.reopen()
    policy.configure("edge")
    policy.configure("notification")
    assertFalse(policy.controlAllowed(true, true))
  }

  @Test fun hideCanBeReopenedEvenWhenProfileDisabledHud() {
    val policy = HudPolicy()
    policy.begin(false)
    policy.configure("notification")
    policy.reopen()
    assertTrue(policy.controlAllowed(true, true))
    policy.request(false)
    assertFalse(policy.controlAllowed(true, true))
  }

  @Test fun handleHasOnlySmallVisibleIntersectionAtBothDisplayEdges() {
    for (size in listOf(48, 56, 64, 72)) for (density in listOf(1f, 1.7f, 2.55f, 3f)) {
      val peek = (HandleGeometry.peekDp(size) * density).toInt()
      val off = (28 * density).toInt()
      val width = peek + off
      for (right in listOf(false, true)) {
        val x = HandleGeometry.dockX(0, 2400, peek, off, right)
        assertEquals(peek, minOf(2400, x + width) - maxOf(0, x))
        assertTrue(off > peek)
      }
    }
  }

  @Test fun handleMaterialsSizedUpAgainstThePhoneAssistant() {
    // Three compare-and-improve passes landed on the current capsule: the
    // 8–9 dp sliver was invisible mid-game and even 10–14 dp felt squeezed
    // ("pichka pichka") next to the phone assistant's pill; 2026-11-09 the
    // user showed the assistant's TALL left capsule and said ours was too
    // short, so the grip grew to 88–126 dp (peek unchanged).
    assertEquals(20, HandleGeometry.peekDp(48))
    assertEquals(20, HandleGeometry.peekDp(56))
    assertEquals(22, HandleGeometry.peekDp(64))
    assertEquals(26, HandleGeometry.peekDp(72))
    assertEquals(88, HandleGeometry.heightDp(48))
    assertEquals(98, HandleGeometry.heightDp(56))
    assertEquals(112, HandleGeometry.heightDp(64))
    assertEquals(126, HandleGeometry.heightDp(72))
  }

  @Test fun roundedCornersHaveAllEightPathValuesAndMirrorCorrectly() {
    val left = HandleGeometry.cornerRadii(8f, false)
    val right = HandleGeometry.cornerRadii(8f, true)
    assertEquals(8, left.size)
    assertEquals(8, right.size)
    assertArrayEquals(floatArrayOf(0f, 0f, 8f, 8f, 8f, 8f, 0f, 0f), left, 0f)
    assertArrayEquals(floatArrayOf(8f, 8f, 0f, 0f, 0f, 0f, 8f, 8f), right, 0f)
  }

  @Test fun inwardSwipeSurvivesSmallMovesButRejectsVerticalOrOutwardGestures() {
    assertFalse(HandleGeometry.inwardSwipe(-7f, 0f, true, 1f))
    assertTrue(HandleGeometry.inwardSwipe(-32f, 4f, true, 1f))
    assertTrue(HandleGeometry.inwardSwipe(64f, 8f, false, 2f))
    assertFalse(HandleGeometry.inwardSwipe(32f, 4f, true, 1f))
    assertFalse(HandleGeometry.inwardSwipe(-32f, 24f, true, 1f))
    assertFalse(HandleGeometry.inwardSwipe(-32f, 0f, true, 2f))
  }
}
