package net.exitpoint.optinix.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

class OptinixOverlayService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private lateinit var store: GamingStore
  private lateinit var reader: OverlayMetrics
  private lateinit var foreground: ForegroundGameReader
  private lateinit var window: OverlayWindow
  private lateinit var macros: MacroRunner
  private var clock = SessionClock { SystemClock.elapsedRealtime() }
  private var statistics = OverlaySession()
  private var sessionId = ""
  private var startedAt = 0L
  private var gamePackage: String? = null
  private var gameLabel = "Gaming session"
  private var foregroundPackage: String? = null
  private var foregroundLabel: String? = null
  private var profile = JSONObject()
  private var metrics: Map<String, Any?> = emptyMap()
  private var intervalMs = 5000L
  private var reminderMinutes = 0
  private var lastReminder = 0L
  private var lastCheckpoint = 0L
  private var destroyed = false
  private var generation = 0
  private var toolBusy = false
  private var wantHud = false
  private var reason = "user stopped"
  private var profileResults = emptyList<Map<String, Any?>>()
  private val cpu = ArrayList<Double?>()
  private val ram = ArrayList<Double?>()
  private val markers = ArrayList<Map<String, Any?>>()

  private val screenOff = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) { if (intent?.action == Intent.ACTION_SCREEN_OFF) { reason = "screen locked"; stopSelf() } }
  }

  private val loop = object : Runnable {
    override fun run() {
      if (destroyed || sessionId.isEmpty()) return
      val token = generation
      if (OverlayBridge.showing && !Settings.canDrawOverlays(this@OptinixOverlayService)) {
        window.hide()
        OverlayBridge.error = "Overlay permission was revoked. Session timer remains available in the app."
      }
      worker.execute {
        val next = try { reader.sample() } catch (error: Exception) { Log.w("OptinixHUD", "Metric sample unavailable", error); emptyMap() }
        val current = if (store.config().optBoolean("autoDetectGames", false) || gamePackage != null) foreground.read() else null
        handler.post {
          if (destroyed || token != generation) return@post
          metrics = next
          foregroundPackage = current
          foregroundLabel = current?.let { pkg ->
            try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() } catch (_: Exception) { pkg }
          }
          if (!clock.paused) {
            statistics.add(next, clock.elapsed())
            cpu.add((next["cpuPercent"] as? Number)?.toDouble()); ram.add((next["ramPercent"] as? Number)?.toDouble())
            if (cpu.size > 44) { cpu.removeAt(0); ram.removeAt(0) }
          }
          val detected = store.games().find { it.optString("packageName") == current && it.optBoolean("installed", true) }
          if (detected != null && current != gamePackage) {
            finishCurrent("switched game")
            val detectedProfile = detected.optJSONObject("profile") ?: JSONObject()
            if (!store.config().optBoolean("overlayEnabled", true)) detectedProfile.put("overlay", false)
            begin(JSONObject().put("gamePackage", current).put("gameLabel", detected.optString("label")).put("profile", detectedProfile))
          }
          val hudAllowed = canDrawOverlays() && wantHud && current != null &&
            (current == gamePackage || detected != null)
          Log.i("OptinixHUD", "loop wantHud=$wantHud current=$current game=$gamePackage overlays=${canDrawOverlays()} showing=${OverlayBridge.showing} allowed=$hudAllowed err=${OverlayBridge.error}")
          if (hudAllowed && !OverlayBridge.showing) {
            OverlayBridge.error = null
            if (!window.show()) Log.w("OptinixHUD", "show() refused: ${OverlayBridge.error ?: "unknown"}")
          }
          if (!hudAllowed && OverlayBridge.showing) {
            Log.i("OptinixHUD", "hide: hudAllowed flipped false")
            window.hide()
            OverlayBridge.error = "HUD hidden — it only appears while a game from your library is in the foreground."
          }
          if (reminderMinutes > 0 && !clock.paused && clock.elapsed() - lastReminder >= reminderMinutes * 60_000L) {
            lastReminder = clock.elapsed()
            remind()
          }
          val summary = session()
          window.render(summary, metrics, cpu, ram)
          if (SystemClock.elapsedRealtime() - lastCheckpoint >= 10_000L) {
            lastCheckpoint = SystemClock.elapsedRealtime()
            store.checkpoint(summary)
            updateNotification()
          }
          handler.postDelayed(this, intervalMs)
        }
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    store = GamingStore(this)
    store.recoverInterrupted()
    if (store.preferences.getBoolean("sessionDnd", false)) {
      DndController(this).set(false)
      store.preferences.edit().putBoolean("sessionDnd", false).apply()
    }
    reader = OverlayMetrics(this)
    foreground = ForegroundGameReader(this)
    window = OverlayWindow(this, ::performAction)
    macros = MacroRunner(::macroAction)
    instance = this
    createChannels()
    try {
      if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      else startForeground(NOTIFICATION_ID, notification())
    } catch (error: Exception) {
      OverlayBridge.error = error.message ?: "Android refused the foreground service."
      stopSelf()
      return
    }
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
    else registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null || intent.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
    if (intent.action == ACTION_STOP_MACRO) { macros.stop(); updateNotification(); return START_NOT_STICKY }
    if (destroyed) return START_NOT_STICKY
    val config = try { JSONObject(intent.getStringExtra("config") ?: "{}") } catch (_: Exception) { JSONObject() }
    if (sessionId.isEmpty() || intent.getBooleanExtra("newSession", false)) {
      if (sessionId.isNotEmpty()) finishCurrent("new session")
      begin(config)
    }
    if (config.optBoolean("showOverlay", false)) wantHud = true
    handler.removeCallbacks(loop)
    generation++
    handler.post(loop)
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onConfigurationChanged(newConfig: Configuration) { super.onConfigurationChanged(newConfig); window.reconfigure() }

  override fun onDestroy() {
    destroyed = true
    handler.removeCallbacksAndMessages(null)
    if (::macros.isInitialized) macros.stop("Gaming session ended")
    NetworkDiagnostics.cancel()
    CaptureService.stop(this)
    worker.shutdownNow()
    if (::window.isInitialized) window.hide()
    try { unregisterReceiver(screenOff) } catch (_: Exception) {}
    if (::store.isInitialized && sessionId.isNotEmpty()) finishCurrent(reason)
    if (::store.isInitialized && store.preferences.getBoolean("sessionDnd", false)) {
      DndController(this).set(false)
      store.preferences.edit().putBoolean("sessionDnd", false).apply()
    }
    instance = null
    OverlayBridge.showing = false
    OverlayBridge.expanded = false
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun begin(config: JSONObject) {
    macros.stop("New session")
    clock = SessionClock { SystemClock.elapsedRealtime() }
    statistics = OverlaySession()
    cpu.clear(); ram.clear(); markers.clear()
    sessionId = UUID.randomUUID().toString()
    startedAt = System.currentTimeMillis()
    gamePackage = config.optString("gamePackage").takeIf { it.isNotBlank() }
    gameLabel = config.optString("gameLabel", "Gaming session").take(120)
    lastReminder = 0
    applyProfile(config.optJSONObject("profile")?.toValues() ?: mapOf("id" to "balanced", "name" to "Balanced", "intervalMs" to store.config().optLong("intervalMs", 5000), "reminderMinutes" to store.config().optInt("reminderMinutes", 0), "overlay" to config.optBoolean("showOverlay", false)))
    store.checkpoint(session())
    updateNotification()
  }

  fun applyProfile(next: Map<String, Any?>): Map<String, Any?> {
    profile = JSONObject(next)
    intervalMs = ((next["intervalMs"] as? Number)?.toLong() ?: 5000L).coerceIn(2000L, 30000L)
    if (store.config().optBoolean("batteryConscious")) intervalMs = maxOf(intervalMs, 5000L)
    reminderMinutes = ((next["reminderMinutes"] as? Number)?.toInt() ?: 0).coerceIn(0, 120)
    val results = ArrayList<Map<String, Any?>>()
    results.add(GamingActions.result(true, "Optinix sampling every ${intervalMs / 1000}s") + mapOf("setting" to "sampling"))
    results.add(GamingActions.result(true, if (reminderMinutes > 0) "Break reminder every $reminderMinutes minutes" else "Break reminders off") + mapOf("setting" to "reminders"))
    if (next["overlay"] == true) {
      wantHud = true
      val allowed = Settings.canDrawOverlays(this)
      results.add(GamingActions.result(allowed, if (allowed) "Floating HUD appears while the game is in the foreground" else "Enable overlay access in Android settings — the timer runs without it", if (allowed) "applied" else "permission") + mapOf("setting" to "overlay"))
    } else {
      wantHud = false
      window.hide()
      results.add(GamingActions.result(true, "HUD off") + mapOf("setting" to "overlay"))
    }
    if (next["dnd"] == true) results.add(setDnd(true) + mapOf("setting" to "dnd"))
    else if (store.preferences.getBoolean("sessionDnd", false)) results.add(setDnd(false) + mapOf("setting" to "dnd"))
    results.add(GamingActions.result(false, "Use the game or manufacturer controls for graphics, FPS and performance mode.", "user-action") + mapOf("setting" to "game-performance"))
    profileResults = results
    val message = "${next["name"] ?: "Custom profile"}: Optinix controls applied; permission/manual items are listed separately."
    window.setMessage(message)
    return GamingActions.result(true, message) + mapOf("settings" to results)
  }

  fun setDnd(enabled: Boolean): Map<String, Any?> {
    val result = DndController(this).set(enabled)
    if (result["ok"] == true) store.preferences.edit().putBoolean("sessionDnd", enabled).apply()
    return result
  }

  fun timerAction(action: String): Map<String, Any?> {
    when (action) {
      "pause" -> clock.pause()
      "resume" -> clock.resume()
      "toggle" -> if (clock.paused) clock.resume() else clock.pause()
      "stop" -> stopSelf()
      else -> return GamingActions.result(false, "Unknown timer action.")
    }
    if (clock.paused) statistics.invalidateDrain()
    window.render(session(), metrics, cpu, ram)
    updateNotification()
    return GamingActions.result(true, if (clock.paused) "Session timer paused." else "Session timer running.")
  }

  fun startMacro(raw: Map<String, Any?>): Map<String, Any?> {
    if (!store.config().optBoolean("macroEnabled", false)) return GamingActions.result(false, "Enable utility macros in Macro Studio first.", "user-action")
    return try {
      val spec = MacroSpec.parse(raw)
      val started = macros.start(spec)
      updateNotification()
      window.render(session(), metrics, cpu, ram)
      GamingActions.result(started, if (started) "Running ${spec.name}. Use Stop macro to cancel." else "Stop the current macro before starting another.")
    } catch (error: Exception) { GamingActions.result(false, error.message ?: "Invalid macro.") }
  }

  fun stopMacro(): Map<String, Any?> {
    val wasRunning = macros.state()["status"] == "running"
    macros.stop(); updateNotification(); window.render(session(), metrics, cpu, ram)
    return GamingActions.result(true, if (wasRunning) "Macro cancelled." else "No macro is running.")
  }

  fun reconfigure(resetOpacity: Boolean = false) {
    if (resetOpacity) window.clearSessionOpacity()
    if (!store.config().optBoolean("macroEnabled", false)) macros.stop("Macro functionality disabled")
    intervalMs = profile.optLong("intervalMs", store.config().optLong("intervalMs", intervalMs)).coerceIn(2000, 30000)
    if (store.config().optBoolean("batteryConscious")) intervalMs = maxOf(intervalMs, 5000)
    window.reconfigure()
  }

  fun resetPosition() = window.resetPosition()
  fun collapse() = window.setExpanded(false)
  fun setExpanded(value: Boolean) = window.setExpanded(value)
  fun runtime(): Map<String, Any?> = mapOf("running" to true, "session" to session(), "metrics" to metrics, "macro" to macros.state(), "showing" to OverlayBridge.showing, "settings" to profileResults)

  private fun session(): Map<String, Any?> = statistics.snapshot(clock.elapsed()) + mapOf(
    "id" to sessionId, "gamePackage" to gamePackage, "gameLabel" to gameLabel,
    "foregroundPackage" to foregroundPackage, "foregroundLabel" to foregroundLabel,
    "startedAt" to startedAt, "endedAt" to System.currentTimeMillis(), "durationMs" to clock.elapsed(),
    "paused" to clock.paused, "profileName" to profile.optString("name", "Balanced"),
    "profileShort" to profile.optString("short", "").ifBlank { profile.optString("name", "Balanced") },
    "profileId" to profile.optString("id", "balanced"),
    "macro" to macros.state(), "markers" to markers.toList(), "interrupted" to false
  )

  private fun finishCurrent(why: String) {
    macros.stop("Session ended")
    store.finish(session() + mapOf("reason" to why))
  }

  private fun canDrawOverlays() = Settings.canDrawOverlays(this)

  private fun macroAction(step: MacroStep): String? {
    when (step.type) {
      "haptic" -> {
        if (!store.config().optBoolean("haptics", true)) return "Haptic feedback is disabled in Settings."
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return "This device has no vibrator."
        if (!vibrator.hasVibrator()) return "This device has no vibrator."
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
        else @Suppress("DEPRECATION") vibrator.vibrate(30)
      }
      "marker" -> {
        if (markers.size >= 100) return "This session reached its 100-marker limit. Start a new session for more markers."
        markers.add(mapOf("label" to step.label, "elapsedMs" to clock.elapsed()))
      }
      "pause_timer" -> { clock.pause(); statistics.invalidateDrain() }
      "resume_timer" -> clock.resume()
      "collapse_overlay" -> { if (!OverlayBridge.showing) return "HUD is not displayed."; collapse() }
      else -> return "Unsupported macro action."
    }
    return null
  }

  private fun performAction(action: String) {
    when {
      action == "stop" -> stopSelf()
      action == "collapse" -> collapse()
      action == "timer" -> timerAction("toggle")
      action == "stop_macro" -> stopMacro()
      action == "dnd" -> {
        val dnd = DndController(this)
        val result = if (Build.VERSION.SDK_INT < 29) GamingActions.openSettings(this, "dnd") else if (!dnd.access()) GamingActions.openSettings(this, "dnd-access") else setDnd(!dnd.active())
        window.setMessage(result["message"].toString())
      }
      action == "display" || action == "app" -> {
        collapse()
        window.setMessage(GamingActions.openSettings(this, action)["message"].toString())
      }
      action == "screenshot" || action == "record" -> {
        collapse()
        if (action == "record" && CaptureService.recording) CaptureService.stop(this)
        else window.setMessage(CaptureConsentActivity.request(this, if (action == "record") "record" else "screenshot")["message"].toString())
      }
      action == "memory" -> window.setMessage(OverlayTools(this).boost())
      action == "cache" -> runTool { OverlayTools(this).clearCache() }
      action == "network" -> runTool {
        val result = NetworkDiagnostics.diagnose(this, mapOf("target" to store.config().optString("networkTarget", "https://www.gstatic.com/generate_204"), "samples" to 3))
        val avg = result["averageMs"] as? Number
        val text = if (avg == null) result["message"]?.toString() ?: "No successful probe." else "HTTPS ${avg.toInt()} ms; jitter ${(result["jitterMs"] as? Number)?.toInt() ?: "--"} ms. Not game-server ping."
        window.setNetworkResult(text)
        text
      }
      action.startsWith("profile:") -> {
        val list = store.config().optJSONArray("profiles")
        if (list != null) for (i in 0 until list.length()) {
          val item = list.optJSONObject(i) ?: continue
          if (item.optString("id") == action.substringAfter(':')) { applyProfile(item.toValues()); break }
        }
      }
      action.startsWith("macro:") -> {
        val macro = store.macros().find { it.optString("id") == action.substringAfter(':') }
        window.setMessage(if (macro == null) "Macro no longer exists." else startMacro(macro.toValues())["message"].toString())
      }
      action.startsWith("opacity:") -> {
        window.setSessionOpacity(action.substringAfter(':').toDoubleOrNull() ?: 0.94)
        window.setMessage("Handle opacity changed for this session. Save your default in Settings.")
      }
      action == "reset_position" -> resetPosition()
    }
  }

  private fun runTool(operation: () -> String) {
    if (toolBusy) { window.setMessage("An action is already running."); return }
    toolBusy = true
    window.setMessage("Working…")
    worker.execute {
      val result = try { operation() } catch (error: Exception) { error.message ?: "Action failed." }
      handler.post { if (!destroyed) { toolBusy = false; window.setMessage(result) } }
    }
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Gaming session controls", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
    manager.createNotificationChannel(NotificationChannel("optinix_breaks", "Optional break reminders", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
  }

  private fun notification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val stop = PendingIntent.getService(this, 1, Intent(this, OptinixOverlayService::class.java).setAction(ACTION_STOP), flags)
    val cancelMacro = PendingIntent.getService(this, 2, Intent(this, OptinixOverlayService::class.java).setAction(ACTION_STOP_MACRO), flags)
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    builder.setSmallIcon(android.R.drawable.ic_menu_compass).setContentTitle("Optinix • $gameLabel")
      .setContentText("${OverlayWindow.duration(clock.elapsed())}${if (clock.paused) " paused" else " session"} • Tap Stop to end tools")
      .setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE)
      .addAction(Notification.Action.Builder(null, "Stop session", stop).build())
      .addAction(Notification.Action.Builder(null, "Stop macro", cancelMacro).build())
    if (launch != null) builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, flags))
    return builder.build()
  }

  private fun updateNotification() { try { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification()) } catch (_: Exception) {} }
  private fun remind() {
    window.setMessage("You've played for ${clock.elapsed() / 60_000L} minutes. Ready for a break?")
    if (!store.config().optBoolean("notifications", false)) return
    try {
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "optinix_breaks") else @Suppress("DEPRECATION") Notification.Builder(this)
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(47822, builder.setSmallIcon(android.R.drawable.ic_menu_recent_history).setContentTitle("Time for a break?").setContentText("Your Optinix session has reached ${clock.elapsed() / 60_000L} minutes.").setAutoCancel(true).build())
    } catch (_: Exception) {}
  }

  companion object {
    const val ACTION_START = "net.exitpoint.optinix.overlay.START"
    const val ACTION_STOP = "net.exitpoint.optinix.overlay.STOP"
    const val ACTION_STOP_MACRO = "net.exitpoint.optinix.overlay.STOP_MACRO"
    private const val CHANNEL = "optinix_gaming"
    private const val NOTIFICATION_ID = 47821
    @Volatile var instance: OptinixOverlayService? = null
      private set
    fun startIntent(context: Context): Intent = Intent(context, OptinixOverlayService::class.java).setAction(ACTION_START)
  }
}
