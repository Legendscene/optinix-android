package net.exitpoint.optinix.overlay

class SessionClock(private val now: () -> Long) {
  private var accumulated = 0L
  private var resumedAt = now()
  var paused = false
    private set

  fun elapsed(): Long = accumulated + if (paused) 0L else (now() - resumedAt).coerceAtLeast(0L)

  fun pause() {
    if (paused) return
    accumulated = elapsed()
    paused = true
  }

  fun resume() {
    if (!paused) return
    resumedAt = now()
    paused = false
  }
}
