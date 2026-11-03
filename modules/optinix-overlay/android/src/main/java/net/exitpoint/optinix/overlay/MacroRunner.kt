package net.exitpoint.optinix.overlay

import android.os.Handler
import android.os.Looper
import android.os.SystemClock

class MacroRunner(private val action: (MacroStep) -> String?) {
  private val handler = Handler(Looper.getMainLooper())
  private var spec: MacroSpec? = null
  private var position = 0
  private var startedAt = 0L
  private var status = "idle"
  private var message = "No macro running"
  private val advance = Runnable { advance() }

  fun start(next: MacroSpec): Boolean {
    if (status == "running") return false
    handler.removeCallbacksAndMessages(null)
    spec = next
    position = 0
    startedAt = SystemClock.elapsedRealtime()
    status = "running"
    message = "Running ${next.name}"
    advance()
    return true
  }

  private fun advance() {
    val macro = spec ?: return
    if (status != "running") return
    if (SystemClock.elapsedRealtime() - startedAt >= 600_000L) { stop("Maximum runtime reached"); return }
    if (position >= macro.steps.size * macro.repeats) {
      status = "completed"
      message = "Completed ${macro.name}: $position steps"
      return
    }
    val step = macro.steps[position % macro.steps.size]
    val failure = try { if (step.type == "delay") null else action(step) } catch (error: Exception) { error.message ?: "Android refused this macro action." }
    if (failure != null) { stop(failure, "failed"); return }
    message = "${macro.name}: step ${position % macro.steps.size + 1}/${macro.steps.size}, repeat ${position / macro.steps.size + 1}/${macro.repeats}"
    handler.postDelayed({
      if (status == "running") { position++; handler.post(advance) }
    }, step.durationMs)
  }

  fun stop(reason: String = "Cancelled by you", nextStatus: String = "cancelled") {
    handler.removeCallbacksAndMessages(null)
    if (status == "running") { status = nextStatus; message = reason }
  }

  fun state(): Map<String, Any?> = mapOf("status" to status, "name" to spec?.name, "completedSteps" to position, "message" to message)
}
