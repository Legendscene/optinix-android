package net.exitpoint.optinix.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.facebook.react.common.assets.ReactFontManager
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min
import org.json.JSONObject

class OverlayWindow(private val context: Context, private val action: (String) -> Unit) {
  private enum class Mode { HANDLE, QUICK, DASHBOARD }

  private val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val store = GamingStore(context)
  private var root: LinearLayout? = null
  private var handleRowView: LinearLayout? = null
  private var bubble: TextView? = null
  private var quick: LinearLayout? = null
  private var navStrip: LinearLayout? = null
  private var quickTimer: TextView? = null
  private var quickStats: TextView? = null
  private var quickStatus: TextView? = null
  private var panel: LinearLayout? = null
  private var scroll: ScrollView? = null
  private var content: LinearLayout? = null
  private var heading: TextView? = null
  private var subtitle: TextView? = null
  private var message: TextView? = null
  private var macroStop: TextView? = null
  private var chart: OverlaySparkline? = null
  private val values = LinkedHashMap<String, TextView>()
  private val quickValues = LinkedHashMap<String, TextView>()
  private val tabs = ArrayList<TextView>()
  private var params: WindowManager.LayoutParams? = null
  private var mode = Mode.HANDLE
  private var tab = 0
  private var sessionOpacity: Double? = null
  private var networkResult = "--"
  private var last: Map<String, Any?> = emptyMap()
  private var lastMetrics: Map<String, Any?> = emptyMap()
  private var status = ""
  private var animator: ValueAnimator? = null
  private var pulse: ValueAnimator? = null
  private var dotView: TextView? = null
  private var idleScheduled = false
  private val motionOff get() = store.config().optBoolean("reducedMotion")
  // Obsidian-Spectrum surface system (mirrors the PC pass): near-black
  // blue-tinted layers separated by hairlines instead of hard grey borders,
  // and one semantic status scale — warn amber, hot rose, neutral ink.
  private val muted = Color.parseColor("#a7b0bf")
  private val ink = Color.parseColor("#eef1f6")
  private val hairline = Color.parseColor("#1EFFFFFF")
  private val tile = "#121722"
  private val surfaceButton = "#171c27"
  private val track = "#141926"
  private val warn = Color.parseColor("#fbbf24")
  private val hot = Color.parseColor("#f87171")
  private val onAccent = Color.parseColor("#061310")

  /** Presentational status colour for a metric measured "up" (load/heat). */
  private fun metricColor(value: Double?, warnAt: Double, hotAt: Double): Int = when {
    value == null || !value.isFinite() -> ink
    value >= hotAt -> hot
    value >= warnAt -> warn
    else -> ink
  }

  /** Presentational status colour for a metric measured "down" (battery %). */
  private fun metricColorLow(value: Double?, warnAt: Double, hotAt: Double): Int = when {
    value == null || !value.isFinite() -> ink
    value <= hotAt -> hot
    value <= warnAt -> warn
    else -> ink
  }

  /** Dark-on-accent vs light-on-accent: decided by measured luminance, since
   *  the accent is user-configurable (HUD accent preference). */
  private fun onAccentText(): Int {
    val value = accent()
    val luminance = 0.2126 * Color.red(value) + 0.7152 * Color.green(value) + 0.0722 * Color.blue(value)
    return if (luminance > 140) onAccent else ink
  }

  fun show(): Boolean {
    if (root != null) return true
    if (!Settings.canDrawOverlays(context)) return false
    val area = bounds()
    val rightDock = store.preferences.getBoolean(dockKey(), false)
    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      layoutDirection = View.LAYOUT_DIRECTION_LTR
      // Children anchor to the docked edge, like Game Space's drawer.
      gravity = if (rightDock) Gravity.END else Gravity.START
    }
    handleRowView = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
    // "size" drives both notch proportions: width 15–20 dp, height 44–64 dp.
    val notchSize = store.config().optInt("size", 56).coerceIn(48, 72)
    val notchWidth = dp((notchSize * 0.28).toInt().coerceIn(15, 20))
    val notchHeight = dp((notchSize * 0.9).toInt().coerceIn(44, 64))
    val notch = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      contentDescription = "Optinix game HUD notch. Tap to open the tools drawer; drag to move it along the edge."
      // Layered gradient notch instead of a flat chip — reads as a carved
      // surface at the docked edge. Geometry (15–20 x 44–64 dp) is untouched:
      // docking, tucking and the verified Game-Space frames depend on it.
      background = gradient(notchWidth / 2, "#171c28", "#0b0e15", hairline, sessionOpacity ?: store.config().optDouble("opacity", 0.94))
      isClickable = true
      isFocusable = true
      setOnClickListener {
        restoreBrightness()
        if (mode == Mode.HANDLE) applyMode(Mode.DASHBOARD, true) else applyMode(Mode.HANDLE, true)
      }
    }
    val dot = TextView(context).apply {
      text = "●"
      textSize = 8f
      setTextColor(accent())
      gravity = Gravity.CENTER
      includeFontPadding = false
    }
    dotView = dot
    notch.addView(dot, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    handleRowView!!.addView(notch, LinearLayout.LayoutParams(notchWidth, notchHeight))
    drag(notch)
    column.addView(handleRowView, LinearLayout.LayoutParams(notchWidth, notchHeight))
    quick = buildQuick().apply { visibility = View.GONE }
    column.addView(quick, LinearLayout.LayoutParams(dp(220), LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5) })
    panel = buildPanel(area)
    panel?.visibility = View.GONE
    column.addView(panel, LinearLayout.LayoutParams(min(dp(316), area.width() - dp(12)), LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5) })
    val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      title = "Optinix gaming HUD"
      alpha = 1f
    }
    return try {
      manager.addView(column, params)
      root = column
      OverlayBridge.showing = true
      selectTab(tab)
      applyMode(if (store.config().optBoolean("expanded", false)) Mode.DASHBOARD else Mode.HANDLE, false)
      column.post { dock(false) }
      if (!motionOff) {
        // One orchestrated entrance: the HUD grows out of the handle corner.
        column.pivotX = dp(30).toFloat()
        column.pivotY = dp(16).toFloat()
        column.scaleX = 0.86f
        column.scaleY = 0.86f
        column.alpha = 0f
        column.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(230)
          .setInterpolator(OvershootInterpolator(1.1f)).start()
      }
      startPulse()
      armIdle()
      true
    } catch (error: Exception) {
      OverlayBridge.showing = false
      OverlayBridge.error = error.message ?: "Overlay window was refused by Android."
      root = null
      false
    }
  }

  fun hide() {
    animator?.cancel()
    pulse?.cancel()
    pulse = null
    root?.removeCallbacks(idleRunnable)
    root?.let { try { manager.removeViewImmediate(it) } catch (_: Exception) {} }
    root = null; panel = null; scroll = null; content = null; chart = null
    handleRowView = null; bubble = null; quick = null; quickTimer = null; quickStats = null; quickStatus = null
    heading = null; subtitle = null; message = null; macroStop = null; params = null; navStrip = null; dotView = null
    tabs.clear(); values.clear(); quickValues.clear()
    idleScheduled = false
    OverlayBridge.showing = false
    OverlayBridge.expanded = false
  }

  fun reconfigure() {
    if (root == null) return
    val wasExpanded = mode == Mode.DASHBOARD
    val wasQuick = mode == Mode.QUICK
    store.configure(mapOf("expanded" to false))
    hide()
    show()
    when {
      wasExpanded -> applyMode(Mode.DASHBOARD, false)
      wasQuick -> applyMode(Mode.QUICK, false)
    }
    render(last, lastMetrics)
  }

  fun resetPosition() {
    store.preferences.edit().remove("dockPortrait").remove("dockLandscape").remove("yPortrait").remove("yLandscape").apply()
    dock(false)
  }

  fun setSessionOpacity(value: Double) { sessionOpacity = value.coerceIn(0.4, 1.0); reconfigure() }
  fun clearSessionOpacity() { sessionOpacity = null }

  fun setExpanded(value: Boolean) = when {
    value -> applyMode(Mode.DASHBOARD, true)
    mode != Mode.HANDLE -> applyMode(Mode.HANDLE, true)
    else -> Unit
  }

  fun setMessage(value: String) {
    status = value
    message?.text = value
    quickStatus?.text = value
  }

  fun setNetworkResult(value: String) {
    networkResult = value
    setMessage(value)
    values["net"]?.text = value
  }

  private val idleRunnable = Runnable {
    idleScheduled = false
    if (mode != Mode.HANDLE || root == null) return@Runnable
    root?.animate()?.alpha((store.config().optDouble("opacity", 0.94) * 0.45f).toFloat())
      ?.scaleX(0.92f)?.scaleY(0.92f)?.setDuration(350)?.start()
  }

  private fun armIdle() {
    if (!store.config().optBoolean("autoHide", true)) return
    val view = root ?: return
    view.removeCallbacks(idleRunnable)
    idleScheduled = true
    view.postDelayed(idleRunnable, IDLE_DELAY_MS)
  }

  private fun restoreBrightness() {
    val view = root ?: return
    val wasIdle = view.alpha < 0.95f
    view.animate()?.cancel()
    view.animate()?.alpha(1f)?.scaleX(1f)?.scaleY(1f)?.rotationX(0f)?.setDuration(160)?.start()
    if (wasIdle) dock(false)
    armIdle()
  }

  /** Quiet accent pulse on the handle dot — alive but never distracting. */
  private fun startPulse() {
    pulse?.cancel()
    if (motionOff) {
      dotView?.alpha = 1f
      return
    }
    pulse = ValueAnimator.ofFloat(1f, 0.4f, 1f).apply {
      duration = 2400
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener { dotView?.alpha = it.animatedValue as Float }
      start()
    }
  }

  private fun applyMode(next: Mode, animate: Boolean) {
    val view = root ?: return
    mode = next
    OverlayBridge.expanded = next != Mode.HANDLE
    // Game Space behaviour: while a drawer is open, its edge notch disappears.
    handleRowView?.visibility = if (next == Mode.HANDLE) View.VISIBLE else View.GONE
    quick?.visibility = if (next == Mode.QUICK) View.VISIBLE else View.GONE
    panel?.visibility = if (next == Mode.DASHBOARD) View.VISIBLE else View.GONE
    store.configure(mapOf("expanded" to (next == Mode.DASHBOARD)))
    restoreBrightness()
    if (next != Mode.HANDLE && animate && !motionOff) {
      val target = if (next == Mode.QUICK) quick else panel
      target?.let {
        // Grow out of the handle corner: pivot near the pill, slight lift, settle.
        it.pivotX = dp(30).toFloat()
        it.pivotY = 0f
        it.translationY = dp(-10).toFloat()
        it.scaleX = 0.86f
        it.scaleY = 0.86f
        it.alpha = 0f
        it.animate().translationY(0f).scaleX(1f).scaleY(1f).alpha(1f).setDuration(230)
          .setInterpolator(OvershootInterpolator(1.08f)).start()
      }
    }
    if (next == Mode.HANDLE && animate && !motionOff) {
      handleRowView?.animate()?.scaleX(1.08f)?.scaleY(1.08f)?.setDuration(110)
        ?.withEndAction { handleRowView?.animate()?.scaleX(1f)?.scaleY(1f)?.setDuration(150)?.start() }?.start()
    }
    view.post {
      if (next == Mode.DASHBOARD) fit()
      // Panels slide out of the edge; returning to the handle slides back in.
      dock(animate && next != Mode.HANDLE && !motionOff)
    }
  }

  fun render(session: Map<String, Any?>, metrics: Map<String, Any?>, cpu: List<Double?> = emptyList(), ram: List<Double?> = emptyList()) {
    last = session; lastMetrics = metrics
    val load = metrics["cpuPercent"] as? Number
    bubble?.text = if (load != null) "${load.toInt()}%" else "--"
    val duration = duration((session["durationMs"] as? Number)?.toLong() ?: 0L)
    val paused = session["paused"] == true
    val stats = StringBuilder()
    (metrics["cpuPercent"] as? Number)?.let { stats.append("${it.toInt()}%") } ?: stats.append("--")
    stats.append("  ·  ")
    (metrics["ramPercent"] as? Number)?.let { stats.append("${it.toInt()}%") } ?: stats.append("--")
    stats.append("  ·  ")
    (metrics["batteryPercent"] as? Number)?.let { stats.append("${it.toInt()}%") } ?: stats.append("--")
    quickStats?.text = stats.toString()
    quickTimer?.text = "$duration${if (paused) " ⏸" else ""}"
    val selected = session["gameLabel"] as? String ?: "Gaming session"
    heading?.text = selected
    heading?.maxLines = 1
    heading?.ellipsize = TextUtils.TruncateAt.END
    subtitle?.text = "${(session["profileShort"] ?: session["profileName"] ?: "Balanced")}  •  $duration${if (paused) " paused" else ""}"
    fun percent(key: String) = (metrics[key] as? Number)?.let { String.format(Locale.US, "%.1f%%", it.toDouble()) } ?: "--"
    fun statistic(key: String, suffix: String = "%") = (session[key] as? Number)?.let { String.format(Locale.US, "%.1f%s", it.toDouble(), suffix) } ?: "--"
    values["cpu"]?.text = percent("cpuPercent")
    values["ram"]?.text = percent("ramPercent")
    values["temp"]?.text = (metrics["temperatureC"] as? Number)?.let { String.format(Locale.US, "%.1f°C", it.toDouble()) } ?: "--"
    values["source"]?.text = metrics["temperatureSource"] as? String ?: "Unavailable"
    values["thermal"]?.text = metrics["thermalLabel"] as? String ?: "--"
    values["battery"]?.text = "${percent("batteryPercent")}${if (metrics["charging"] == true) " ⚡" else ""}"
    values["refresh"]?.text = (metrics["refreshRate"] as? Number)?.let { "${it.toInt()} Hz display" } ?: "--"
    values["foreground"]?.text = session["foregroundLabel"] as? String ?: "Unknown / access needed"
    values["cpuavg"]?.text = statistic("cpuAverage")
    values["cpupeak"]?.text = statistic("cpuPeak")
    values["ramavg"]?.text = statistic("ramAverage")
    values["temppeak"]?.text = statistic("tempPeak", "°C")
    values["drain"]?.text = statistic("batteryDrainPerHour", "%/h estimate")
    values["samples"]?.text = (session["samples"] as? Number)?.toString() ?: "0"
    // Only the colour carries a state judgement; the number stays exactly
    // what the sensor reported, unmeasured stays neutral "--".
    values["cpu"]?.setTextColor(metricColor((metrics["cpuPercent"] as? Number)?.toDouble(), 80.0, 95.0))
    values["ram"]?.setTextColor(metricColor((metrics["ramPercent"] as? Number)?.toDouble(), 80.0, 95.0))
    values["temp"]?.setTextColor(metricColor((metrics["temperatureC"] as? Number)?.toDouble(), 45.0, 53.0))
    values["battery"]?.setTextColor(metricColorLow((metrics["batteryPercent"] as? Number)?.toDouble(), 25.0, 12.0))
    values["temppeak"]?.setTextColor(metricColor((session["tempPeak"] as? Number)?.toDouble(), 45.0, 53.0))
    values["dnd"]?.text = if (DndController(context).active()) "Optinix rule requested" else "Optinix rule off"
    values["net"]?.text = networkResult
    if (mode == Mode.DASHBOARD && tab == 0 && cpu.isNotEmpty()) chart?.setSeries(cpu, ram)
    val macro = session["macro"] as? Map<*, *>
    macroStop?.visibility = if (macro?.get("status") == "running") View.VISIBLE else View.GONE
    values["macro"]?.text = macro?.get("message") as? String ?: "No macro running"
    values["capture"]?.text = if (CaptureService.recording) "Recording • silent video" else if (CaptureService.active) "Capturing screenshot" else "Off"
  }

  private fun buildQuick(): LinearLayout {
    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(10), dp(8), dp(10), dp(10))
      background = gradient(20, "#121722", "#0a0d13", hairline, 0.98)
      elevation = dp(4).toFloat()
    }
    val header = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    header.addView(text("●", 7f, accent()), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp(6) })
    quickTimer = text("--:--", 14f, ink).apply { typeface = font("JetBrainsMono_700Bold") }
    header.addView(quickTimer, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    quickStats = text("--  ·  --  ·  --", 11f, muted).apply { typeface = font("JetBrainsMono_500Medium"); contentDescription = "CPU, RAM and battery percent" }
    header.addView(quickStats)
    card.addView(header)
    val chips = configuredShortcuts()
    if (chips.isNotEmpty()) {
      val chipRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
      chips.forEach { (label, keyAction) ->
        chipRow.addView(
          button(label, 11f) { keyAction() }.apply {
            // Shortcut chips read as quiet pills; the real actions below carry
            // the bigger boxes.
            background = background(17, tile, false, 1.0, hairline)
            minHeight = dp(30)
            setPadding(dp(6), dp(4), dp(6), dp(4))
          },
          LinearLayout.LayoutParams(0, dp(30), 1f).apply { leftMargin = if (chipRow.childCount > 0) dp(4) else 0 }
        )
      }
      card.addView(chipRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(30)).apply { topMargin = dp(6) })
    }
    val profiles = store.config().optJSONArray("profiles")
    if (profiles != null && profiles.length() > 0) {
      var rowView: LinearLayout? = null
      for (i in 0 until profiles.length()) {
        val profile = profiles.optJSONObject(i) ?: continue
        if (rowView == null || rowView.childCount >= 3) {
          rowView = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
          card.addView(rowView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5) })
        }
        rowView?.addView(button(profile.pickLabel(), 11f) { action("profile:${profile.optString("id")}") }, LinearLayout.LayoutParams(0, dp(38), 1f).apply { leftMargin = if (rowView.childCount > 0) dp(4) else 0 })
      }
    }
    val tools = quickTools(listOf("timer" to "Timer", "dnd" to "DND", "display" to "Bright.", "network" to "Net test", "screenshot" to "Shot", "record" to "Rec"))
    var toolRow: LinearLayout? = null
    tools.forEach { tool ->
      if (toolRow == null || toolRow.childCount >= 3) {
        toolRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        card.addView(toolRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4) })
      }
      toolRow?.addView(button(tool.second, 10f) { action(tool.first) }, LinearLayout.LayoutParams(0, dp(34), 1f).apply { leftMargin = if (toolRow.childCount > 0) dp(3) else 0 })
    }
    navStrip = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(2), dp(2), 0, 0) }
    navStrip!!.addView(button("‹", 13f) { applyMode(Mode.HANDLE, true) }.apply {
      contentDescription = "Collapse the quick panel"
      minHeight = dp(30); setPadding(dp(6), 0, dp(6), 0)
    })
    // One accent-filled primary per surface: opening the full dashboard is
    // the loudest offer here.
    navStrip!!.addView(buttonPrimary("Dashboard", 12f) { setExpanded(true) }, LinearLayout.LayoutParams(0, dp(30), 1f).apply { leftMargin = dp(4) })
    navStrip!!.addView(button("✕", 12f) { action("stop") }.apply {
      contentDescription = "Stop the session and tools"
      minHeight = dp(30); setPadding(dp(8), 0, dp(8), 0)
    })
    card.addView(navStrip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    quickStatus = text(status, 11f, muted).apply { maxLines = 2; ellipsize = TextUtils.TruncateAt.END; setPadding(0, dp(7), 0, 0) }
    card.addView(quickStatus)
    return card
  }

  private fun quickTools(entries: List<Pair<String, String>>): List<Pair<String, String>> =
    entries.filter { (key, _) -> key != "dnd" || (Build.VERSION.SDK_INT >= 29 && DndController(context).access()) }

  private fun shortcut(key: String): Pair<String, () -> Unit>? = when (key) {
    "profile" -> "Mode" to { applyMode(Mode.DASHBOARD, true) }
    "dnd" -> if (Build.VERSION.SDK_INT >= 29 && DndController(context).access()) "DND" to { action("dnd") } else null
    "screenshot" -> "Shot" to { action("screenshot") }
    "record" -> "Rec" to { action("record") }
    "timer" -> "Timer" to { action("timer") }
    "network" -> "Net" to { action("network") }
    "macro" -> if (store.config().optBoolean("macroEnabled") && store.macros().isNotEmpty()) "Macro" to { applyMode(Mode.DASHBOARD, true); selectTabMacro() } else null
    else -> null
  }

  private fun selectTabMacro() {
    tab = 1
    selectTab(1)
  }

  private fun buildPanel(area: Rect): LinearLayout {
    val plate = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(14), dp(10), dp(14), dp(12))
      background = gradient(22, "#121722", "#0a0d13", hairline, 0.98)
      elevation = dp(5).toFloat()
    }
    val header = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    header.addView(text("●", 7f, accent()), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp(7) })
    heading = text("Optinix", 16f, ink).apply { typeface = font("PlusJakartaSans_700Bold"); maxLines = 1; ellipsize = TextUtils.TruncateAt.END }
    header.addView(heading, LinearLayout.LayoutParams(0, dp(34), 1f))
    header.addView(button("‹", 13f) { action("collapse") }.apply {
      contentDescription = "Minimize the panel back to the edge notch"
      setPadding(dp(10), dp(8), dp(10), dp(8))
    })
    header.addView(button("×", 12f) { action("stop") }.apply { contentDescription = "Close the panel and stop Optinix tools" })
    drag(heading!!)
    plate.addView(header)
    subtitle = text("Session control center", 11f, muted).apply { setPadding(0, 0, 0, dp(8)) }
    plate.addView(subtitle)
    // Segmented control: a recessed track with an accent-tinted active pill,
    // instead of four floating text buttons.
    val tabBar = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(dp(2), dp(2), dp(2), dp(2))
      background = background(13, track, false, 1.0, hairline)
    }
    listOf("Perf", "Tools", "Net", "Stats").forEachIndexed { index, label ->
      val control = text(label, 12f, muted).apply { isClickable = true; isFocusable = true; gravity = Gravity.CENTER; contentDescription = "$label tab" }
      control.setOnClickListener {
        if (store.config().optBoolean("haptics", true)) performHaptic(control)
        selectTab(index)
        fit()
      }
      tabs.add(control)
      tabBar.addView(control, LinearLayout.LayoutParams(0, dp(32), 1f).apply { if (index > 0) leftMargin = dp(2) })
    }
    plate.addView(tabBar)
    scroll = ScrollView(context).apply { isVerticalScrollBarEnabled = false }
    content = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(10), 0, 0) }
    scroll!!.addView(content)
    plate.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(320)))
    message = text(status, 11f, muted).apply { setPadding(0, dp(8), 0, 0); maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
    plate.addView(message)
    macroStop = button("Stop macro", 11f) { action("stop_macro") }.apply { visibility = View.GONE }
    plate.addView(macroStop, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(36)).apply { topMargin = dp(4) })
    return plate
  }

  private fun fit() {
    if (mode != Mode.DASHBOARD) return
    val view = scroll ?: return
    val body = content ?: return
    val area = bounds()
    val width = (root?.width ?: dp(316)) - dp(28) - dp(4)
    body.measure(View.MeasureSpec.makeMeasureSpec(width.coerceAtLeast(dp(60)), View.MeasureSpec.EXACTLY), View.MeasureSpec.UNSPECIFIED)
    val maxHeight = min(dp(440), (area.height() - dp(150)).coerceAtLeast(dp(220)))
    val target = body.measuredHeight.coerceIn(dp(120), maxHeight)
    val layout = view.layoutParams as? LinearLayout.LayoutParams ?: return
    if (layout.height != target) { layout.height = target; view.layoutParams = layout }
    root?.post { dock(false) }
  }

  private fun selectTab(index: Int) {
    tab = index
    val parent = content ?: return
    parent.removeAllViews(); values.clear(); chart = null
    tabs.forEachIndexed { i, view -> tabFill(view, i == index) }
    when (index) {
      0 -> {
        chart = OverlaySparkline(context).apply { setAccent(accent()) }
        parent.addView(chart, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply { bottomMargin = dp(6) })
        // Headline live values as a 2x2 tile grid: big mono numerals with
        // presentational warn/hot colouring; unmeasured stays neutral "--".
        tileGrid(listOf("cpu" to "CPU", "ram" to "RAM", "temp" to "Temp", "battery" to "Battery"))
        row("source", "Sensor"); row("thermal", "Thermal status"); row("refresh", "Refresh rate")
        note("CPU line uses your HUD accent; RAM line is gray. Gaps mean unavailable. Game FPS is not exposed to ordinary apps; display Hz is not FPS.")
      }
      1 -> {
        row("dnd", "DND"); row("capture", "Capture")
        addButton(if (Build.VERSION.SDK_INT < 29) "System DND settings" else if (DndController(context).access()) "Toggle Optinix DND" else "Allow DND access", "dnd")
        addButton("Pause / resume timer", "timer")
        addButton("Display & brightness settings", "display")
        addButton("Screenshot — ask consent", "screenshot")
        addButton("Record / stop recording", "record")
        addButton("Review memory", "memory")
        addButton("Clear Optinix cache", "cache")
        note("Profiles change Optinix controls, not game CPU/GPU limits.")
        val profiles = store.config().optJSONArray("profiles")
        if (profiles != null) for (i in 0 until profiles.length()) {
          val profile = profiles.optJSONObject(i) ?: continue
          addButton(profile.optString("name"), "profile:${profile.optString("id")}")
        }
        row("macro", "Macro")
        if (store.config().optBoolean("macroEnabled")) store.macros().forEach { macro -> addButton("Run ${macro.optString("name")}", "macro:${macro.optString("id")}") }
        else note("Enable utility macros in Macro Studio. Cross-app taps are not supported.")
        addButton("Handle 70% — this session", "opacity:0.7")
        addButton("Handle 95% — this session", "opacity:0.95")
        addButton("Reset position", "reset_position")
      }
      2 -> {
        row("net", "Last result")
        addButton("Test network", "network")
        note("Runs a real HTTPS request to the configured target. This is not game-server ping; packet loss and jitter beyond measured values are never invented.")
      }
      else -> {
        row("foreground", "Foreground app"); row("cpuavg", "CPU average"); row("cpupeak", "CPU peak")
        row("ramavg", "RAM average"); row("temppeak", "Peak sensor temp"); row("drain", "Battery drain"); row("samples", "Samples")
        note("Header shows the selected game. Foreground app requires Usage Access. Drain is estimated only after 10 minutes of discharge and a measured level drop.")
      }
    }
    render(last, lastMetrics)
    root?.post { dock(false) }
  }

  private fun configuredShortcuts(): List<Pair<String, () -> Unit>> {
    val configured = store.config().optJSONArray("shortcuts")
    val available = ArrayList<Pair<String, () -> Unit>>()
    if (configured != null) for (i in 0 until minOf(configured.length(), 4)) configured.optString(i).let { key -> shortcut(key)?.let { available.add(it) } }
    return available
  }

  private fun note(value: String) {
    content?.addView(text(value, 11f, Color.parseColor("#6d7787")).apply { setPadding(0, dp(9), 0, dp(9)) })
  }

  /** 2-across grid of headline metric tiles: label over a big mono value. */
  private fun tileGrid(entries: List<Pair<String, String>>) {
    var rowView: LinearLayout? = null
    entries.forEach { (key, label) ->
      if (rowView == null || rowView.childCount >= 2) {
        rowView = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        content?.addView(rowView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(4) })
      }
      val box = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(10), dp(8), dp(10), dp(9))
        background = background(14, tile, false, 1.0, hairline)
      }
      box.addView(text(label, 10f, muted).apply { typeface = font("Inter_600SemiBold") })
      val value = text("--", 15f, ink).apply { typeface = font("JetBrainsMono_700Bold"); maxLines = 1; setPadding(0, dp(2), 0, 0) }
      box.addView(value)
      values[key] = value
      rowView?.addView(
        box,
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { if (rowView.childCount > 0) leftMargin = dp(4) }
      )
    }
  }

  private fun row(key: String, label: String) {
    val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(6), 0, dp(6)); gravity = Gravity.CENTER_VERTICAL }
    row.addView(text(label, 11f, muted), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val value = text("--", 12f, ink).apply { gravity = Gravity.END; maxLines = 2; ellipsize = TextUtils.TruncateAt.END; typeface = font("JetBrainsMono_500Medium") }
    row.addView(value, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    values[key] = value
    content?.addView(row)
  }

  private fun addButton(label: String, key: String) { content?.addView(button(label, 12f) { action(key) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(38)).apply { bottomMargin = dp(5) }) }

  private fun JSONObject.pickLabel() = optString("short", "").ifBlank { optString("name") }.ifBlank { "?" }

  private fun button(label: String, size: Float, onClick: () -> Unit): TextView = text(label, size, ink).apply {
    minHeight = dp(36); gravity = Gravity.CENTER
    setPadding(dp(10), dp(8), dp(10), dp(8))
    // Secondary control: quiet dark surface with a hairline and one radius
    // across quick tools and dashboard actions.
    background = background(12, surfaceButton)
    typeface = font("Inter_600SemiBold")
    contentDescription = label; isClickable = true; isFocusable = true
    setOnClickListener {
      if (store.config().optBoolean("haptics", true)) performHaptic(this)
      if (!motionOff) {
        animate().scaleX(0.97f).scaleY(0.97f).setDuration(70).withEndAction {
          animate().scaleX(1f).scaleY(1f).setDuration(120).setInterpolator(OvershootInterpolator()).start()
        }.start()
      }
      restoreBrightness()
      onClick()
    }
  }

  /** The single accent-filled action on a surface (e.g. the Dashboard offer). */
  private fun buttonPrimary(label: String, size: Float, onClick: () -> Unit): TextView = button(label, size, onClick).apply {
    background = accentFill(12)
    setTextColor(onAccentText())
  }

  /** Segmented-control styling for the dashboard tab strip. */
  private fun tabFill(view: TextView, selected: Boolean) {
    view.background = if (selected) {
      val tint = accent()
      GradientDrawable().apply {
        cornerRadius = dp(11).toFloat()
        setColor(Color.argb(56, Color.red(tint), Color.green(tint), Color.blue(tint)))
        setStroke(dp(1), Color.argb(120, Color.red(tint), Color.green(tint), Color.blue(tint)))
      }
    } else null
    view.typeface = font(if (selected) "Inter_600SemiBold" else "Inter_500Medium")
    view.setTextColor(if (selected) accent() else muted)
    view.isSelected = selected
  }

  private fun performHaptic(view: View) { view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) }

  private fun text(value: String, size: Float, color: Int) = TextView(context).apply { text = value; textSize = size; setTextColor(color); typeface = font("Inter_500Medium"); includeFontPadding = false }
  private fun font(family: String): Typeface = try { ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, context.assets) } catch (_: Exception) { Typeface.create("sans-serif-medium", Typeface.NORMAL) }
  private fun background(radius: Int, color: String, accented: Boolean = false, opacity: Double = 1.0, stroke: Int? = null) = GradientDrawable().apply {
    cornerRadius = dp(radius).toFloat()
    val base = Color.parseColor(color)
    setColor(Color.argb((opacity.coerceIn(0.4, 1.0) * 255).toInt(), Color.red(base), Color.green(base), Color.blue(base)))
    setStroke(dp(1), stroke ?: if (accented) accent() else hairline)
  }

  /** Soft vertical gradient plate — cheap depth without a blur pass. */
  private fun gradient(radius: Int, top: String, bottom: String, stroke: Int, opacity: Double = 1.0) = GradientDrawable().apply {
    cornerRadius = dp(radius).toFloat()
    val from = Color.parseColor(top)
    val to = Color.parseColor(bottom)
    orientation = GradientDrawable.Orientation.TOP_BOTTOM
    setColors(
      intArrayOf(
        Color.argb((opacity * 255).toInt(), Color.red(from), Color.green(from), Color.blue(from)),
        Color.argb((opacity * 255).toInt(), Color.red(to), Color.green(to), Color.blue(to)),
      )
    )
    setStroke(dp(1), stroke)
  }

  /** Solid accent fill for the one primary action per surface. */
  private fun accentFill(radius: Int) = GradientDrawable().apply {
    cornerRadius = dp(radius).toFloat()
    setColor(accent())
  }
  private fun accent() = try { Color.parseColor(store.config().optString("accent", "#2ee6cf")) } catch (_: Exception) { Color.parseColor("#2ee6cf") }

  private fun drag(handle: View) {
    var x = 0; var y = 0; var downX = 0f; var downY = 0f; var moved = false
    handle.setOnTouchListener { view, event ->
      val position = params ?: return@setOnTouchListener false
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          restoreBrightness(); animator?.cancel(); x = position.x; y = position.y; downX = event.rawX; downY = event.rawY; moved = false
          if (!motionOff) {
            handle.animate().scaleX(1.06f).scaleY(1.06f).setDuration(120).start()
            root?.animate()?.rotationX(2.4f)?.setDuration(140)?.start()
          }
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - downX).toInt(); val dy = (event.rawY - downY).toInt()
          moved = moved || abs(dx) > dp(6) || abs(dy) > dp(6)
          if (moved) { position.x = x + dx; position.y = y + dy; clamp(); update() }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (!motionOff) {
            handle.animate().scaleX(1f).scaleY(1f).setDuration(220).setInterpolator(OvershootInterpolator(1.5f)).start()
            root?.animate()?.rotationX(0f)?.setDuration(200)?.start()
          }
          if (moved) {
            val area = bounds(); val width = root?.width ?: dp(56)
            val right = position.x + width > area.right || position.x + width / 2 > area.centerX()
            val range = (area.height() - (root?.height ?: dp(56))).coerceAtLeast(1)
            store.preferences.edit().putBoolean(dockKey(), right).putFloat(yKey(), ((position.y - area.top).toFloat() / range).coerceIn(0f, 1f)).apply()
            dock(!motionOff)
          } else if (event.actionMasked == MotionEvent.ACTION_UP) view.performClick()
          true
        }
        else -> false
      }
    }
  }

  private fun tuckPx() = if (mode == Mode.HANDLE) dp(2) else 0

  private fun dock(animate: Boolean) {
    val position = params ?: return
    val view = root ?: return
    val area = bounds()
    val right = store.preferences.getBoolean(dockKey(), false)
    // The pulsing dot must sit in the visible sliver for both docks: on the edge
    // nearest the screen's inside.
    root?.gravity = if (right) Gravity.END else Gravity.START
    handleRowView?.layoutDirection = if (right) View.LAYOUT_DIRECTION_LTR else View.LAYOUT_DIRECTION_RTL
    val tuck = tuckPx()
    val targetX = if (right) area.right - view.width + tuck else area.left - tuck
    val rangeY = ((area.height() - view.height).coerceAtLeast(0) * store.preferences.getFloat(yKey(), 0.45f)).toInt()
    position.y = area.top + rangeY
    if (animate) {
      animator?.cancel()
      animator = ValueAnimator.ofInt(position.x, targetX).apply { duration = 150; addUpdateListener { position.x = it.animatedValue as Int; clamp(); update() }; start() }
    } else { position.x = targetX; clamp(); update() }
  }

  private fun clamp() {
    val position = params ?: return
    val area = bounds()
    val view = root
    val width = view?.width ?: dp(60)
    val tuck = tuckPx()
    position.x = position.x.coerceIn(area.left - tuck, maxOf(area.left, area.right - width + tuck))
    position.y = position.y.coerceIn(area.top, maxOf(area.top, area.bottom - (view?.height ?: dp(60))))
  }
  private fun update() { root?.let { try { manager.updateViewLayout(it, params) } catch (_: Exception) {} } }
  private fun bounds(): Rect {
    if (Build.VERSION.SDK_INT >= 30) {
      val metrics = manager.currentWindowMetrics
      val inset = metrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      return Rect(metrics.bounds.left + inset.left, metrics.bounds.top + inset.top, metrics.bounds.right - inset.right, metrics.bounds.bottom - inset.bottom)
    }
    val display = context.resources.displayMetrics
    return Rect(0, dp(24), display.widthPixels, display.heightPixels - dp(24))
  }
  private fun dockKey() = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) "dockLandscape" else "dockPortrait"
  private fun yKey() = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) "yLandscape" else "yPortrait"
  private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()

  companion object {
    fun duration(ms: Long): String = String.format(Locale.US, "%02d:%02d", ms / 60000L, ms / 1000L % 60L)
    private const val IDLE_DELAY_MS = 7000L
  }
}
