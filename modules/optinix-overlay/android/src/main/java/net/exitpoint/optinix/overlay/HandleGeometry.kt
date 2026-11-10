package net.exitpoint.optinix.overlay

import kotlin.math.abs

object HandleGeometry {
  /** Realme Game Assistant comparison passes (2026-11-08–09): the 8–9 dp
   *  sliver was invisible mid-game, and even the first 10–14 dp bump still
   *  felt "pichka hua" (squeezed). The sliver is now a capsule-grade 20–26 dp
   *  with a 88–126 dp grip and the Optinix mark inside — matching the phone
   *  assistant's tall left-edge capsule (the user re-flagged the shorter
   *  68–96 dp grip again on 2026-11-09). The 28 dp off-screen tuck must stay
   *  larger than the peek (asserted by OverlayCompatibilityTest). */
  fun peekDp(size: Int) = when { size >= 72 -> 26; size >= 64 -> 22; else -> 20 }
  fun heightDp(size: Int) = (size.coerceIn(48, 72) * 1.75).toInt().coerceIn(88, 126)
  fun dockX(left: Int, right: Int, peek: Int, off: Int, dockRight: Boolean) = if (dockRight) right - peek else left - off
  fun cornerRadii(radius: Float, dockRight: Boolean) = if (dockRight)
    floatArrayOf(radius, radius, 0f, 0f, 0f, 0f, radius, radius)
  else floatArrayOf(0f, 0f, radius, radius, radius, radius, 0f, 0f)
  fun inwardSwipe(dx: Float, dy: Float, right: Boolean, density: Float) =
    (if (right) -dx else dx) >= 28 * density && abs(dy) <= 16 * density
}
