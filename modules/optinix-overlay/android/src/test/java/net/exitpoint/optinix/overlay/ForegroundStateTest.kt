package net.exitpoint.optinix.overlay

import org.junit.Assert.*
import org.junit.Test

class ForegroundStateTest {
  @Test fun stoppingTheGameLauncherDoesNotHideItsResumedGameActivity() {
    val state = ForegroundState()
    state.accept(1, "game", "Launcher", 100)
    state.accept(2, "game", "Launcher", 200)
    state.accept(1, "game", "GameActivity", 201)
    state.accept(23, "game", "Launcher", 202)
    assertEquals("game", state.packageName)
    state.accept(2, "game", "GameActivity", 300)
    assertNull(state.packageName)
  }

  @Test fun delayedOldEventsCannotOverrideANewerForegroundApp() {
    val state = ForegroundState()
    state.accept(1, "game", "GameActivity", 300)
    state.accept(1, "old", "OldActivity", 200)
    state.accept(23, "game", "GameActivity", 250)
    assertEquals("game", state.packageName)
  }

  @Test fun replayingTheOverlapKeepsPermissionReturnAndGameStateCorrect() {
    val state = ForegroundState()
    val events = listOf(
      Triple(1, "game", "GameActivity"), Triple(2, "game", "GameActivity"),
      Triple(1, "permission", "PermissionActivity"), Triple(2, "permission", "PermissionActivity"),
      Triple(1, "game", "GameActivity"), Triple(23, "permission", "PermissionActivity")
    )
    repeat(2) { events.forEachIndexed { index, (type, pkg, activity) -> state.accept(type, pkg, activity, index.toLong()) } }
    assertEquals("game", state.packageName)
  }

  @Test fun lockAndPermissionRevocationClearForeground() {
    val state = ForegroundState()
    state.accept(1, "game", "GameActivity", 100)
    state.accept(15, null, null, 200)
    assertNull(state.packageName)
    state.accept(1, "game", "GameActivity", 300)
    state.clear()
    assertNull(state.packageName)
  }
}
