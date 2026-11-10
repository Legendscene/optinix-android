package net.exitpoint.optinix.overlay

class HudPolicy {
  var visibility = "edge"
    private set
  var requested = false
    private set
  var explicitOpen = false
    private set

  fun configure(mode: String) {
    val next = mode.takeIf { it in setOf("edge", "notification", "disabled") } ?: "edge"
    if (visibility != next) explicitOpen = false
    visibility = next
    if (next == "disabled") requested = false
  }

  fun begin(show: Boolean) { requested = show && visibility != "disabled"; explicitOpen = false }
  fun request(show: Boolean) { requested = show && visibility != "disabled"; if (!requested) explicitOpen = false }
  fun reopen(): Boolean {
    if (visibility == "disabled") return false
    requested = true
    explicitOpen = true
    return true
  }
  fun collapse() { explicitOpen = false }
  fun controlAllowed(game: Boolean, permission: Boolean) = visibility != "disabled" && requested && game && permission && (visibility == "edge" || explicitOpen)
  fun statsAllowed(game: Boolean, permission: Boolean) = visibility != "disabled" && game && permission && (visibility == "edge" || explicitOpen)
}
