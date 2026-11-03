package net.exitpoint.optinix.overlay

object OverlayBridge {
  @Volatile
  var error: String? = null
  @Volatile
  var accent: String = "#14B8A6"

  @Volatile
  var opacity: Double = 0.92

  @Volatile
  var expanded: Boolean = false

  @Volatile
  var showing: Boolean = false
}
