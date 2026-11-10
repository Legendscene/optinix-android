package net.exitpoint.optinix.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.TextUtils
import android.text.format.Formatter
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * OverlayWindow — the in-game assistant: a slim edge handle and one expanded
 * panel made of a fixed navigation rail plus a scrollable content plate.
 *
 * The panel is one `TYPE_APPLICATION_OVERLAY` window. Only the visible parts
 * are laid out (the rest of the handle sits beyond the display edge), so the
 * window never becomes a fullscreen touch-stealing surface. Every control in
 * the panel performs a real action or is absent; metrics that cannot be read
 * stay `--`.
 */
class OverlayWindow(private val context: Context, private val action: (String) -> Unit) {
  private enum class Mode { HANDLE, DASHBOARD }

  private class ToolSpec(
    val key: String,
    val icon: String,
    val label: String,
    val note: String,
    val active: Boolean,
    val onClick: () -> Unit,
  )

  private val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val store = GamingStore(context)

  private var root: LinearLayout? = null
  private var handleRow: LinearLayout? = null
  private var handleContent: LinearLayout? = null
  private var handleBg: GradientDrawable? = null
  private var handleChevron: IconView? = null

  private var panelFrame: FrameLayout? = null
  private var panelRow: LinearLayout? = null
  private var rail: FrameLayout? = null
  private var railColumn: LinearLayout? = null
  private var railIndicator: View? = null
  private val railIcons = ArrayList<IconView>()
  private val railLabels = ArrayList<TextView>()
  private var railItemHeightPx = 52
  private var railIndicatorHeightPx = 42

  private var plate: LinearLayout? = null
  private var heading: TextView? = null
  private var subtitle: TextView? = null
  private var timerView: TextView? = null
  private var sectionTitle: TextView? = null
  private var sectionMeta: TextView? = null
  private var scroll: ScrollView? = null
  private var content: LinearLayout? = null
  private var statusView: TextView? = null
  private var sheetHost: FrameLayout? = null

  private val stripValues = HashMap<String, TextView>()
  private val valueViews = LinkedHashMap<String, TextView>()
  private val meterBars = HashMap<String, OverlayMeterBar>()
  private val gauges = HashMap<String, OverlayGauge>()
  private val segments = HashMap<String, OverlaySegmented>()
  private val switches = HashMap<String, OverlaySwitch>()
  private val tileNotes = HashMap<String, TextView>()
  private val cornerButtons = HashMap<String, TextView>()
  private var chart: OverlaySparkline? = null
  private var brightnessSlider: OverlaySlider? = null
  private var brightnessValue: TextView? = null

  private var params: WindowManager.LayoutParams? = null
  private var mode = Mode.HANDLE
  private var section = OverlayDashboard.TOOLS
  private var sessionOpacity: Double? = null
  private var status = ""
  private var networkResult = "--"
  private var last: Map<String, Any?> = emptyMap()
  private var lastMetrics: Map<String, Any?> = emptyMap()
  private var lastNetwork: Map<String, Any?> = emptyMap()
  private var cpuSeries = emptyList<Double?>()
  private var ramSeries = emptyList<Double?>()
  private var animator: ValueAnimator? = null
  private var peekPx = 8
  private var offPx = 15
  private var boostRing: OverlayBoostRing? = null
  private var accentColor = OverlayStyle.INK
  private var contentWidthPx = 0
  private val fpsSession = HashMap<String, Any?>()

  private val motionOff: Boolean get() = store.config().optBoolean("reducedMotion")

  fun show(expanded: Boolean = false): Boolean {
    if (root != null) return true
    if (!OverlaySupport.canDraw(context)) {
      OverlayBridge.error = OverlaySupport.reason(context)
      return false
    }
    accentColor = readAccent()
    val area = bounds()
    val rightDock = docked()
    val column = object : LinearLayout(context) {
      override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_OUTSIDE) {
          if (mode != Mode.HANDLE) action("collapse")
          return false
        }
        if (event.actionMasked == MotionEvent.ACTION_DOWN || event.actionMasked == MotionEvent.ACTION_MOVE) restoreIdle()
        return super.dispatchTouchEvent(event)
      }
    }.apply {
      orientation = LinearLayout.VERTICAL
      layoutDirection = View.LAYOUT_DIRECTION_LTR
      gravity = if (rightDock) Gravity.END else Gravity.START
    }

    val size = store.config().optInt("size", 56).coerceIn(48, 72)
    peekPx = dp(HandleGeometry.peekDp(size))
    offPx = dp(28)
    val handleHeight = dp(HandleGeometry.heightDp(size))
    handleBg = OverlayStyle.plate(
      context,
      14,
      "#191919",
      "#0a0a0a",
      OverlayStyle.tint(accentColor, 150),
    )
    handleContent = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      setPadding(0, dp(4), 0, dp(4))
    }
    // High-tech Cyber Gaming Capsule:
    // Symmetrical luminous neon pills flanking an inward indicator chevron
    handleContent!!.addView(
      View(context).apply { background = OverlayStyle.fill(context, 2, OverlayStyle.tint(accentColor, 230)) },
      LinearLayout.LayoutParams(dp(3), dp(9)),
    )
    val chevron = IconView(context).apply {
      setIcon(if (rightDock) IconView.BACK else IconView.FORWARD, OverlayStyle.INK)
      weightDp = 2.0f
    }
    handleChevron = chevron
    handleContent!!.addView(
      chevron,
      LinearLayout.LayoutParams(dp(13), dp(13)).apply { topMargin = dp(6); bottomMargin = dp(6) },
    )
    handleContent!!.addView(
      View(context).apply { background = OverlayStyle.fill(context, 2, OverlayStyle.tint(accentColor, 230)) },
      LinearLayout.LayoutParams(dp(3), dp(9)),
    )

    handleRow = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = if (rightDock) Gravity.START else Gravity.END
      background = handleBg
      contentDescription = "Optinix handle. Tap for the game assistant. Hold, then drag to move or switch edges."
      isFocusable = true
      alpha = handleOpacity()
      setOnClickListener { restoreIdle(); applyMode(Mode.DASHBOARD, true) }
    }
    handleRow!!.addView(handleContent, LinearLayout.LayoutParams(peekPx, LinearLayout.LayoutParams.MATCH_PARENT))
    drag(handleRow!!)
    column.addView(handleRow, LinearLayout.LayoutParams(peekPx + offPx, handleHeight))

    val panel = buildPanel(area)
    panel.visibility = View.GONE
    panelFrame = panel
    column.addView(panel, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      title = "Optinix gaming HUD"
      alpha = 1f
      layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30) {
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      } else {
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
      if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
    }

    return try {
      manager.addView(column, params)
      root = column
      OverlayBridge.showing = true
      selectSection(section, false)
      applyMode(if (expanded) Mode.DASHBOARD else Mode.HANDLE, false)
      column.post { dock(false) }
      armIdle()
      true
    } catch (error: Exception) {
      hide()
      OverlayBridge.error = error.message ?: "Overlay window was refused by Android."
      false
    }
  }

  fun hide() {
    animator?.cancel()
    root?.removeCallbacks(idleRunnable)
    root?.removeCallbacks(collapseRunnable)
    root?.let { try { manager.removeViewImmediate(it) } catch (_: Exception) {} }
    root = null
    panelFrame = null
    panelRow = null
    rail = null
    railColumn = null
    railIndicator = null
    railIcons.clear()
    railLabels.clear()
    plate = null
    scroll = null
    content = null
    chart = null
    handleRow = null
    handleContent = null
    handleBg = null
    handleChevron = null
    heading = null
    subtitle = null
    timerView = null
    sectionTitle = null
    sectionMeta = null
    statusView = null
    sheetHost = null
    brightnessSlider = null
    brightnessValue = null
    params = null
    stripValues.clear()
    valueViews.clear()
    meterBars.clear()
    gauges.clear()
    segments.clear()
    switches.clear()
    tileNotes.clear()
    cornerButtons.clear()
    OverlayBridge.showing = false
    OverlayBridge.expanded = false
  }

  fun reconfigure() {
    if (root == null) return
    val wasExpanded = mode == Mode.DASHBOARD
    // Rotation/inset changes rebuild the window, but the user should stay exactly where
    // they were reading: keep the section (already stored) and the scroll offset.
    val offset = scroll?.scrollY ?: 0
    hide()
    show(wasExpanded)
    render(last, lastMetrics)
    if (offset > 0) scroll?.post { scroll?.scrollTo(0, offset) }
  }

  fun resetPosition() {
    store.preferences.edit()
      .remove("dockPortrait").remove("dockLandscape")
      .remove("yPortrait").remove("yLandscape")
      .apply()
    dock(false)
  }

  fun setDock(right: Boolean) {
    store.preferences.edit().putBoolean(dockKey(), right).apply()
    dock(!motionOff)
  }

  /** App-side handle-side control: parks the collapsed handle on one edge
   *  for both orientations at once (drag still re-docks a single edge). */
  fun setSide(right: Boolean) {
    store.preferences.edit()
      .putBoolean("dockPortrait", right)
      .putBoolean("dockLandscape", right)
      .apply()
    dock(!motionOff)
  }

  fun resetSession() {
    networkResult = "--"
    lastNetwork = emptyMap()
    status = ""
    last = emptyMap()
    lastMetrics = emptyMap()
    cpuSeries = emptyList()
    ramSeries = emptyList()
    fpsSession.clear()
  }

  fun setSessionOpacity(value: Double) {
    sessionOpacity = value.coerceIn(0.4, 1.0)
    reconfigure()
  }

  fun clearSessionOpacity() { sessionOpacity = null }

  fun setExpanded(value: Boolean) {
    when {
      value -> if (mode == Mode.HANDLE) applyMode(Mode.DASHBOARD, true)
      mode != Mode.HANDLE -> collapseToHandle()
      else -> Unit
    }
  }

  fun setMessage(value: String) {
    status = value
    statusView?.text = statusText()
    root?.post { fit(); dock(false) }
  }

  fun setNetworkResult(value: String, details: Map<String, Any?> = emptyMap()) {
    networkResult = value
    lastNetwork = details
    setMessage(value)
    render(last, lastMetrics)
  }

  fun render(session: Map<String, Any?>, metrics: Map<String, Any?>, cpu: List<Double?> = emptyList(), ram: List<Double?> = emptyList()) {
    last = session
    lastMetrics = metrics
    if (cpu.isNotEmpty()) { cpuSeries = cpu.toList(); ramSeries = ram.toList() }

    val paused = session["paused"] == true
    val duration = duration((session["durationMs"] as? Number)?.toLong() ?: 0L)
    timerView?.text = if (paused) "$duration ‖" else duration
    heading?.text = (session["gameLabel"] as? String)?.takeIf { it.isNotBlank() } ?: "Gaming session"
    val profile = (session["profileShort"] as? String)?.takeIf { it.isNotBlank() } ?: "Balanced"
    subtitle?.text = "$profile  •  ${if (paused) "paused" else "live"}"

    val cpuValue = (metrics["cpuPercent"] as? Number)?.toDouble()
    val ramValue = (metrics["ramPercent"] as? Number)?.toDouble()
    val tempValue = (metrics["temperatureC"] as? Number)?.toDouble()
    val batteryValue = (metrics["batteryPercent"] as? Number)?.toDouble()

    stripValues["cpu"]?.apply {
      text = cpuValue?.let { "${it.roundToInt()}%" } ?: "--"
      setTextColor(OverlayStyle.metric(cpuValue, 80.0, 95.0))
    }
    stripValues["ram"]?.apply {
      text = ramValue?.let { "${it.roundToInt()}%" } ?: "--"
      setTextColor(OverlayStyle.metric(ramValue, 80.0, 95.0))
    }
    stripValues["temp"]?.apply {
      text = tempValue?.let { String.format(Locale.US, "%.0f°", it) } ?: "--"
      setTextColor(OverlayStyle.metric(tempValue, 45.0, 53.0))
    }
    stripValues["battery"]?.apply {
      text = batteryValue?.let { "${it.roundToInt()}%" + if (metrics["charging"] == true) " ⚡" else "" } ?: "--"
      setTextColor(OverlayStyle.metricLow(batteryValue, 25.0, 12.0))
    }

    valueViews["cpu"]?.apply {
      text = cpuValue?.let { "${it.roundToInt()}%" } ?: "--"
      setTextColor(OverlayStyle.metric(cpuValue, 80.0, 95.0))
    }
    valueViews["ram"]?.apply {
      text = ramValue?.let { "${it.roundToInt()}%" } ?: "--"
      setTextColor(OverlayStyle.metric(ramValue, 80.0, 95.0))
    }
    valueViews["temp"]?.apply {
      text = tempValue?.let { String.format(Locale.US, "%.1f°C", it) } ?: "--"
      setTextColor(OverlayStyle.metric(tempValue, 45.0, 53.0))
    }
    valueViews["battery"]?.apply {
      text = batteryValue?.let { "${it.roundToInt()}%" + if (metrics["charging"] == true) " ⚡" else "" } ?: "--"
      setTextColor(OverlayStyle.metricLow(batteryValue, 25.0, 12.0))
    }

    valueViews["boostFree"]?.apply {
      text = ramValue?.let { "${(100.0 - it).roundToInt().coerceIn(0, 100)}%" } ?: "--"
      setTextColor(OverlayStyle.metricLow(ramValue?.let { (100.0 - it).coerceIn(0.0, 100.0) }, 15.0, 8.0))
    }
    boostRing?.setFraction(
      ramValue?.let { ((100.0 - it).coerceIn(0.0, 100.0) / 100.0).toFloat() } ?: 0f,
    )

    // Meter bars and gauges only ever plot the number already on screen:
    // the measured value, or nothing at all until the sampler has one.
    meterBars["cpu"]?.setFraction(cpuValue?.let { (it / 100.0).toFloat() })
    meterBars["ram"]?.setFraction(ramValue?.let { (it / 100.0).toFloat() })
    meterBars["temp"]?.setFraction(tempValue?.let { ((it - 34.0) / 26.0).toFloat() })
    meterBars["battery"]?.setFraction(batteryValue?.let { (it / 100.0).toFloat() })
    gauges["cpu"]?.apply {
      fraction = cpuValue?.let { (it / 100.0).toFloat() } ?: -1f
      label = cpuValue?.let { "${it.roundToInt()}%" } ?: "--"
    }
    gauges["ram"]?.apply {
      fraction = ramValue?.let { (it / 100.0).toFloat() } ?: -1f
      label = ramValue?.let { "${it.roundToInt()}%" } ?: "--"
    }

    valueViews["interval"]?.text = (session["intervalMs"] as? Number)?.let { "${it.toLong() / 1000} s" } ?: "--"
    valueViews["reminder"]?.text = ((session["reminderMinutes"] as? Number)?.toInt() ?: 0).let { if (it > 0) "$it min" else "Off" }
    valueViews["dnd"]?.let { view -> view.text = if (DndController(context).active()) "Optinix rule on" else "Off" }
    valueViews["hz"]?.text = (metrics["refreshRate"] as? Number)?.let { "${it.toDouble().roundToInt()} Hz" } ?: "--"
    valueViews["refresh"]?.text = (metrics["refreshRate"] as? Number)?.let { "${it.toDouble().roundToInt()} Hz measured" } ?: "--"
    valueViews["thermal"]?.text = metrics["thermalLabel"] as? String ?: "--"
    valueViews["source"]?.text = metrics["temperatureSource"] as? String ?: "Unavailable"
    valueViews["foreground"]?.text = session["foregroundLabel"] as? String ?: "--"
    valueViews["cpuavg"]?.text = stat(session["cpuAverage"])
    valueViews["cpupeak"]?.text = stat(session["cpuPeak"])
    valueViews["ramavg"]?.text = stat(session["ramAverage"])
    valueViews["temppeak"]?.text = (session["tempPeak"] as? Number)?.let { String.format(Locale.US, "%.1f°C", it.toDouble()) } ?: "--"
    valueViews["drain"]?.text = (session["batteryDrainPerHour"] as? Number)?.let { String.format(Locale.US, "%.1f%%/h", it.toDouble()) } ?: "--"
    valueViews["samples"]?.text = (session["samples"] as? Number)?.toInt()?.toString() ?: "0"
    valueViews["freeRam"]?.text = (metrics["ramFreeBytes"] as? Number)?.toLong()?.let { Formatter.formatShortFileSize(context, it) } ?: "--"
    valueViews["optimize"]?.text = OverlayAdvice.summarize(metrics)
    valueViews["mode"]?.text = "Applied: $profile — Optinix controls only"

    valueViews["netMs"]?.text = (lastNetwork["averageMs"] as? Number)?.let { it.toDouble().roundToInt().toString() } ?: "--"
    valueViews["jitter"]?.text = (lastNetwork["jitterMs"] as? Number)?.let { "${it.toDouble().roundToInt()} ms" } ?: "--"
    valueViews["transport"]?.text = when (lastNetwork["transport"] as? String) {
      "wifi" -> "Wi-Fi"
      "cellular" -> "Mobile data"
      "vpn" -> "VPN"
      "ethernet" -> "Ethernet"
      "offline" -> "Offline"
      "other" -> "Other"
      else -> "--"
    }
    valueViews["validated"]?.text = when (lastNetwork["validated"] as? Boolean) { true -> "Yes"; false -> "No"; null -> "--" }
    valueViews["metered"]?.text = when (lastNetwork["metered"] as? Boolean) { true -> "Yes"; false -> "No"; null -> "--" }
    valueViews["dns"]?.text = (lastNetwork["dnsMs"] as? Number)?.let { "${it.toDouble().roundToInt()} ms" }
      ?: (lastNetwork["dnsError"] as? String ?: "--")
    valueViews["target"]?.text = host(lastNetwork["target"] as? String) ?: "--"

    segments["mode"]?.select(OverlayDashboard.modeForProfile(session["profileId"] as? String), false)
    segments["fpsMode"]?.select(fpsMode(), false)
    segments["fpsScale"]?.select(OverlayDashboard.nearestScale(fpsScale()).toString(), false)
    segments["fpsOpacity"]?.select(OverlayDashboard.nearestOpacity(fpsOpacity()).toString(), false)
    switches["fps"]?.setChecked(session["fpsHudEnabled"] == true, false)
    OverlayDashboard.metrics().forEach { (id) -> switches["metric:$id"]?.setChecked(fpsMetrics().contains(id), false) }
    paintCorners()

    // System state reads are binder calls: only resolve them while their
    // controls are actually on screen (the panel is rebuilt on every section
    // switch, so the maps are empty when nothing of that kind is visible).
    if (tileNotes.isNotEmpty()) {
      tileNotes["dnd"]?.text = if (DndController(context).active()) "On" else "Off"
      tileNotes["rotate"]?.text = when (OverlaySystem.rotationLocked(context)) { true -> "Locked"; false -> "Free"; null -> "--" }
      tileNotes["record"]?.text = if (CaptureService.recording) "Recording" else "Silent"
      tileNotes["timer"]?.text = if (paused) "Paused" else "Running"
    }

    if (brightnessValue != null) {
      if (OverlaySystem.canWrite(context)) {
        val brightness = OverlaySystem.brightness(context)
        if (brightness != null) {
          if (brightnessSlider?.dragging != true) brightnessSlider?.setValue(brightness)
          brightnessValue?.text = "${(brightness * 100).roundToInt()}%"
        } else {
          brightnessValue?.text = "--"
        }
      } else {
        brightnessValue?.text = "Needs access"
      }
    }

    if (section == OverlayDashboard.STATS && cpuSeries.isNotEmpty()) chart?.setSeries(cpuSeries, ramSeries)
    sectionMeta?.text = sectionMetaText()
    statusView?.text = statusText()
  }

  // ------------------------------------------------------------------ panel

  private fun buildPanel(area: Rect): FrameLayout {
    val frame = FrameLayout(context)
    val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; isBaselineAligned = false }
    val railView = buildRail(area)
    val plateView = buildPlate()
    row.addView(railView, LinearLayout.LayoutParams(railWidth(area), LinearLayout.LayoutParams.MATCH_PARENT))
    row.addView(plateView, LinearLayout.LayoutParams(contentWidth(area), LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8) })
    frame.addView(row, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    val host = FrameLayout(context).apply { visibility = View.GONE; isClickable = true }
    frame.addView(host, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    panelRow = row
    rail = railView
    railColumn = columnOf(railView)
    plate = plateView
    sheetHost = host
    return frame
  }

  private fun buildRail(area: Rect): FrameLayout {
    val width = railWidth(area)
    railItemHeightPx = railItemHeight(area)
    railIndicatorHeightPx = (railItemHeightPx - dp(8)).coerceAtLeast(dp(32))
    val view = FrameLayout(context).apply {
      background = OverlayStyle.plate(context, 18, OverlayStyle.RAIL_TOP, OverlayStyle.RAIL_BOTTOM, OverlayStyle.tint(accentColor, 70))
    }
    val indicator = View(context).apply {
      background = OverlayStyle.fill(context, 11, OverlayStyle.tint(accentColor, 45))
      visibility = View.INVISIBLE
    }
    railIndicator = indicator
    view.addView(
      indicator,
      FrameLayout.LayoutParams((width - dp(10)).coerceAtLeast(dp(36)), railIndicatorHeightPx).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
      },
    )
    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(4), dp(8), dp(4), dp(8))
    }
    val brand = FrameLayout(context)
    brand.addView(
      IconView(context).apply { setIcon(IconView.MARK, accentColor) },
      FrameLayout.LayoutParams(dp(17), dp(17)).apply { gravity = Gravity.CENTER },
    )
    column.addView(brand, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(30)))
    railIcons.clear()
    railLabels.clear()
    OverlayDashboard.sections.forEachIndexed { index, item ->
      val cell = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        isClickable = true
        isFocusable = true
        contentDescription = item.label
        setOnClickListener { tapped -> haptic(tapped); selectSection(index, true) }
      }
      val icon = IconView(context).apply { setIcon(item.icon, if (index == section) accentColor else OverlayStyle.MUTED) }
      cell.addView(icon, LinearLayout.LayoutParams(dp(19), dp(19)))
      val label = OverlayStyle.text(
        context,
        item.label,
        8f,
        if (index == section) OverlayStyle.INK else OverlayStyle.MUTED,
        "Inter_600SemiBold",
      ).apply {
        gravity = Gravity.CENTER
        maxLines = 1
        setPadding(0, dp(3), 0, 0)
      }
      cell.addView(label)
      railIcons.add(icon)
      railLabels.add(label)
      column.addView(cell, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, railItemHeightPx))
    }
    view.addView(column, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    railColumn = column
    return view
  }

  private fun columnOf(railView: FrameLayout): LinearLayout? =
    (0 until railView.childCount).map { railView.getChildAt(it) }.filterIsInstance<LinearLayout>().firstOrNull()

  private fun buildPlate(): LinearLayout {
    val view = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(13), dp(11), dp(13), dp(10))
      background = OverlayStyle.plate(context, 16)
      elevation = dp(8).toFloat()
    }

    val header = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    header.addView(
      IconView(context).apply { setIcon(IconView.MARK, accentColor) },
      LinearLayout.LayoutParams(dp(13), dp(13)).apply { marginEnd = dp(6) },
    )
    header.addView(
      OverlayStyle.text(context, "OPTINIX", 9.5f, accentColor, "PlusJakartaSans_700Bold").apply { letterSpacing = 0.16f },
    )
    header.addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
    timerView = OverlayStyle.text(context, "--:--", 11f, OverlayStyle.SECONDARY, "JetBrainsMono_500Medium")
    header.addView(timerView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp(4) })
    header.addView(
      iconButton(IconView.BACK, "Minimize the game panel") { action("collapse") },
      LinearLayout.LayoutParams(dp(28), dp(28)).apply { marginStart = dp(2) },
    )
    header.addView(
      iconButton(IconView.CLOSE, "End the gaming session") { confirmStop() },
      LinearLayout.LayoutParams(dp(28), dp(28)).apply { marginStart = dp(4) },
    )
    view.addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(32)))

    val titleRow = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, dp(7)) }
    heading = OverlayStyle.text(context, "Gaming session", 16.5f, OverlayStyle.INK, "PlusJakartaSans_700Bold").apply {
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
    }
    titleRow.addView(heading)
    subtitle = OverlayStyle.text(context, "Balanced  •  live", 9.5f, OverlayStyle.MUTED).apply {
      setPadding(0, dp(2), 0, 0)
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
    }
    titleRow.addView(subtitle)
    view.addView(titleRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    val strip = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      background = OverlayStyle.solid(context, 10, Color.parseColor("#161616"), OverlayStyle.HAIRLINE_SOFT)
      setPadding(dp(10), dp(7), dp(10), dp(7))
    }
    listOf("cpu" to "CPU", "ram" to "RAM", "temp" to "TEMP", "battery" to "BATTERY").forEach { (key, label) ->
      val cell = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
      cell.addView(OverlayStyle.text(context, label, 7.5f, OverlayStyle.MUTED, "Inter_600SemiBold").apply { letterSpacing = 0.12f })
      val value = OverlayStyle.text(context, "--", 13f, OverlayStyle.INK, "JetBrainsMono_700Bold")
      cell.addView(value, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(1) })
      stripValues[key] = value
      strip.addView(cell, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    }
    view.addView(strip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    view.addView(
      View(context).apply { setBackgroundColor(Color.parseColor("#1AFFFFFF")) },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1).apply { topMargin = dp(9); bottomMargin = dp(2) },
    )

    val sectionRow = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(0, dp(3), 0, dp(4))
    }
    sectionTitle = OverlayStyle.text(context, "Performance", 12f, OverlayStyle.INK, "Inter_600SemiBold")
    sectionRow.addView(sectionTitle, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    sectionMeta = OverlayStyle.text(context, "", 8.5f, OverlayStyle.QUIET, "JetBrainsMono_500Medium")
    sectionRow.addView(sectionMeta)
    view.addView(sectionRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    val scrollView = ScrollView(context).apply {
      isVerticalScrollBarEnabled = true
      scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
      scrollBarSize = dp(2)
      overScrollMode = View.OVER_SCROLL_ALWAYS
      clipToPadding = false
    }
    val body = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    scrollView.addView(body, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    scroll = scrollView
    content = body
    view.addView(scrollView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(220)))

    statusView = OverlayStyle.text(context, "", 9.5f, OverlayStyle.MUTED).apply {
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
      setPadding(0, dp(8), 0, 0)
    }
    view.addView(statusView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    return view
  }

  private fun selectSection(index: Int, animate: Boolean) {
    if (index !in OverlayDashboard.sections.indices) return
    val direction = if (index >= section) 1 else -1
    section = index
    updateRail(true)
    val body = content ?: return
    if (!animate || motionOff) {
      renderSection()
      fit()
      dock(false)
      return
    }
    body.animate().cancel()
    body.animate().alpha(0f).translationX((direction * dp(9)).toFloat()).setDuration(90).withEndAction {
      renderSection()
      fit()
      dock(false)
      body.animate().cancel()
      body.alpha = 0f
      body.translationX = (-direction * dp(9)).toFloat()
      body.animate().alpha(1f).translationX(0f).setDuration(160).setInterpolator(DecelerateInterpolator()).start()
    }.start()
  }

  private fun updateRail(animate: Boolean) {
    railIcons.forEachIndexed { index, icon -> icon.applyTint(if (index == section) accentColor else OverlayStyle.MUTED) }
    railLabels.forEachIndexed { index, label ->
      label.setTextColor(if (index == section) OverlayStyle.INK else OverlayStyle.MUTED)
    }
    val indicator = railIndicator ?: return
    indicator.visibility = View.VISIBLE
    val target = dp(8) + dp(30) + section * railItemHeightPx + (railItemHeightPx - railIndicatorHeightPx) / 2
    if (!animate || motionOff) {
      indicator.translationY = target.toFloat()
      return
    }
    indicator.animate().translationY(target.toFloat()).setDuration(200).setInterpolator(DecelerateInterpolator()).start()
  }

  private fun renderSection() {
    val body = content ?: return
    body.removeAllViews()
    body.translationX = 0f
    body.alpha = 1f
    valueViews.clear()
    segments.clear()
    switches.clear()
    tileNotes.clear()
    cornerButtons.clear()
    meterBars.clear()
    gauges.clear()
    chart = null
    brightnessSlider = null
    brightnessValue = null
    boostRing = null
    sectionTitle?.text = OverlayDashboard.sections[section].label
    sectionMeta?.text = sectionMetaText()
    when (section) {
      OverlayDashboard.TOOLS -> buildTools(body)
      OverlayDashboard.BOOST -> buildBoost(body)
      else -> buildStats(body)
    }
    render(last, lastMetrics)
  }

  // --------------------------------------------------------------- sections

  private fun buildBoost(body: LinearLayout) {
    val modes = OverlaySegmented(context).apply {
      accent = accentColor
      setOptions(listOf("power" to "Power saving", "balanced" to "Balanced", "pro" to "Pro gamer"))
      onSelect = { requestMode(it) }
      contentDescription = "Performance profile"
    }
    modes.select(OverlayDashboard.modeForProfile(last["profileId"] as? String), false)
    segments["mode"] = modes
    body.addView(modes, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(38)))

    val applied = OverlayStyle.text(context, "", 9.5f, OverlayStyle.MUTED).apply {
      setPadding(0, dp(6), 0, 0)
      maxLines = 2
    }
    valueViews["mode"] = applied
    body.addView(applied)

    addBody(sectionLabel("MEMORY"), 12)
    val memoryCard = bodyCard()
    val memoryRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    boostRing = OverlayBoostRing(context).apply {
      accent = accentColor
      animated = !motionOff
      contentDescription = "Measured free memory, with a boost action"
    }
    memoryRow.addView(boostRing, LinearLayout.LayoutParams(dp(52), dp(52)))
    val memoryColumn = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, 0, 0) }
    memoryColumn.addView(
      OverlayStyle.text(context, "FREE MEMORY", 8f, OverlayStyle.QUIET, "Inter_600SemiBold").apply { letterSpacing = 0.14f },
    )
    valueViews["boostFree"] = OverlayStyle.text(context, "--", 15f, OverlayStyle.INK, "JetBrainsMono_700Bold").apply {
      setPadding(0, dp(2), 0, 0)
    }
    memoryColumn.addView(valueViews["boostFree"])
    memoryRow.addView(memoryColumn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    memoryCard.addView(memoryRow)
    memoryCard.addView(
      pillButton("Boost sweep", primary = true) { boostRing?.sweep(); action("boost") },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(34)).apply { topMargin = dp(10) },
    )
    addBody(memoryCard, 4)
    addBody(note("Free memory = 100% − the measured RAM reading. Boost clears only Optinix's own cache."), 4)

    addBody(sectionLabel("APPLIED BY OPTINIX"), 12)
    val card = bodyCard()
    card.addView(row("interval", "Sampling interval"))
    card.addView(row("reminder", "Break reminder"))
    card.addView(row("dnd", "Optinix DND rule"))
    card.addView(row("limits", "CPU / GPU limits"))
    valueViews["limits"]?.text = "Game / phone"
    addBody(card, 3)

    val hzCard = bodyCard()
    val hzRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    hzRow.addView(OverlayStyle.text(context, "Display refresh", 10f, OverlayStyle.MUTED), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    valueViews["hz"] = OverlayStyle.text(context, "--", 10.5f, OverlayStyle.SECONDARY, "JetBrainsMono_500Medium").apply { gravity = Gravity.END }
    hzRow.addView(valueViews["hz"], LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    hzCard.addView(hzRow)
    hzCard.addView(
      pillButton("Display settings") { action("display") },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(32)).apply { topMargin = dp(6) },
    )
    addBody(hzCard, 5)

    addBody(sectionLabel("DEVICE REVIEW"), 12)
    val adviceCard = bodyCard()
    adviceCard.addView(OverlayStyle.text(context, "MEASURED NOW", 8f, OverlayStyle.QUIET, "Inter_600SemiBold").apply { letterSpacing = 0.14f })
    val advice = OverlayStyle.text(context, "Collecting a sample…", 11f, OverlayStyle.SECONDARY).apply {
      setPadding(0, dp(4), 0, 0)
      maxLines = 4
    }
    valueViews["optimize"] = advice
    adviceCard.addView(advice)
    addBody(adviceCard, 3)

    metricGrid(listOf("freeRam" to "AVAILABLE RAM", "thermal" to "THERMAL", "battery" to "BATTERY", "samples" to "SAMPLES"))

    val actions = listOf(
      "Review memory" to "memory",
      "Clean cache" to "cache",
      "Processes" to "processes",
      "Startup" to "startup",
      "App management" to "appmgmt",
      "Battery" to "battery",
    )
    actions.chunked(2).forEachIndexed { index, pair ->
      val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
      pair.forEach { (label, key) ->
        line.addView(
          pillButton(label) { action(key) },
          LinearLayout.LayoutParams(0, dp(38), 1f).apply { if (line.childCount > 0) marginStart = dp(4) },
        )
      }
      addBody(line, if (index == 0) 8 else 5)
    }

    addBody(note("Modes and boost touch Optinix controls only. No ordinary app can kill others — Optinix reports and routes system steps instead."), 6)
  }

  private fun buildTools(body: LinearLayout) {
    buildBrightnessCard(body)
    val rotation = OverlaySystem.rotationLocked(context)
    val dnd = DndController(context)
    val tiles = listOf(
      ToolSpec("dnd", IconView.DND, "Do not disturb", if (dnd.active()) "On" else "Off", dnd.active()) { action("dnd") },
      ToolSpec("shot", IconView.CAMERA, "Screenshot", "Consent", false) { action("screenshot") },
      ToolSpec("record", IconView.RECORD, "Recording", "Silent", CaptureService.recording) { action("record") },
      ToolSpec("rotate", IconView.ROTATE, "Rotation", when (rotation) { true -> "Locked"; false -> "Free"; null -> "--" }, rotation == true) { action("rotate") },
      ToolSpec("net", IconView.NETWORK, "Net test", "HTTPS", false) { action("network") },
      ToolSpec("alerts", IconView.BELL, "Alerts", "Settings", false) { action("notifications") },
      ToolSpec("stats", IconView.MONITOR, "Stats", "Gauges", false) { selectSection(OverlayDashboard.STATS, true) },
      ToolSpec("clean", IconView.OPTIMIZE, "Clean up", "Own cache", false) { action("cache") },
      ToolSpec("apps", IconView.APPS, "Apps", "Android", false) { action("appmgmt") },
      ToolSpec("macros", IconView.CHECK, "Macros", "Studio", false) { action("macros") },
      ToolSpec("timer", IconView.TIMER, "Timer", if (last["paused"] == true) "Paused" else "Running", false) { action("timer") },
      ToolSpec("display", IconView.SETTINGS, "Display", "Settings", false) { action("display") },
    )
    addBody(sectionLabel("GAME TOOLS"), 12)
    toolGrid(tiles)
    addBody(note("Real actions only. Screenshot/recording ask Android's consent; brightness needs modify-settings access."), 4)

    addBody(sectionLabel("NETWORK CHECK"), 12)
    val netCard = bodyCard()
    val netRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    val netLeft = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    netLeft.addView(OverlayStyle.text(context, "HTTPS RESULT", 8f, OverlayStyle.MUTED, "Inter_600SemiBold").apply { letterSpacing = 0.12f })
    valueViews["netMs"] = OverlayStyle.text(context, "--", 22f, OverlayStyle.INK, "JetBrainsMono_700Bold").apply { setPadding(0, dp(2), 0, 0) }
    netLeft.addView(valueViews["netMs"])
    netLeft.addView(
      OverlayStyle.text(context, "not game-server ping", 8.5f, OverlayStyle.QUIET),
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(1) },
    )
    netRow.addView(netLeft, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val netRight = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    netRight.addView(OverlayStyle.text(context, "JITTER", 8f, OverlayStyle.MUTED, "Inter_600SemiBold").apply { letterSpacing = 0.12f })
    valueViews["jitter"] = OverlayStyle.text(context, "--", 13f, OverlayStyle.SECONDARY, "JetBrainsMono_500Medium").apply {
      setPadding(0, dp(2), 0, 0)
      gravity = Gravity.END
    }
    netRight.addView(valueViews["jitter"], LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    netRow.addView(netRight, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    netCard.addView(netRow)
    netCard.addView(row("target", "Target"))
    netCard.addView(row("transport", "Connection"))
    netCard.addView(row("metered", "Metered network"))
    netCard.addView(
      pillButton("Run test", primary = true) { action("network") },
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(34)).apply { topMargin = dp(8) },
    )
    addBody(netCard, 3)
    addBody(note("Real HTTPS request. It cannot lower ping — that is a manufacturer feature."), 6)
  }

  private fun buildBrightnessCard(body: LinearLayout) {
    val card = bodyCard()
    val header = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    header.addView(
      IconView(context).apply { setIcon(IconView.SUN, OverlayStyle.SECONDARY) },
      LinearLayout.LayoutParams(dp(15), dp(15)).apply { marginEnd = dp(7) },
    )
    header.addView(OverlayStyle.text(context, "Brightness", 11f, OverlayStyle.INK, "Inter_600SemiBold"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    brightnessValue = OverlayStyle.text(context, "--", 11f, OverlayStyle.SECONDARY, "JetBrainsMono_500Medium")
    header.addView(brightnessValue)
    card.addView(header)
    if (OverlaySystem.canWrite(context)) {
      val slider = OverlaySlider(context).apply {
        accent = accentColor
        setValue(OverlaySystem.brightness(context) ?: 0.5f)
        contentDescription = "Screen brightness"
        onPreview = { fraction -> brightnessValue?.text = "${(fraction * 100).roundToInt()}%" }
        onCommit = { fraction -> action("bright:$fraction") }
      }
      brightnessSlider = slider
      card.addView(slider, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(30)).apply { topMargin = dp(4) })
    } else {
      card.addView(
        OverlayStyle.text(
          context,
          "Needs Android's Modify system settings access. Without it the HUD cannot change brightness.",
          9.5f,
          OverlayStyle.MUTED,
        ).apply { setPadding(0, dp(6), 0, 0); maxLines = 2 },
      )
      card.addView(
        pillButton("Allow access") { action("write") },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(34)).apply { topMargin = dp(6) },
      )
    }
    addBody(card, 2)
  }

  private fun buildStats(body: LinearLayout) {
    val gaugeCard = bodyCard()
    val gaugesRow = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    fun gaugeCell(key: String, title: String): LinearLayout = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      if (key == "ram") setPadding(dp(6), 0, 0, 0)
      val gauge = OverlayGauge(context).apply { accent = accentColor }
      gauges[key] = gauge
      addView(gauge, LinearLayout.LayoutParams(dp(72), dp(72)))
      addView(
        OverlayStyle.text(context, title, 8f, OverlayStyle.MUTED, "Inter_600SemiBold").apply { letterSpacing = 0.12f },
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5) },
      )
    }
    gaugesRow.addView(gaugeCell("cpu", "CPU LOAD"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    gaugesRow.addView(gaugeCell("ram", "RAM USE"), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    gaugeCard.addView(gaugesRow)
    addBody(gaugeCard, 2)

    metricGrid(listOf("cpu" to "CPU LOAD", "ram" to "RAM", "temp" to "TEMPERATURE", "battery" to "BATTERY"))

    val chartCard = bodyCard()
    val legend = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    legend.addView(dot(accentColor), LinearLayout.LayoutParams(dp(6), dp(6)).apply { marginEnd = dp(4) })
    legend.addView(OverlayStyle.text(context, "CPU", 8.5f, OverlayStyle.MUTED, "Inter_600SemiBold"))
    legend.addView(dot(Color.parseColor("#8a8a8a")), LinearLayout.LayoutParams(dp(6), dp(6)).apply { marginStart = dp(10); marginEnd = dp(4) })
    legend.addView(OverlayStyle.text(context, "RAM", 8.5f, OverlayStyle.MUTED, "Inter_600SemiBold"))
    legend.addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
    legend.addView(OverlayStyle.text(context, "session", 8.5f, OverlayStyle.QUIET, "JetBrainsMono_500Medium"))
    chartCard.addView(legend)
    chart = OverlaySparkline(context).apply { setAccent(accentColor) }
    chartCard.addView(chart, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)).apply { topMargin = dp(5) })
    addBody(chartCard, 5)

    val card = bodyCard()
    card.addView(row("thermal", "Thermal status"))
    card.addView(row("refresh", "Display refresh"))
    card.addView(row("source", "Temperature sensor"))
    card.addView(row("foreground", "Foreground app"))
    addBody(card, 5)

    val aggregates = bodyCard()
    aggregates.addView(row("cpuavg", "CPU average"))
    aggregates.addView(row("cpupeak", "CPU peak"))
    aggregates.addView(row("ramavg", "RAM average"))
    aggregates.addView(row("temppeak", "Peak temperature"))
    aggregates.addView(row("drain", "Battery drain"))
    addBody(aggregates, 5)
    addBody(note("Rings and values are the session sampler's own numbers; unmeasured stays --. Display Hz is not game FPS."), 5)

    addBody(switchRow("Stats HUD", "Touch-free plate over the game", last["fpsHudEnabled"] == true, "fps") { action("fps:toggle") }, 8)
    addBody(sectionLabel("MODE"), 10)
    val modeControl = OverlaySegmented(context).apply {
      accent = accentColor
      setOptions(listOf("minimal" to "Minimal", "compact" to "Compact", "detailed" to "Detailed"))
      onSelect = { id ->
        fpsSession["mode"] = id
        action("fps:mode:$id")
        content?.post { renderSection(); fit(); dock(false) }
      }
    }
    modeControl.select(fpsMode(), false)
    segments["fpsMode"] = modeControl
    body.addView(modeControl, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(36)))

    addBody(sectionLabel("CORNER"), 10)
    OverlayDashboard.corners().chunked(2).forEachIndexed { index, pair ->
      val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
      pair.forEach { (id, label) ->
        val button = OverlayStyle.text(context, label, 9.5f, OverlayStyle.MUTED, "Inter_600SemiBold").apply {
          gravity = Gravity.CENTER
          isClickable = true
          isFocusable = true
          contentDescription = "Stats HUD corner: $label"
          background = OverlayStyle.solid(context, 8, Color.parseColor(OverlayStyle.CONTROL))
          setOnClickListener { tapped ->
            haptic(tapped)
            animatePress(tapped)
            fpsSession["corner"] = id
            action("fps:corner:$id")
            paintCorners()
          }
        }
        cornerButtons[id] = button
        line.addView(button, LinearLayout.LayoutParams(0, dp(32), 1f).apply { if (line.childCount > 0) marginStart = dp(4) })
      }
      addBody(line, if (index == 0) 3 else 4)
    }

    addBody(sectionLabel("SIZE"), 10)
    val scaleControl = OverlaySegmented(context).apply {
      accent = accentColor
      setOptions(OverlayDashboard.scaleOptions().map { it.first.toString() to it.second })
      onSelect = { id -> fpsSession["scale"] = id.toDoubleOrNull() ?: 1.0; action("fps:scale:$id") }
    }
    scaleControl.select(OverlayDashboard.nearestScale(fpsScale()).toString(), false)
    segments["fpsScale"] = scaleControl
    body.addView(scaleControl, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(36)))

    addBody(sectionLabel("OPACITY"), 10)
    val opacityControl = OverlaySegmented(context).apply {
      accent = accentColor
      setOptions(OverlayDashboard.opacityOptions().map { it.first.toString() to it.second })
      onSelect = { id -> fpsSession["opacity"] = id.toDoubleOrNull() ?: 0.9; action("fps:opacity:$id") }
    }
    opacityControl.select(OverlayDashboard.nearestOpacity(fpsOpacity()).toString(), false)
    segments["fpsOpacity"] = opacityControl
    body.addView(opacityControl, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(36)))

    if (fpsMode() == "detailed") {
      addBody(sectionLabel("VISIBLE METRICS"), 10)
      OverlayDashboard.metrics().forEach { (id, label) ->
        body.addView(switchRow(label, "", fpsMetrics().contains(id), "metric:$id") { on ->
          val next = if (on) fpsMetrics() + id else fpsMetrics() - id
          fpsSession["metrics"] = next
          action("fps:metric:$id")
        })
      }
    }

    addBody(note("Appearance is for this session. Game FPS stays --: Android never exposes another app's frames."), 6)
    paintCorners()
  }

  // -------------------------------------------------------------- fragments

  private fun addBody(view: View, top: Int = 6) {
    content?.addView(
      view,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(top) },
    )
  }

  private fun bodyCard(): LinearLayout = LinearLayout(context).apply {
    orientation = LinearLayout.VERTICAL
    setPadding(dp(10), dp(8), dp(10), dp(8))
    background = OverlayStyle.solid(context, 10, Color.parseColor(OverlayStyle.TILE))
  }

  private fun sectionLabel(value: String): TextView = OverlayStyle.text(context, value, 8f, OverlayStyle.QUIET, "Inter_600SemiBold").apply {
    letterSpacing = 0.14f
    setPadding(dp(2), 0, 0, dp(1))
  }

  private fun note(value: String): TextView = OverlayStyle.text(context, value, 9.5f, OverlayStyle.MUTED).apply {
    setPadding(0, dp(4), 0, dp(2))
    maxLines = 4
  }

  private fun row(key: String, label: String): LinearLayout {
    val line = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(0, dp(4), 0, dp(4))
    }
    line.addView(OverlayStyle.text(context, label, 10f, OverlayStyle.MUTED), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val value = OverlayStyle.text(context, "--", 10.5f, OverlayStyle.SECONDARY, "JetBrainsMono_500Medium").apply {
      gravity = Gravity.END
      maxLines = 1
      ellipsize = TextUtils.TruncateAt.END
    }
    line.addView(value, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    valueViews[key] = value
    return line
  }

  private fun metricGrid(entries: List<Pair<String, String>>) {
    entries.chunked(2).forEachIndexed { index, pair ->
      val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
      pair.forEach { (key, label) ->
        val tile = LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(dp(10), dp(8), dp(10), dp(8))
          background = OverlayStyle.solid(context, 10, Color.parseColor(OverlayStyle.TILE))
        }
        tile.addView(OverlayStyle.text(context, label, 8.5f, OverlayStyle.MUTED, "Inter_600SemiBold").apply { letterSpacing = 0.08f })
        val value = OverlayStyle.text(context, "--", 14f, OverlayStyle.INK, "JetBrainsMono_700Bold").apply {
          setPadding(0, dp(3), 0, 0)
          maxLines = 1
        }
        tile.addView(value)
        valueViews[key] = value
        if (key in METER_TILE_KEYS) {
          val bar = OverlayMeterBar(context).apply { accent = accentColor }
          meterBars[key] = bar
          tile.addView(
            bar,
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)).apply { topMargin = dp(6) },
          )
        }
        line.addView(tile, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { if (line.childCount > 0) marginStart = dp(4) })
      }
      addBody(line, if (index == 0) 2 else 5)
    }
  }

  private fun toolGrid(specs: List<ToolSpec>) {
    specs.chunked(3).forEachIndexed { index, chunk ->
      val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
      chunk.forEach { spec ->
        val tile = LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          setPadding(dp(3), dp(7), dp(3), dp(5))
          background = if (spec.active) {
            OverlayStyle.solid(context, 12, Color.parseColor(OverlayStyle.TILE), OverlayStyle.tint(accentColor, 140))
          } else {
            OverlayStyle.solid(context, 12, Color.parseColor(OverlayStyle.TILE))
          }
          isClickable = true
          isFocusable = true
          contentDescription = "${spec.label}. ${spec.note}"
          setOnClickListener { tapped -> haptic(tapped); animatePress(tapped); restoreIdle(); spec.onClick() }
        }
        tile.addView(
          IconView(context).apply { setIcon(spec.icon, if (spec.active) accentColor else OverlayStyle.SECONDARY) },
          LinearLayout.LayoutParams(dp(22), dp(22)),
        )
        tile.addView(
          OverlayStyle.text(context, spec.label, 9f, OverlayStyle.INK, "Inter_600SemiBold").apply {
            gravity = Gravity.CENTER
            maxLines = 1
            setPadding(0, dp(4), 0, 0)
          },
        )
        val noteView = OverlayStyle.text(context, spec.note, 8f, OverlayStyle.MUTED).apply { gravity = Gravity.CENTER; maxLines = 1 }
        tileNotes[spec.key] = noteView
        tile.addView(noteView)
        line.addView(tile, LinearLayout.LayoutParams(0, dp(70), 1f).apply { if (line.childCount > 0) marginStart = dp(4) })
      }
      repeat(3 - chunk.size) { line.addView(View(context), LinearLayout.LayoutParams(0, dp(70), 1f)) }
      addBody(line, if (index == 0) 3 else 5)
    }
  }

  private fun switchRow(label: String, detail: String, checked: Boolean, key: String, onChange: (Boolean) -> Unit): LinearLayout {
    val line = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(0, dp(5), 0, dp(5))
    }
    val column = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    column.addView(OverlayStyle.text(context, label, 10.5f, OverlayStyle.INK, "Inter_600SemiBold"))
    if (detail.isNotBlank()) {
      column.addView(OverlayStyle.text(context, detail, 9f, OverlayStyle.MUTED).apply { setPadding(0, dp(2), 0, 0); maxLines = 2 })
    }
    line.addView(column, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val toggle = OverlaySwitch(context).apply {
      accent = accentColor
      setChecked(checked, false)
      onToggle = onChange
    }
    switches[key] = toggle
    line.addView(toggle, LinearLayout.LayoutParams(dp(42), dp(26)).apply { marginStart = dp(10) })
    return line
  }

  private fun pillButton(label: String, primary: Boolean = false, onClick: () -> Unit): TextView =
    OverlayStyle.text(
      context,
      label,
      10.5f,
      if (primary) OverlayStyle.onAccent(accentColor) else OverlayStyle.INK,
      "Inter_600SemiBold",
    ).apply {
      gravity = Gravity.CENTER
      isClickable = true
      isFocusable = true
      contentDescription = label
      background = if (primary) OverlayStyle.fill(context, 8, accentColor)
      else OverlayStyle.solid(context, 8, Color.parseColor(OverlayStyle.CONTROL))
      setOnClickListener { tapped -> haptic(tapped); animatePress(tapped); restoreIdle(); onClick() }
    }

  private fun iconButton(icon: String, description: String, onClick: () -> Unit): IconView =
    IconView(context).apply {
      setIcon(icon, OverlayStyle.SECONDARY)
      background = OverlayStyle.fill(context, 8, Color.parseColor("#1FFFFFFF"))
      isClickable = true
      isFocusable = true
      contentDescription = description
      setOnClickListener { tapped -> haptic(tapped); animatePress(tapped); restoreIdle(); onClick() }
    }

  private fun dot(color: Int): View = View(context).apply { background = OverlayStyle.fill(context, 3, color) }

  private fun paintCorners() {
    cornerButtons.forEach { (id, view) ->
      val on = id == fpsCorner()
      view.background = if (on) {
        OverlayStyle.solid(context, 8, OverlayStyle.tint(accentColor, 40), OverlayStyle.tint(accentColor, 150))
      } else {
        OverlayStyle.solid(context, 8, Color.parseColor(OverlayStyle.CONTROL))
      }
      view.setTextColor(if (on) accentColor else OverlayStyle.MUTED)
    }
  }

  private fun requestMode(mode: String) {
    if (OverlayDashboard.profileForMode(mode) == null) return
    val label = when (mode) {
      "power" -> "Power saving"
      "pro" -> "Pro gamer"
      else -> "Balanced"
    }
    if (!OverlayDashboard.needsConfirmation(mode)) {
      action("mode:$mode")
      return
    }
    showSheet(
      "Apply $label?",
      "Optinix samples every 2 seconds and keeps a 30-minute break reminder for this session. CPU/GPU limits and in-game graphics stay untouched — those belong to the game and your phone.",
      "Apply",
    ) { action("mode:$mode") }
  }

  private fun confirmStop() {
    val game = heading?.text?.toString()?.takeIf { it.isNotBlank() } ?: "Your game"
    showSheet(
      "End the session?",
      "Stops the timer, macros, capture and both HUD windows. $game keeps running.",
      "End session",
    ) { action("stop") }
  }

  private fun showSheet(title: String, body: String, primary: String, onPrimary: () -> Unit) {
    val host = sheetHost ?: return
    host.removeAllViews()
    host.visibility = View.VISIBLE
    host.alpha = 1f
    val scrim = View(context).apply {
      setBackgroundColor(Color.parseColor("#B3000000"))
      alpha = 0f
      isClickable = true
      setOnClickListener { hideSheet() }
    }
    host.addView(scrim, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(14), dp(13), dp(14), dp(12))
      background = OverlayStyle.plate(context, 14, "#262626", "#111111")
      isClickable = true
    }
    card.addView(OverlayStyle.text(context, title, 14f, OverlayStyle.INK, "PlusJakartaSans_700Bold"))
    card.addView(
      OverlayStyle.text(context, body, 10f, OverlayStyle.MUTED).apply {
        setPadding(0, dp(6), 0, dp(10))
        setLineSpacing(dp(2).toFloat(), 1f)
      },
    )
    val actions = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    actions.addView(pillButton("Cancel") { hideSheet() }, LinearLayout.LayoutParams(0, dp(38), 1f).apply { marginEnd = dp(6) })
    actions.addView(pillButton(primary, primary = true) { hideSheet(); onPrimary() }, LinearLayout.LayoutParams(0, dp(38), 1.2f))
    card.addView(actions)
    host.addView(
      card,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER).apply {
        marginStart = dp(14)
        marginEnd = dp(14)
      },
    )
    scrim.animate().alpha(1f).setDuration(120).start()
    card.alpha = 0f
    card.translationY = dp(14).toFloat()
    card.animate().alpha(1f).translationY(0f).setDuration(180).setInterpolator(DecelerateInterpolator()).start()
  }

  private fun hideSheet() {
    val host = sheetHost ?: return
    host.animate().alpha(0f).setDuration(110).withEndAction {
      host.removeAllViews()
      host.alpha = 1f
      host.visibility = View.GONE
    }.start()
  }

  // ----------------------------------------------------------------- state

  private fun applyMode(next: Mode, animate: Boolean) {
    val view = root ?: return
    if (next == Mode.HANDLE && store.config().optString("hudVisibility") == "notification") {
      action("collapse")
      return
    }
    val previous = mode
    mode = next
    OverlayBridge.expanded = next != Mode.HANDLE
    if (previous == Mode.HANDLE && next == Mode.DASHBOARD) action("expand")
    handleRow?.visibility = if (next == Mode.HANDLE) View.VISIBLE else View.GONE
    panelFrame?.visibility = if (next == Mode.DASHBOARD) View.VISIBLE else View.GONE
    params?.let {
      it.flags = if (next == Mode.HANDLE) {
        it.flags or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
      } else {
        it.flags and WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS.inv()
      }
    }
    restoreIdle()
    if (next == Mode.DASHBOARD) {
      if (content?.childCount == 0) renderSection()
      animateIn(animate)
    } else {
      val row = handleRow
      if (animate && !motionOff && previous == Mode.DASHBOARD && row != null) {
        row.alpha = 0f
        row.animate().alpha(handleOpacity()).setDuration(160).start()
      } else {
        row?.alpha = handleOpacity()
      }
    }
    view.post {
      if (root !== view || mode != next) return@post
      fit()
      dock(false)
    }
  }

  private fun collapseToHandle() {
    if (mode == Mode.HANDLE) return
    val row = panelRow
    if (motionOff || row == null) {
      applyMode(Mode.HANDLE, false)
      return
    }
    val direction = if (docked()) 1f else -1f
    row.animate().cancel()
    row.animate().alpha(0f).translationX(direction * dp(28)).setDuration(150).withEndAction {
      row.alpha = 1f
      row.translationX = 0f
      applyMode(Mode.HANDLE, true)
    }.start()
  }

  private fun animateIn(animate: Boolean) {
    val row = panelRow ?: return
    row.animate().cancel()
    if (!animate || motionOff) {
      row.alpha = 1f
      row.translationX = 0f
      row.scaleX = 1f
      row.scaleY = 1f
      return
    }
    // Realme assistant opening: the plate slides out of the docked edge
    // (direction points inward), rapid fade on the way — no scale pop.
    val direction = if (docked()) 1f else -1f
    row.pivotX = if (docked()) row.width.toFloat().coerceAtLeast(1f) else 0f
    row.pivotY = dp(20).toFloat()
    row.alpha = 0f
    row.translationX = direction * dp(64)
    row.scaleX = 1f
    row.scaleY = 1f
    row.animate().alpha(1f).translationX(0f).setDuration(240).setInterpolator(DecelerateInterpolator()).start()
  }

  private fun sectionMetaText(): String = when (section) {
    OverlayDashboard.TOOLS -> "Android controls"
    OverlayDashboard.BOOST -> (last["profileShort"] as? String) ?: "Balanced"
    OverlayDashboard.STATS -> if (lastMetrics["cpuPercent"] == null) "waiting" else "live"
    else -> ""
  }

  private fun statusText(): String = status.ifBlank { "Measured values only · Game FPS stays --" }

  private fun stat(value: Any?): String = (value as? Number)?.let { String.format(Locale.US, "%.1f%%", it.toDouble()) } ?: "--"

  private fun host(url: String?): String? = url?.substringAfter("://", url)?.substringBefore('/')

  private fun fpsMode(): String = (fpsSession["mode"] as? String) ?: store.config().optString("fpsHudMode", "minimal")

  private fun fpsCorner(): String = (fpsSession["corner"] as? String) ?: store.config().optString("fpsHudCorner", "topLeft")

  private fun fpsScale(): Double = (fpsSession["scale"] as? Number)?.toDouble() ?: store.config().optDouble("fpsHudScale", 1.0)

  private fun fpsOpacity(): Double = (fpsSession["opacity"] as? Number)?.toDouble() ?: store.config().optDouble("fpsHudOpacity", 0.9)

  private fun fpsMetrics(): List<String> {
    (fpsSession["metrics"] as? List<*>)?.let { return it.filterIsInstance<String>() }
    val array = store.config().optJSONArray("fpsHudMetrics") ?: return OverlayDashboard.metrics().map { it.first }
    return (0 until array.length()).mapNotNull { array.optString(it) }
  }

  private fun readAccent(): Int = try {
    Color.parseColor(store.config().optString("accent", "#ffffff"))
  } catch (_: Exception) {
    OverlayStyle.INK
  }

  // -------------------------------------------------------------- geometry

  private fun railWidth(area: Rect): Int = min(dp(64), (area.width() * 0.16f).toInt().coerceAtLeast(dp(56)))

  private fun railItemHeight(area: Rect): Int =
    ((area.height() - dp(70)) / OverlayDashboard.sections.size).coerceIn(dp(44), dp(54))

  private fun contentWidth(area: Rect): Int {
    val railW = railWidth(area)
    return min(dp(302), area.width() - railW - dp(20)).coerceAtLeast(dp(190))
  }

  private fun fit() {
    if (mode != Mode.DASHBOARD) return
    val body = content ?: return
    val scrollView = scroll ?: return
    val area = bounds()
    val width = (contentWidth(area) - dp(26)).coerceAtLeast(dp(80))
    body.measure(
      View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.UNSPECIFIED,
    )
    val maxHeight = min(dp(520), (area.height() - dp(176)).coerceAtLeast(dp(120)))
    val target = body.measuredHeight.coerceIn(dp(110), maxHeight)
    val layout = scrollView.layoutParams ?: return
    if (layout.height != target) {
      layout.height = target
      scrollView.layoutParams = layout
    }
  }

  private fun dock(animate: Boolean) {
    val position = params ?: return
    val view = root ?: return
    val area = bounds()
    val right = docked()
    val railW = railWidth(area)
    val gap = dp(8)
    val contentW = contentWidth(area)
    contentWidthPx = contentW
    applyDockOrder(right)

    rail?.layoutParams?.let {
      if (it.width != railW) {
        it.width = railW
        rail?.layoutParams = it
      }
    }
    (plate?.layoutParams as? LinearLayout.LayoutParams)?.let {
      var changed = false
      if (it.width != contentW) { it.width = contentW; changed = true }
      if (right && (it.marginEnd != gap || it.marginStart != 0)) { it.marginEnd = gap; it.marginStart = 0; changed = true }
      if (!right && (it.marginStart != gap || it.marginEnd != 0)) { it.marginStart = gap; it.marginEnd = 0; changed = true }
      if (changed) plate?.layoutParams = it
    }

    if (mode == Mode.DASHBOARD) {
      val plateView = plate
      if (plateView != null) {
        plateView.measure(
          View.MeasureSpec.makeMeasureSpec(contentW, View.MeasureSpec.EXACTLY),
          View.MeasureSpec.UNSPECIFIED,
        )
        val plateHeight = plateView.measuredHeight
        if (plateHeight > 0) {
          val perItem = ((plateHeight - dp(46)) / OverlayDashboard.sections.size).coerceIn(dp(34), dp(54))
          if (perItem != railItemHeightPx) {
            railItemHeightPx = perItem
            railIndicatorHeightPx = (perItem - dp(8)).coerceAtLeast(dp(26))
            applyRailMetrics()
          }
          rail?.layoutParams?.let { if (it.height != plateHeight) { it.height = plateHeight; rail?.layoutParams = it } }
          panelRow?.layoutParams?.let { if (it.height != plateHeight) { it.height = plateHeight; panelRow?.layoutParams = it } }
          panelFrame?.layoutParams?.let { if (it.height != plateHeight) { it.height = plateHeight; panelFrame?.layoutParams = it } }
        }
      }
    }

    val width = when (mode) {
      Mode.HANDLE -> peekPx + offPx
      Mode.DASHBOARD -> railW + gap + contentW
    }
    panelFrame?.layoutParams?.let { if (it.width != width) { it.width = width; panelFrame?.layoutParams = it } }
    panelRow?.layoutParams?.let { if (it.width != width) { it.width = width; panelRow?.layoutParams = it } }
    position.width = width
    styleHandleForDock(right)

    val targetX = when (mode) {
      Mode.HANDLE -> HandleGeometry.dockX(area.left, area.right, peekPx, offPx, right)
      else -> if (right) area.right - width else area.left
    }
    view.measure(
      View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.UNSPECIFIED,
    )
    val height = view.measuredHeight
    view.systemGestureExclusionRects = if (mode == Mode.HANDLE) listOf(Rect(0, 0, width, height)) else emptyList()

    position.y = if (mode == Mode.HANDLE) {
      val range = (area.height() - height).coerceAtLeast(0)
      area.top + (range * store.preferences.getFloat(yKey(), 0.45f)).toInt()
    } else {
      // Realme behaviour: the assistant plate opens vertically centered on
      // the screen, not glued to the top edge.
      val slack = (area.height() - height).coerceAtLeast(0)
      (area.top + slack / 2).coerceAtMost(maxOf(area.top, area.bottom - height))
    }

    if (mode == Mode.HANDLE) {
      val edge = Rect(targetX, position.y, targetX + width, position.y + height)
      root?.rootWindowInsets?.displayCutout?.boundingRects?.forEach { cutout ->
        if (Rect.intersects(edge, cutout)) position.y = (cutout.bottom + dp(8)).coerceAtMost(area.bottom - height)
      }
    }

    if (animate) {
      animator?.cancel()
      animator = ValueAnimator.ofInt(position.x, targetX).apply {
        duration = 170
        addUpdateListener {
          position.x = it.animatedValue as Int
          clamp()
          update()
        }
        start()
      }
    } else {
      position.x = targetX
      clamp()
      update()
    }
  }

  /** Keep the three rail cells readable on short screens. */
  private fun applyRailMetrics() {
    val column = railColumn ?: return
    for (index in 1 until column.childCount) {
      val cell = column.getChildAt(index)
      val layout = cell.layoutParams ?: continue
      if (layout.height != railItemHeightPx) {
        layout.height = railItemHeightPx
        cell.layoutParams = layout
      }
    }
    railIndicator?.layoutParams?.let {
      if (it.height != railIndicatorHeightPx) {
        it.height = railIndicatorHeightPx
        railIndicator?.layoutParams = it
      }
    }
    updateRail(false)
  }

  private fun applyDockOrder(right: Boolean) {
    val row = panelRow ?: return
    val railView = rail ?: return
    val plateView = plate ?: return
    if (row.childCount != 2) return
    val railFirst = row.getChildAt(0) === railView
    if (right == railFirst) {
      val railParams = railView.layoutParams
      val plateParams = plateView.layoutParams
      row.removeAllViews()
      if (right) {
        row.addView(plateView, plateParams)
        row.addView(railView, railParams)
      } else {
        row.addView(railView, railParams)
        row.addView(plateView, plateParams)
      }
    }
  }

  private fun styleHandleForDock(right: Boolean) {
    val bg = handleBg ?: return
    val radius = min(peekPx + dp(4), dp(60)).toFloat()
    bg.cornerRadii = HandleGeometry.cornerRadii(radius, right)
    handleChevron?.setIcon(if (right) IconView.BACK else IconView.FORWARD, OverlayStyle.INK)
    handleRow?.gravity = if (right) Gravity.START else Gravity.END
    root?.gravity = if (right) Gravity.END else Gravity.START
    handleRow?.layoutDirection = View.LAYOUT_DIRECTION_LTR
  }

  private fun clamp() {
    val position = params ?: return
    val area = bounds()
    val view = root
    if (mode == Mode.HANDLE) {
      position.x = position.x.coerceIn(area.left - offPx, maxOf(area.left, area.right - peekPx))
      position.y = position.y.coerceIn(area.top, maxOf(area.top, area.bottom - (view?.measuredHeight ?: dp(60))))
      return
    }
    val width = view?.measuredWidth ?: dp(60)
    position.x = position.x.coerceIn(area.left, maxOf(area.left, area.right - width))
    position.y = position.y.coerceIn(area.top, maxOf(area.top, area.bottom - (view?.measuredHeight ?: dp(60))))
  }

  private fun update() {
    root?.let { try { manager.updateViewLayout(it, params) } catch (_: Exception) {} }
  }

  private fun bounds(): Rect {
    val safe = OverlaySupport.safeBounds(context, root)
    if (mode == Mode.HANDLE) {
      val full = OverlaySupport.displayBounds(context)
      safe.left = full.left
      safe.right = full.right
    }
    return safe
  }

  private fun docked() = store.preferences.getBoolean(dockKey(), false)

  private fun dockKey() = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) "dockLandscape" else "dockPortrait"

  private fun yKey() = if (context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) "yLandscape" else "yPortrait"

  private fun dp(value: Int): Int = OverlayStyle.dp(context, value)

  // ---------------------------------------------------------------- handle

  private fun handleOpacity(): Float =
    (sessionOpacity ?: store.config().optDouble("opacity", 0.94)).coerceIn(0.4, 1.0).toFloat()

  private val idleRunnable = Runnable {
    if (mode != Mode.HANDLE || root == null) return@Runnable
    // The user read the dimmed 0.5× handle as "opacity kam hai": the idle
    // state only relaxes the capsule to ~3/4 of its normal visibility —
    // still clearly readable over a dark game scene.
    val target = handleOpacity() * 0.78f
    if (motionOff) handleRow?.alpha = target
    else handleRow?.animate()?.alpha(target)?.setDuration(300)?.start()
  }

  private val collapseRunnable = Runnable {
    root ?: return@Runnable
    if (mode != Mode.HANDLE) action("collapse")
  }

  private fun collapseDelayMs(): Long {
    val seconds = store.config().optInt("autoCollapseSeconds", DEFAULT_COLLAPSE_SECONDS)
    return if (seconds <= 0) 0L else seconds * 1000L
  }

  private fun armIdle() {
    val view = root ?: return
    view.removeCallbacks(idleRunnable)
    view.removeCallbacks(collapseRunnable)
    if (mode == Mode.HANDLE && store.config().optBoolean("autoHide", true)) {
      view.postDelayed(idleRunnable, IDLE_DELAY_MS)
    }
    val delay = collapseDelayMs()
    if (mode != Mode.HANDLE && delay > 0L) view.postDelayed(collapseRunnable, delay)
  }

  private fun restoreIdle() {
    root ?: return
    handleRow?.animate()?.cancel()
    handleRow?.alpha = handleOpacity()
    armIdle()
  }

  private fun haptic(view: View) {
    if (store.config().optBoolean("haptics", true)) {
      view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
    }
  }

  private fun animatePress(view: View) {
    if (motionOff) return
    view.animate().scaleX(0.96f).scaleY(0.96f).setDuration(70).withEndAction {
      view.animate().scaleX(1f).scaleY(1f).setDuration(120).setInterpolator(OvershootInterpolator()).start()
    }.start()
  }

  private fun drag(handle: View) {
    var x = 0
    var y = 0
    var downX = 0f
    var downY = 0f
    var moved = false
    var expandedBySwipe = false
    var held = false
    var dragging = false
    var wasHandle = false
    val hold = Runnable {
      if (!held || moved) return@Runnable
      dragging = true
      haptic(handle)
    }
    handle.setOnTouchListener { view, event ->
      val position = params ?: return@setOnTouchListener false
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          restoreIdle()
          animator?.cancel()
          x = position.x
          y = position.y
          downX = event.rawX
          downY = event.rawY
          moved = false
          expandedBySwipe = false
          held = true
          dragging = false
          wasHandle = mode == Mode.HANDLE
          view.postDelayed(hold, ViewConfiguration.getLongPressTimeout().toLong())
          root?.removeCallbacks(collapseRunnable)
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - downX).toInt()
          val dy = (event.rawY - downY).toInt()
          if (wasHandle && !dragging && !expandedBySwipe &&
            HandleGeometry.inwardSwipe(dx.toFloat(), dy.toFloat(), docked(), context.resources.displayMetrics.density)
          ) {
            view.removeCallbacks(hold)
            expandedBySwipe = true
            haptic(view)
            applyMode(Mode.DASHBOARD, true)
            restoreIdle()
            return@setOnTouchListener true
          }
          moved = moved || abs(dx) > dp(6) || abs(dy) > dp(6)
          if (moved && !dragging) view.removeCallbacks(hold)
          if (dragging && !expandedBySwipe) {
            position.x = x + dx
            position.y = y + dy
            clamp()
            update()
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          held = false
          view.removeCallbacks(hold)
          if (event.actionMasked == MotionEvent.ACTION_CANCEL) {
            if (dragging) dock(false)
          } else if (dragging) {
            val area = bounds()
            val width = root?.width ?: (peekPx + offPx)
            val right = position.x + width > area.right || position.x + width / 2 > area.centerX()
            store.preferences.edit()
              .putBoolean(dockKey(), right)
              .putFloat(
                yKey(),
                ((position.y - area.top).toFloat() / ((area.height() - (root?.height ?: dp(56))).coerceAtLeast(1))).coerceIn(0f, 1f),
              )
              .apply()
            dock(!motionOff)
          } else if (!expandedBySwipe && !moved) {
            view.performClick()
          }
          armIdle()
          true
        }
        else -> false
      }
    }
  }

  companion object {
    fun duration(ms: Long): String = String.format(Locale.US, "%02d:%02d", ms / 60000L, ms / 1000L % 60L)
    private const val IDLE_DELAY_MS = 7000L
    private const val DEFAULT_COLLAPSE_SECONDS = 10
    /** Metric tiles that get a measured-level meter bar (value → fraction). */
    private val METER_TILE_KEYS = setOf("cpu", "ram", "temp", "battery")
  }
}
