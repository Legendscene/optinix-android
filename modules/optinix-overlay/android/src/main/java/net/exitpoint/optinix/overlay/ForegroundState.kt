package net.exitpoint.optinix.overlay

class ForegroundState {
  var packageName: String? = null
    private set
  private var activity: String? = null
  private var timestamp = Long.MIN_VALUE

  fun clear() { packageName = null; activity = null; timestamp = Long.MIN_VALUE }

  fun accept(type: Int, pkg: String?, className: String?, time: Long) {
    if (time < timestamp) return
    when (type) {
      1 -> { packageName = pkg; activity = className; timestamp = time }
      2, 23 -> if (pkg == packageName && (activity == null || className == null || activity == className)) {
        packageName = null; activity = null; timestamp = time
      }
      15, 17, 26 -> { packageName = null; activity = null; timestamp = time }
    }
  }
}
