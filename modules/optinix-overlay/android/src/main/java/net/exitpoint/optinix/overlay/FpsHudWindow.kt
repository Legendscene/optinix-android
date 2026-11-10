package net.exitpoint.optinix.overlay

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.common.assets.ReactFontManager
import java.util.Locale
import java.util.WeakHashMap
import kotlin.math.roundToInt

/**
 * FpsHudWindow — the second overlay window (the customizable FPS HUD).
 *
 * Honesty contract: ordinary Android apps cannot read another app's frame
 * statistics, so GAME FPS always renders as the neutral "--" (with an
 * explanatory note in the detailed mode). Display refresh rate, CPU, RAM,
 * temperature and battery are measured by the service loop and are real.
 * The window is created with FLAG_NOT_TOUCHABLE, so it can never steal a
 * touch from the game; placement (corner), size scale, opacity, mode and
 * visible metrics all come from GamingStore config (fpsHud* keys).
 */
class FpsHudWindow(private val context: Context, private val store: GamingStore) {
  private val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null
  private var params: WindowManager.LayoutParams? = null
  private val values = HashMap<String, TextView>()
  private var noteView: TextView? = null
  private var builtKey: String? = null
  private var lastMetrics: Map<String, Any?> = emptyMap()
  private var overrides: Map<String, Any?> = emptyMap()

  /**
   * Session-scoped appearance changes made from the in-game panel. They never
   * overwrite the saved defaults in GamingStore: a new session clears them and
   * the user's Settings values apply again.
   */
  fun setSession(values: Map<String, Any?>) {
    synchronized(LOCK) { setSessionLocked(values) }
  }
  private fun setSessionLocked(values: Map<String, Any?>) {
    overrides = overrides + values
    applyConfigLocked()
  }

  fun clearSession() {
    synchronized(LOCK) { clearSessionLocked() }
  }
  private fun clearSessionLocked() {
    if (overrides.isEmpty()) return
    overrides = emptyMap()
    applyConfigLocked()
  }

  /** Re-read the fpsHud* config; unattached windows rebuild on next show(),
   *  attached ones are rebuilt immediately (cheap hand-rolled layouts). */
  fun applyConfig() {
    synchronized(LOCK) { applyConfigLocked() }
  }
  private fun applyConfigLocked() {
    val attached = root?.windowToken != null
    builtKey = null
    if (attached) {
      if (OverlaySupport.canDraw(context)) showLocked() else hideLocked()
    }
  }

  fun resetCorner() {
    synchronized(LOCK) {
      store.configure(mapOf("fpsHudCorner" to "topLeft"))
      applyConfigLocked()
    }
  }

  fun show(): Boolean {
    synchronized(LOCK) { return showLocked() }
  }
  private fun showLocked(): Boolean {
    detachOrphans(this)
    if (!OverlaySupport.canDraw(context)) { hideLocked(); return false }
    if (builtKey != signature()) { hideLocked(); buildLocked() }
    val view = root ?: return false
    val layout = params ?: return false
    layout.alpha = OverlaySupport.touchThroughOpacity(context, opacity())
    position(view, layout)
    if (view.windowToken == null) {
      try {
        manager.addView(view, layout)
        attachedWindows[this] = view
      } catch (error: Exception) { OverlayBridge.error = "Stats HUD unavailable: ${error.message ?: "Android refused the window"}"; hideLocked(); return false }
    } else {
      try { manager.updateViewLayout(view, layout); attachedWindows[this] = view } catch (_: Exception) {}
    }
    renderLocked(lastMetrics)
    return true
  }

  fun hide() {
    synchronized(LOCK) { hideLocked() }
  }
  private fun hideLocked() {
    val view = root ?: return
    if (view.windowToken != null) {
      try { manager.removeView(view) } catch (_: Exception) {}
    }
    attachedWindows.remove(this)
    root = null
    params = null
    values.clear()
    noteView = null
    builtKey = null
  }

  fun render(metrics: Map<String, Any?>) {
    synchronized(LOCK) { renderLocked(metrics) }
  }
  private fun renderLocked(metrics: Map<String, Any?>) {
    lastMetrics = metrics
    val view = root ?: return
    if (view.windowToken == null) return
    fun reading(key: String) = (metrics[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
    fun percent(key: String) = reading(key)?.let { "${it.roundToInt()}%" } ?: "--"
    values["fps"]?.text = "--"
    values["frame"]?.text = "--"
    values["cpu"]?.text = percent("cpuPercent")
    values["ram"]?.text = percent("ramPercent")
    values["temp"]?.text = reading("temperatureC")?.let { String.format(Locale.US, "%.1f°C", it) } ?: "--"
    values["battery"]?.text = percent("batteryPercent") + if (metrics["charging"] == true) " ⚡" else ""
    values["refresh"]?.text = (reading("refreshRate")?.let { "${it.roundToInt()} Hz" } ?: "-- Hz") + if (mode() == "minimal") " display" else ""
    // Colour carries the only judgement; numbers stay raw, unmeasured stays
    // neutral "--" — the same lightness-only ramp as the main HUD.
    values["cpu"]?.setTextColor(metricColor((metrics["cpuPercent"] as? Number)?.toDouble(), 80.0, 95.0))
    values["ram"]?.setTextColor(metricColor((metrics["ramPercent"] as? Number)?.toDouble(), 80.0, 95.0))
    values["temp"]?.setTextColor(metricColor((metrics["temperatureC"] as? Number)?.toDouble(), 45.0, 53.0))
    val battery = (metrics["batteryPercent"] as? Number)?.toDouble()
    values["battery"]?.setTextColor(when {
      battery == null -> MUTED
      battery <= 12.0 -> Color.WHITE
      battery <= 25.0 -> Color.parseColor("#c1c1c1")
      else -> MUTED
    })
    noteView?.visibility = if (mode() == "detailed") View.VISIBLE else View.GONE
  }

  private fun buildLocked() {
    values.clear()
    noteView = null
    val area = OverlaySupport.safeBounds(context, root)
    val expectedHeight = if (mode() == "detailed") 310 else 125
    val scale = minOf(scale().toFloat(), (area.height() - dp(16)).toFloat() / dp(expectedHeight), (area.width() - dp(24)).toFloat() / dp(190)).coerceAtLeast(0.5f)
    val plate = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp((10 * scale).toInt()), dp((7 * scale).toInt()), dp((10 * scale).toInt()), dp((8 * scale).toInt()))
      background = plateBackground()
      elevation = dp(4).toFloat()
    }
    when (mode()) {
      "compact" -> {
        headerRow(plate, scale)
        addRow(plate, "fps", "Game FPS", 11f * scale, 12f * scale)
        addRow(plate, "cpu", "CPU", 11f * scale, 12f * scale)
        addRow(plate, "ram", "RAM", 11f * scale, 12f * scale)
      }
      "detailed" -> {
        headerRow(plate, scale)
        addRow(plate, "fps", "Game FPS", 11f * scale, 12f * scale)
        addRow(plate, "frame", "Frame time", 11f * scale, 12f * scale)
        selectedMetrics().forEach { key ->
          val label = when (key) {
            "cpu" -> "CPU"
            "ram" -> "RAM"
            "temp" -> "Temp"
            "battery" -> "Battery"
            "refresh" -> "Display"
            else -> null
          } ?: return@forEach
          addRow(plate, key, label, 11f * scale, 12f * scale)
        }
        noteView = text(
          "Game FPS / frame time: unavailable to other apps. Hz ≠ FPS. Missing sensor access: --.",
          10f * scale, MUTED
        ).apply {
          typeface = font("Inter_500Medium")
          setPadding(0, dp((7 * scale).toInt()), 0, 0)
        }
        plate.addView(noteView)
      }
      else -> {
        // Minimal: one honest number, one real one. "--" stays neutral.
        val label = text("GAME FPS", 9f * scale, MUTED).apply {
          typeface = font("Inter_600SemiBold")
          letterSpacing = 0.08f
        }
        val value = text("--", 22f * scale, INK).apply {
          typeface = font("JetBrainsMono_700Bold")
          setPadding(0, dp((3 * scale).toInt()), 0, dp((4 * scale).toInt()))
        }
        values["fps"] = value
        val hz = text("-- Hz display", 10f * scale, MUTED).apply { typeface = font("JetBrainsMono_500Medium") }
        values["refresh"] = hz
        plate.addView(label)
        plate.addView(value)
        plate.addView(hz)
      }
    }
    root = plate
    params = WindowManager.LayoutParams(
      dp(((if (mode() == "minimal") 118 else 190) * scale).toInt()),
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.LEFT
      title = "Optinix stats HUD"
      if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
    }
    builtKey = signature()
  }

  private fun headerRow(plate: LinearLayout, scale: Float) {
    val header = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    header.addView(
      text("●", 7f * scale, accent()),
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp((6 * scale).toInt()) }
    )
    header.addView(text("OPTINIX", 9f * scale, MUTED).apply { typeface = font("Inter_600SemiBold"); letterSpacing = 0.1f })
    plate.addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp((6 * scale).toInt()) })
  }

  private fun addRow(plate: LinearLayout, key: String, label: String, labelSize: Float, valueSize: Float) {
    val line = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    line.addView(text(label, labelSize, MUTED).apply { typeface = font("Inter_600SemiBold") },
      LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val value = text("--", valueSize, INK).apply {
      typeface = font("JetBrainsMono_700Bold")
      gravity = Gravity.END
    }
    values[key] = value
    line.addView(value, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    plate.addView(line, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4) })
  }

  private fun selectedMetrics(): List<String> {
    val allowed = setOf("cpu", "ram", "temp", "battery", "refresh")
    (overrides["fpsHudMetrics"] as? List<*>)?.let { raw ->
      return raw.filterIsInstance<String>().filter { it in allowed }.distinct().take(5)
    }
    val configured = store.config().optJSONArray("fpsHudMetrics")
      ?: return listOf("cpu", "ram", "temp", "battery", "refresh")
    return (0 until configured.length()).mapNotNull { configured.optString(it) }.filter { it in allowed }
  }

  private fun metricColor(value: Double?, warn: Double, hot: Double): Int = when {
    value == null -> MUTED
    value >= hot -> Color.WHITE
    value >= warn -> Color.parseColor("#c1c1c1")
    else -> MUTED
  }

  private fun text(value: String, size: Float, color: Int) = TextView(context).apply {
    text = value
    textSize = size
    setTextColor(color)
    includeFontPadding = false
  }

  private fun font(family: String): Typeface = try { ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, context.assets) } catch (_: Exception) { Typeface.create("sans-serif-medium", Typeface.NORMAL) }

  private fun plateBackground() = GradientDrawable().apply {
    cornerRadius = dp(12).toFloat()
    orientation = GradientDrawable.Orientation.TOP_BOTTOM
    setColors(intArrayOf(Color.parseColor("#191919"), Color.parseColor("#0a0a0a")))
    setStroke(dp(1), HAIRLINE)
  }

  private fun accent() = try { Color.parseColor(store.config().optString("accent", "#ffffff")) } catch (_: Exception) { Color.parseColor("#ffffff") }

  private fun mode() = (overrides["fpsHudMode"] as? String) ?: store.config().optString("fpsHudMode", "minimal")
  private fun corner() = (overrides["fpsHudCorner"] as? String) ?: store.config().optString("fpsHudCorner", "topLeft")
  private fun opacity() = ((overrides["fpsHudOpacity"] as? Number)?.toDouble() ?: store.config().optDouble("fpsHudOpacity", 0.9)).coerceIn(0.4, 1.0)
  private fun scale() = ((overrides["fpsHudScale"] as? Number)?.toDouble() ?: store.config().optDouble("fpsHudScale", 1.0)).coerceIn(0.7, 1.6)

  private fun position(view: View, layout: WindowManager.LayoutParams) {
    val area = OverlaySupport.safeBounds(context, view)
    view.measure(View.MeasureSpec.makeMeasureSpec(layout.width.coerceAtMost(area.width() - dp(16)), View.MeasureSpec.EXACTLY), View.MeasureSpec.UNSPECIFIED)
    layout.x = if (corner().endsWith("Right")) area.right - view.measuredWidth - dp(8) else area.left + dp(8)
    layout.y = if (corner().startsWith("bottom")) area.bottom - view.measuredHeight - dp(8) else area.top + dp(8)
    layout.x = layout.x.coerceIn(area.left, maxOf(area.left, area.right - view.measuredWidth))
    layout.y = layout.y.coerceIn(area.top, maxOf(area.top, area.bottom - view.measuredHeight))
  }

  /** Which configuration the current layout was built for (opacity is a view
   *  alpha applied at show() time — no rebuild needed for it). */
  private fun signature() = "${mode()}|${scale()}|${corner()}|${selectedMetrics().joinToString(",")}"

  private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()

  companion object {
    /** One registry for the whole process: a duplicate stats-HUD window can
     *  only exist if two FpsHudWindow instances attach simultaneously (module
     *  threads + the sampling loop raced the unguarded `fpsWindow ?: create`
     *  sites — three windows reproduced on device, 2026-11-08). Every public
     *  entry point holds this one class-level lock, and show() detaches any
     *  stale instance's attached view before attaching its own. */
    private val LOCK = Any()
    private val attachedWindows = WeakHashMap<FpsHudWindow, LinearLayout>()

    /** Cached weakly so a fully detached instance can be garbage-collected
     *  instead of pinning its views forever. */
    private fun detachOrphans(self: FpsHudWindow) {
      for ((instance, view) in attachedWindows.entries.filter { it.key !== self }.toList()) {
        if (view.windowToken != null) {
          try { self.manager.removeView(view) } catch (_: Exception) {}
          Log.w("OptinixHUD", "stats HUD: detached an orphaned window from a stale instance")
        }
        attachedWindows.remove(instance)
        instance.root = null
        instance.params = null
        instance.values.clear()
        instance.noteView = null
        instance.builtKey = null
      }
    }

    // Same monochrome palette constants as OverlayWindow.
    private val MUTED = Color.parseColor("#a0a0a0")
    private val INK = Color.parseColor("#ffffff")
    private val HAIRLINE = Color.parseColor("#2EFFFFFF")
  }
}
