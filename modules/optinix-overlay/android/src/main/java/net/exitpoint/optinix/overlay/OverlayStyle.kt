package net.exitpoint.optinix.overlay

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.TextView
import com.facebook.react.common.assets.ReactFontManager

/**
 * OverlayStyle — the single source of the in-game HUD's visual language.
 *
 * Mirrors the desktop product's monochrome system (2026-11-04): graphite
 * plates, hairline strokes, one ink accent and a lightness-only status ramp.
 * Labels always carry the meaning; a value that cannot be measured stays a
 * neutral "--" instead of being invented.
 */
object OverlayStyle {
  val INK = Color.parseColor("#ffffff")
  val SECONDARY = Color.parseColor("#c1c1c1")
  val MUTED = Color.parseColor("#a0a0a0")
  val QUIET = Color.parseColor("#6b6b6b")
  val HAIRLINE = Color.parseColor("#38FFFFFF")
  val HAIRLINE_SOFT = Color.parseColor("#20FFFFFF")

  const val PLATE_TOP = "#191919"
  const val PLATE_BOTTOM = "#0a0a0a"
  const val RAIL_TOP = "#191919"
  const val RAIL_BOTTOM = "#0d0d0d"
  const val TILE = "#161616"
  const val CONTROL = "#262626"
  const val TRACK = "#111111"

  fun dp(context: Context, value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
  fun dpf(context: Context, value: Float): Float = value * context.resources.displayMetrics.density

  fun font(context: Context, family: String): Typeface = try {
    ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, context.assets)
  } catch (_: Exception) {
    Typeface.create("sans-serif-medium", Typeface.NORMAL)
  }

  fun text(
    context: Context,
    value: String,
    sizeSp: Float,
    color: Int,
    family: String = "Inter_500Medium",
  ): TextView = TextView(context).apply {
    text = value
    textSize = sizeSp
    setTextColor(color)
    typeface = font(context, family)
    includeFontPadding = false
  }

  fun solid(context: Context, radiusDp: Int, color: Int, stroke: Int? = HAIRLINE): GradientDrawable =
    GradientDrawable().apply {
      cornerRadius = dpf(context, radiusDp.toFloat())
      setColor(color)
      if (stroke != null) setStroke(dp(context, 1).coerceAtLeast(1), stroke)
    }

  fun fill(context: Context, radiusDp: Int, color: Int): GradientDrawable = GradientDrawable().apply {
    cornerRadius = dpf(context, radiusDp.toFloat())
    setColor(color)
  }

  fun plate(
    context: Context,
    radiusDp: Int,
    top: String = PLATE_TOP,
    bottom: String = PLATE_BOTTOM,
    stroke: Int = HAIRLINE,
  ): GradientDrawable = GradientDrawable().apply {
    cornerRadius = dpf(context, radiusDp.toFloat())
    orientation = GradientDrawable.Orientation.TOP_BOTTOM
    setColors(intArrayOf(Color.parseColor(top), Color.parseColor(bottom)))
    setStroke(dp(context, 1).coerceAtLeast(1), stroke)
  }

  fun tint(color: Int, alpha: Int): Int = Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

  /** Dark-on-accent vs light-on-accent, decided by measured luminance. */
  fun onAccent(accent: Int): Int {
    val luminance = 0.2126 * Color.red(accent) + 0.7152 * Color.green(accent) + 0.0722 * Color.blue(accent)
    return if (luminance > 140) Color.BLACK else INK
  }

  /** Presentational ramp for metrics measured "up" (load, temperature). */
  fun metric(value: Double?, warnAt: Double, hotAt: Double): Int = when {
    value == null || !value.isFinite() -> MUTED
    value >= hotAt -> INK
    value >= warnAt -> SECONDARY
    else -> MUTED
  }

  /** Same ramp for metrics measured "down" (battery percent). */
  fun metricLow(value: Double?, warnAt: Double, hotAt: Double): Int = when {
    value == null || !value.isFinite() -> MUTED
    value <= hotAt -> INK
    value <= warnAt -> SECONDARY
    else -> MUTED
  }
}
