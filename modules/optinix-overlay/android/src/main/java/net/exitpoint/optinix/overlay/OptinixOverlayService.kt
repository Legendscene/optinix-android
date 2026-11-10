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
import android.util.Log
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors
import java.io.FileDescriptor
import java.io.PrintWriter

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
  private val hudPolicy = HudPolicy()
  private var pendingOpen = false
  private var sessionFpsEnabled: Boolean? = null
  private var fpsDefault = false
  private var lastHudLog = ""
  private var fpsWindow: FpsHudWindow? = null
  private val fpsOverrides = HashMap<String, Any?>()
  private var reason = "user stopped"
  private var profileResults = emptyList<Map<String, Any?>>()
  private val cpu = ArrayList<Double?>()
  private val ram = ArrayList<Double?>()
  private val markers = ArrayList<Map<String, Any?>>()

  private val screenOff = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_OFF) { reason = "screen locked"; Log.w("OptinixHUD", "stop: screen-off receiver"); stopSelf() }
    }
  }

  private val loop = object : Runnable {
    override fun run() {
      if (destroyed || sessionId.isEmpty()) return
      val token = generation
      if (!canDrawOverlays()) {
        window.hide()
        fpsWindow?.hide()
        OverlayBridge.error = OverlaySupport.reason(this@OptinixOverlayService)
      }
      worker.execute {
        val next = try { reader.sample() } catch (error: Exception) { Log.w("OptinixHUD", "Metric sample unavailable", error); emptyMap() }
        val current = foreground.read()
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
          if (detected != null && current != gamePackage && (gamePackage == null || store.config().optBoolean("autoDetectGames", false))) {
            finishCurrent("switched game")
            val detectedProfile = detected.optJSONObject("profile") ?: JSONObject()
            if (!store.config().optBoolean("overlayEnabled", true)) detectedProfile.put("overlay", false)
            begin(JSONObject().put("gamePackage", current).put("gameLabel", detected.optString("label")).put("profile", detectedProfile))
          }
          reconcileHud()
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
    hudPolicy.configure(store.config().optString("hudVisibility", "edge"))
    fpsDefault = store.config().optBoolean("fpsHudEnabled", false)
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
      else startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE)
    } catch (error: Exception) {
      OverlayBridge.error = error.message ?: "Android refused the foreground service."
      Log.w("OptinixHUD", "stop: startForeground refused: $error")
      stopSelf()
      return
    }
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
    else registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null || intent.action == ACTION_STOP) {
      Log.w("OptinixHUD", "stop: onStartCommand action=${intent?.action ?: "<null>"}")
      stopSelf()
      return START_NOT_STICKY
    }
    if (destroyed || hudPolicy.visibility == "disabled" || (intent.action != ACTION_START && sessionId.isEmpty())) {
      Log.w("OptinixHUD", "stop: precondition destroyed=$destroyed visibility=${hudPolicy.visibility} action=${intent.action}")
      stopSelf()
      return START_NOT_STICKY
    }
    if (intent.action == ACTION_STOP_MACRO) { macros.stop(); updateNotification(); return START_NOT_STICKY }
    if (intent.action == ACTION_SHOW_HUD) {
      val result = setOverlayVisible(true)
      window.setMessage(result["message"].toString())
      updateNotification()
      return START_NOT_STICKY
    }
    if (destroyed) return START_NOT_STICKY
    val config = try { JSONObject(intent.getStringExtra("config") ?: "{}") } catch (_: Exception) { JSONObject() }
    if (sessionId.isEmpty() || intent.getBooleanExtra("newSession", false)) {
      if (sessionId.isNotEmpty()) finishCurrent("new session")
      begin(config)
    }
    handler.removeCallbacks(loop)
    generation++
    handler.post(loop)
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun dump(fd: FileDescriptor, writer: PrintWriter, args: Array<out String>?) {
    writer.println("Optinix HUD diagnostics")
    writer.println("sdk=${Build.VERSION.SDK_INT} running=${!destroyed && sessionId.isNotEmpty()} intervalMs=$intervalMs")
    writer.println("visibility=${hudPolicy.visibility} requested=${hudPolicy.requested} explicitOpen=${hudPolicy.explicitOpen} pendingOpen=$pendingOpen")
    writer.println("foreground=$foregroundPackage game=$gamePackage usageAccess=${foreground.hasAccess()} overlayAccess=${canDrawOverlays()}")
    writer.println("showing=${OverlayBridge.showing} expanded=${OverlayBridge.expanded} statsEnabled=${fpsEnabled()} error=${OverlayBridge.error}")
    writer.println("sampledAt=${metrics["capturedAt"]} samples=${statistics.snapshot(clock.elapsed())["samples"]} durationMs=${clock.elapsed()}")
    writer.println("cpu=${metrics["cpuPercent"]} ram=${metrics["ramPercent"]} temp=${metrics["temperatureC"]} battery=${metrics["batteryPercent"]} displayHz=${metrics["refreshRate"]}")
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    window.reconfigure()
    fpsWindow?.applyConfig()
  }

  override fun onDestroy() {
    destroyed = true
    Log.w("OptinixHUD", "destroy: session=$sessionId game=$gamePackage reason=$reason at=${Throwable().stackTraceToString().lines().take(6)}")
    handler.removeCallbacksAndMessages(null)
    if (::macros.isInitialized) macros.stop("Gaming session ended")
    NetworkDiagnostics.cancel()
    CaptureService.stop(this)
    worker.shutdownNow()
    if (::window.isInitialized) window.hide()
    fpsWindow?.hide()
    fpsWindow = null
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
    hudPolicy.begin(false)
    pendingOpen = false
    sessionFpsEnabled = null
    fpsOverrides.clear()
    window.hide()
    window.clearSessionOpacity()
    window.resetSession()
    fpsWindow?.clearSession()
    fpsWindow?.hide()
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
      hudPolicy.request(true)
      val allowed = canDrawOverlays()
      val message = when {
        !allowed -> OverlaySupport.reason(this) ?: "Overlay access unavailable."
        hudPolicy.visibility == "notification" -> "Notification-only mode. Use Show game HUD in the session notification."
        else -> "The edge handle appears over library games. Tap or swipe to open."
      }
      results.add(GamingActions.result(allowed, message, if (allowed) "applied" else "permission") + mapOf("setting" to "overlay"))
    } else {
      hudPolicy.request(false)
      pendingOpen = false
      window.hide()
      results.add(GamingActions.result(true, "HUD off") + mapOf("setting" to "overlay"))
    }
    if (next["dnd"] == true) results.add(setDnd(true) + mapOf("setting" to "dnd"))
    else if (store.preferences.getBoolean("sessionDnd", false)) results.add(setDnd(false) + mapOf("setting" to "dnd"))
    results.add(GamingActions.result(false, "Use the game or manufacturer controls for graphics, FPS and performance mode.", "user-action") + mapOf("setting" to "game-performance"))
    profileResults = results
    val message = "${next["name"] ?: "Custom profile"}: Optinix controls applied; permission/manual items are listed separately."
    window.setMessage(message)
    window.render(session(), metrics, cpu, ram)
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
    val previousVisibility = hudPolicy.visibility
    hudPolicy.configure(store.config().optString("hudVisibility", "edge"))
    if (hudPolicy.visibility == "disabled") {
      reason = "overlay disabled in Settings"
      pendingOpen = false
      generation++
      handler.removeCallbacks(loop)
      window.hide()
      fpsWindow?.hide()
      stopSelf()
      return
    }
    if (previousVisibility != hudPolicy.visibility) { pendingOpen = false; window.hide() }
    val configuredFps = store.config().optBoolean("fpsHudEnabled", false)
    if (configuredFps != fpsDefault) { sessionFpsEnabled = null; fpsDefault = configuredFps }
    if (resetOpacity) window.clearSessionOpacity()
    if (!store.config().optBoolean("macroEnabled", false)) macros.stop("Macro functionality disabled")
    intervalMs = profile.optLong("intervalMs", store.config().optLong("intervalMs", intervalMs)).coerceIn(2000, 30000)
    if (store.config().optBoolean("batteryConscious")) intervalMs = maxOf(intervalMs, 5000)
    window.reconfigure()
    fpsWindow?.applyConfig()
    reconcileHud()
    updateNotification()
  }

  fun resetPosition() { fpsWindow?.resetCorner(); window.resetPosition() }
  fun setHandleSide(right: Boolean) { window.setSide(right) }
  fun collapse() {
    pendingOpen = false
    hudPolicy.collapse()
    if (hudPolicy.visibility == "notification") { window.hide(); fpsWindow?.hide() }
    else window.setExpanded(false)
    reconcileHud()
  }
  fun setExpanded(value: Boolean) { if (value) setOverlayVisible(true) else collapse() }

  fun setOverlayVisible(visible: Boolean): Map<String, Any?> {
    if (visible) {
      if (!canDrawOverlays()) return GamingActions.result(false, OverlaySupport.reason(this) ?: "Overlay access unavailable.", "user-action")
      if (!hudPolicy.reopen()) return GamingActions.result(false, "Change HUD visibility from Disabled in Settings first.", "user-action")
      pendingOpen = true
      reconcileHud()
    } else {
      hudPolicy.request(false)
      pendingOpen = false
      window.hide()
      if (hudPolicy.visibility == "notification") fpsWindow?.hide()
    }
    return GamingActions.result(
      true,
      if (visible) "HUD requested. Return to a library game to open the dashboard."
      else "HUD hidden. Reopen it from the session notification or Gaming tools."
    )
  }
  fun runtime(): Map<String, Any?> = mapOf("running" to !destroyed, "session" to session(), "metrics" to metrics, "macro" to macros.state(), "showing" to OverlayBridge.showing, "settings" to profileResults, "hudVisibility" to hudPolicy.visibility, "fpsHudEnabled" to fpsEnabled())

  private fun session(): Map<String, Any?> = statistics.snapshot(clock.elapsed()) + mapOf(
    "id" to sessionId, "gamePackage" to gamePackage, "gameLabel" to gameLabel,
    "foregroundPackage" to foregroundPackage, "foregroundLabel" to foregroundLabel,
    "startedAt" to startedAt, "endedAt" to System.currentTimeMillis(), "durationMs" to clock.elapsed(),
    "paused" to clock.paused, "profileName" to profile.optString("name", "Balanced"),
    "profileShort" to profile.optString("short", "").ifBlank { profile.optString("name", "Balanced") },
    "profileId" to profile.optString("id", "balanced"),
    "fpsHudEnabled" to fpsEnabled(),
    "intervalMs" to intervalMs, "reminderMinutes" to reminderMinutes, "fpsHud" to fpsOverrides.toMap(),
    "macro" to macros.state(), "markers" to markers.toList(), "interrupted" to false
  )

  private fun finishCurrent(why: String) {
    macros.stop("Session ended")
    store.finish(session() + mapOf("reason" to why))
  }

  private fun canDrawOverlays() = OverlaySupport.canDraw(this)
  private fun fpsEnabled() = sessionFpsEnabled ?: store.config().optBoolean("fpsHudEnabled", false)
  private fun foregroundGame() = foregroundPackage != null &&
    (foregroundPackage == gamePackage || store.games().any { it.optString("packageName") == foregroundPackage && it.optBoolean("installed", true) })

  private fun reconcileHud() {
    val allowed = hudPolicy.controlAllowed(foregroundGame(), canDrawOverlays())
    if (allowed) {
      if (!OverlayBridge.showing) window.show(pendingOpen || hudPolicy.visibility == "notification")
      else if (pendingOpen) window.setExpanded(true)
      if (OverlayBridge.showing) { pendingOpen = false; OverlayBridge.error = null }
    } else {
      window.hide()
      if (!pendingOpen) hudPolicy.collapse()
    }
    if (fpsEnabled() && hudPolicy.statsAllowed(foregroundGame(), canDrawOverlays()) && !OverlayBridge.expanded) {
      val hud = fpsWindow ?: FpsHudWindow(this, store).also {
        it.setSession(fpsOverrides)
        fpsWindow = it
      }
      hud.show()
      hud.render(metrics)
    } else fpsWindow?.hide()
    val log = "wantHud=${hudPolicy.requested} vis=${hudPolicy.visibility} open=${hudPolicy.explicitOpen} game=$gamePackage current=$foregroundPackage showing=${OverlayBridge.showing} allowed=$allowed err=${OverlayBridge.error}"
    if (log != lastHudLog) { Log.i("OptinixHUD", log); lastHudLog = log }
  }

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
      action == "stop" -> { Log.w("OptinixHUD", "stop: panel action"); stopSelf() }
      action == "collapse" -> collapse()
      action == "expand" -> reconcileHud()
      action == "timer" -> timerAction("toggle")
      action.startsWith("mode:") -> {
        val profileId = OverlayDashboard.profileForMode(action.substringAfter(':'))
        val list = store.config().optJSONArray("profiles")
        var applied = false
        if (profileId != null && list != null) {
          for (i in 0 until list.length()) {
            val item = list.optJSONObject(i) ?: continue
            if (item.optString("id") == profileId) {
              applyProfile(item.toValues())
              applied = true
              break
            }
          }
        }
        if (!applied) window.setMessage("That Optinix profile is not available on this device. Check Settings → Game profiles.")
      }
      action.startsWith("bright:") -> {
        val fraction = action.substringAfter(':').toFloatOrNull() ?: 0.5f
        window.setMessage(OverlaySystem.setBrightness(this, fraction)["message"].toString())
      }
      action == "rotate" -> {
        val locked = OverlaySystem.rotationLocked(this) == true
        window.setMessage(OverlaySystem.setRotationLock(this, !locked)["message"].toString())
      }
      action == "fps:toggle" -> {
        sessionFpsEnabled = !fpsEnabled()
        reconcileHud()
        window.setMessage(
          if (fpsEnabled()) "Stats HUD on for this session. Game FPS itself stays unmeasurable."
          else "Stats HUD off for this session."
        )
      }
      action.startsWith("fps:mode:") -> {
        fpsOverrides["fpsHudMode"] = action.substringAfterLast(':').takeIf { it in setOf("minimal", "compact", "detailed") } ?: "minimal"
        applyFpsOverrides()
      }
      action.startsWith("fps:corner:") -> {
        fpsOverrides["fpsHudCorner"] = action.substringAfterLast(':')
          .takeIf { it in setOf("topLeft", "topRight", "bottomLeft", "bottomRight") } ?: "topLeft"
        applyFpsOverrides()
      }
      action.startsWith("fps:scale:") -> {
        fpsOverrides["fpsHudScale"] = (action.substringAfterLast(':').toDoubleOrNull() ?: 1.0).coerceIn(0.7, 1.6)
        applyFpsOverrides()
      }
      action.startsWith("fps:opacity:") -> {
        fpsOverrides["fpsHudOpacity"] = (action.substringAfterLast(':').toDoubleOrNull() ?: 0.9).coerceIn(0.4, 1.0)
        applyFpsOverrides()
      }
      action.startsWith("fps:metric:") -> {
        val id = action.substringAfterLast(':')
        val allowed = setOf("cpu", "ram", "temp", "battery", "refresh")
        if (id in allowed) {
          val current = (fpsOverrides["fpsHudMetrics"] as? List<*>)?.filterIsInstance<String>()?.toMutableList()
            ?: store.config().optJSONArray("fpsHudMetrics")?.let { array ->
              (0 until array.length()).mapNotNull { array.optString(it) }.toMutableList()
            }
            ?: allowed.toMutableList()
          if (current.contains(id)) current.remove(id) else current.add(id)
          fpsOverrides["fpsHudMetrics"] = current.filter { it in allowed }.distinct().take(5)
        }
        applyFpsOverrides()
      }
      action == "processes" || action == "startup" || action == "macros" -> {
        collapse()
        window.setMessage(GamingActions.openSettings(this, action)["message"].toString())
      }
      action == "stop_macro" -> stopMacro()
      action == "dnd" -> {
        val dnd = DndController(this)
        val result = if (Build.VERSION.SDK_INT < 29) GamingActions.openSettings(this, "dnd") else if (!dnd.access()) GamingActions.openSettings(this, "dnd-access") else setDnd(!dnd.active())
        window.setMessage(result["message"].toString())
      }
      action in setOf("display", "app", "appmgmt", "network-settings", "battery", "hud-settings", "write", "notifications") -> {
        collapse()
        window.setMessage(GamingActions.openSettings(this, action)["message"].toString())
      }
      action == "screenshot" || action == "record" -> {
        collapse()
        if (action == "record" && CaptureService.recording) CaptureService.stop(this)
        else window.setMessage(CaptureConsentActivity.request(this, if (action == "record") "record" else "screenshot")["message"].toString())
      }
      action == "memory" -> window.setMessage(OverlayTools(this).boost())
      action == "boost" -> runTool { OverlayTools(this).boost() }
      action == "cache" -> runTool { OverlayTools(this).clearCache() }
      action == "network" -> runTool(network = true) {
        val result = NetworkDiagnostics.diagnose(this, mapOf("target" to store.config().optString("networkTarget", "https://www.gstatic.com/generate_204"), "samples" to 3))
        val avg = result["averageMs"] as? Number
        val text = if (avg == null) result["message"]?.toString() ?: "No successful probe." else "HTTPS ${avg.toInt()} ms; jitter ${(result["jitterMs"] as? Number)?.toInt() ?: "--"} ms. Not game-server ping."
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
      action == "dock:left" -> window.setDock(false)
      action == "dock:right" -> window.setDock(true)
      action == "side:left" -> window.setSide(false)
      action == "side:right" -> window.setSide(true)
      action == "fps:on" -> {
        sessionFpsEnabled = true
        reconcileHud()
        window.setMessage("Stats HUD on for this session. Game FPS itself stays unmeasurable.")
      }
      action == "fps:off" -> {
        sessionFpsEnabled = false
        fpsWindow?.hide()
        window.setMessage("Stats HUD off for this session.")
      }
    }
    window.render(session(), metrics, cpu, ram)
  }

  /** Apply panel-side appearance changes to the stats HUD without touching
   *  the user's saved Settings values. */
  private fun applyFpsOverrides() {
    val hud = fpsWindow ?: FpsHudWindow(this, store).also {
      it.setSession(fpsOverrides)
      fpsWindow = it
    }
    hud.setSession(fpsOverrides)
    if (fpsEnabled()) reconcileHud() else fpsWindow?.hide()
    window.setMessage("Stats HUD appearance updated for this session.")
    window.render(session(), metrics, cpu, ram)
  }

  private fun runTool(network: Boolean = false, operation: () -> String) {
    if (toolBusy) { window.setMessage("An action is already running."); return }
    toolBusy = true
    window.setMessage("Working…")
    worker.execute {
      val result = try { operation() } catch (error: Exception) { error.message ?: "Action failed." }
      handler.post { if (!destroyed) { toolBusy = false; if (network) window.setNetworkResult(result) else window.setMessage(result) } }
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
    if (hudPolicy.visibility != "disabled" && canDrawOverlays()) {
      val showHud = PendingIntent.getService(this, 3, Intent(this, OptinixOverlayService::class.java).setAction(ACTION_SHOW_HUD), flags)
      builder.addAction(Notification.Action.Builder(null, "Show game HUD", showHud).build())
    }
    builder.addAction(Notification.Action.Builder(null, "Stop session", stop).build())
    if (::macros.isInitialized && macros.state()["status"] == "running") builder.addAction(Notification.Action.Builder(null, "Stop macro", cancelMacro).build())
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
    const val ACTION_SHOW_HUD = "net.exitpoint.optinix.overlay.SHOW_HUD"
    private const val CHANNEL = "optinix_gaming"
    private const val NOTIFICATION_ID = 47821
    @Volatile var instance: OptinixOverlayService? = null
      private set
    fun startIntent(context: Context): Intent = Intent(context, OptinixOverlayService::class.java).setAction(ACTION_START)
  }
}
