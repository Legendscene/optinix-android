package net.exitpoint.optinix.overlay

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class OptinixOverlayModule : Module() {
  private fun context(): Context = appContext.reactContext ?: throw IllegalStateException("React context is unavailable")
  private fun store() = GamingStore(context())
  private fun service() = OptinixOverlayService.instance

  override fun definition() = ModuleDefinition {
    Name("OptinixOverlay")
    Constant("isSupported") { true }

    OnCreate {
      try {
        if (service() == null) {
          store().recoverInterrupted()
          if (store().preferences.getBoolean("sessionDnd", false)) {
            DndController(context()).set(false)
            store().preferences.edit().putBoolean("sessionDnd", false).apply()
          }
        }
        if (!CaptureService.active) CaptureRepository(context()).recover()
      } catch (_: Exception) {}
    }

    AsyncFunction("hasPermission") { Settings.canDrawOverlays(context()) }
    AsyncFunction("requestPermission") { GamingActions.openSettings(context(), "overlay")["ok"] == true }.runOnQueue(Queues.MAIN)
    AsyncFunction("start") { config: Map<String, Any?>, promise: Promise ->
      if (!Settings.canDrawOverlays(context())) promise.resolve(false)
      else start(config + mapOf("showOverlay" to true), false, promise, true)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("setConfig") { config: Map<String, Any?> -> configure(config); true }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { context().stopService(Intent(context(), OptinixOverlayService::class.java)); true }.runOnQueue(Queues.MAIN)
    AsyncFunction("getState") {
      mapOf("showing" to OverlayBridge.showing, "expanded" to OverlayBridge.expanded, "hasPermission" to Settings.canDrawOverlays(context()), "error" to OverlayBridge.error)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("configureGaming") { config: Map<String, Any?> -> configure(config); GamingActions.result(true, "Gaming preferences saved on this device.") }.runOnQueue(Queues.MAIN)
    AsyncFunction("getCapabilities") {
      val notifications = context().getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      mapOf(
        "sdkInt" to Build.VERSION.SDK_INT,
        "overlay" to Settings.canDrawOverlays(context()),
        "usageAccess" to ForegroundGameReader(context()).hasAccess(),
        "notifications" to (notifications.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33 || context().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)),
        "dndSupported" to (Build.VERSION.SDK_INT >= 29),
        "dndAccess" to DndController(context()).access(),
        "dndActive" to DndController(context()).active(),
        "captureAvailable" to true,
        "crossAppInput" to false,
        "gameFps" to false,
        "cpuLoad" to "device-dependent"
      )
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("getRuntime") {
      (service()?.runtime() ?: mapOf("running" to false, "session" to null, "metrics" to null, "macro" to null, "showing" to false)) + mapOf("capture" to CaptureService.state(), "error" to OverlayBridge.error)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("startSession") { config: Map<String, Any?>, promise: Promise -> start(config, true, promise, false) }.runOnQueue(Queues.MAIN)
    AsyncFunction("endSession") {
      context().stopService(Intent(context(), OptinixOverlayService::class.java))
      GamingActions.result(true, "Gaming session stopped.")
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("timerAction") { action: String -> service()?.timerAction(action) ?: noSession() }.runOnQueue(Queues.MAIN)
    AsyncFunction("applyProfile") { profile: Map<String, Any?> -> service()?.applyProfile(profile) ?: noSession() }.runOnQueue(Queues.MAIN)
    AsyncFunction("getSessionHistory") { store().history() }
    AsyncFunction("clearSessionHistory") { store().clearHistory(); GamingActions.result(true, "Session history cleared.") }
    AsyncFunction("setDnd") { enabled: Boolean ->
      service()?.setDnd(enabled) ?: if (!enabled) DndController(context()).set(false) else noSession()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("openGamingSettings") { target: String -> GamingActions.openSettings(context(), target) }.runOnQueue(Queues.MAIN)
    AsyncFunction("requestCapture") { mode: String -> CaptureConsentActivity.request(context(), mode) }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopCapture") { CaptureService.stop(context()); GamingActions.result(true, "Capture stop requested.") }.runOnQueue(Queues.MAIN)
    AsyncFunction("getCaptures") { CaptureRepository(context()).list() }
    AsyncFunction("openCapture") { id: String -> CaptureRepository(context()).open(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("deleteCapture") { id: String -> CaptureRepository(context()).delete(id) }
    AsyncFunction("startMacro") { macro: Map<String, Any?> -> service()?.startMacro(macro) ?: noSession() }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopMacro") { service()?.stopMacro() ?: GamingActions.result(true, "No macro is running.") }.runOnQueue(Queues.MAIN)
    AsyncFunction("diagnoseNetwork") { config: Map<String, Any?> -> NetworkDiagnostics.diagnose(context(), config) }
    AsyncFunction("cancelDiagnostics") { NetworkDiagnostics.cancel(); GamingActions.result(true, "Diagnostic cancellation requested.") }.runOnQueue(Queues.MAIN)
    AsyncFunction("resetOverlayPosition") {
      store().preferences.edit().remove("dockPortrait").remove("dockLandscape").remove("yPortrait").remove("yLandscape").apply()
      service()?.resetPosition()
      GamingActions.result(true, "Overlay position reset.")
    }.runOnQueue(Queues.MAIN)
  }

  private fun noSession() = GamingActions.result(false, "Start a gaming session or timer first.", "user-action")

  private fun configure(raw: Map<String, Any?>) {
    val previousOpacity = store().config().optDouble("opacity", 0.94)
    val config = raw.toMutableMap()
    (raw["opacity"] as? Number)?.toDouble()?.let { config["opacity"] = if (it.isFinite()) it.coerceIn(0.4, 1.0) else 0.94 }
    (raw["intervalMs"] as? Number)?.toLong()?.let { config["intervalMs"] = it.coerceIn(2000, 30000) }
    (raw["size"] as? Number)?.toInt()?.let { config["size"] = it.coerceIn(48, 72) }
    (raw["games"] as? List<*>)?.let { config["games"] = it.take(500) }
    (raw["macros"] as? List<*>)?.let { config["macros"] = it.take(100) }
    store().configure(config)
    service()?.reconfigure((config["opacity"] as? Number)?.toDouble()?.let { it != previousOpacity } == true)
    (raw["expanded"] as? Boolean)?.let { service()?.setExpanded(it) }
  }

  private fun start(config: Map<String, Any?>, newSession: Boolean, promise: Promise, booleanResult: Boolean) {
    if (appContext.currentActivity?.hasWindowFocus() != true) {
      val failure = GamingActions.result(false, "Open Optinix and start the session from a visible screen.", "user-action")
      promise.resolve(if (booleanResult) false else failure)
      return
    }
    OverlayBridge.error = null
    val previousId = (service()?.runtime()?.get("session") as? Map<*, *>)?.get("id")
    try {
      val intent = OptinixOverlayService.startIntent(context()).putExtra("config", JSONObject(config).toString()).putExtra("newSession", newSession)
      if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      val handler = Handler(Looper.getMainLooper())
      var attempts = 0
      val check = object : Runnable {
        override fun run() {
          attempts++
          val runtime = service()?.runtime()
          val session = runtime?.get("session") as? Map<*, *>
          val ready = session?.get("id")?.let { it != "" && (!newSession || it != previousId) } == true
          if (ready && (!booleanResult || OverlayBridge.showing)) {
            promise.resolve(if (booleanResult) true else GamingActions.result(true, "Session started. Review the status of each profile setting.") + mapOf("settings" to runtime?.get("settings")))
          } else if (attempts >= 25) {
            promise.resolve(if (booleanResult) false else GamingActions.result(false, OverlayBridge.error ?: "The session could not start. Android may have restricted the service."))
          } else handler.postDelayed(this, 100)
        }
      }
      handler.post(check)
    } catch (error: Exception) {
      OverlayBridge.error = error.message ?: "Android refused service startup."
      promise.resolve(if (booleanResult) false else GamingActions.result(false, OverlayBridge.error!!))
    }
  }
}
