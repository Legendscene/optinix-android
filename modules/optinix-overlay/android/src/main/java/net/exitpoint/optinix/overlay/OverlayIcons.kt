package net.exitpoint.optinix.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.View

/**
 * IconView — a tiny stroke-icon renderer for the game HUD.
 *
 * The HUD is a plain Android View hierarchy inside a window overlay, so a
 * bundled icon font or vector library would be an extra dependency for a
 * dozen glyphs. Every icon is drawn on a 24 x 24 grid with the same stroke
 * weight, cap and tint, which keeps the rail, tiles and rows visually
 * consistent without shipping assets.
 */
class IconView(context: Context) : View(context) {
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val solid = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val box = RectF()
  private val path = Path()

  var name: String = MARK
    set(value) { if (field != value) { field = value; invalidate() } }
  var tint: Int = Color.WHITE
    set(value) { if (field != value) { field = value; invalidate() } }
  var weightDp: Float = 1.6f
    set(value) { if (field != value) { field = value; invalidate() } }

  fun setIcon(icon: String, color: Int) {
    name = icon
    tint = color
    invalidate()
  }

  fun applyTint(color: Int) {
    if (tint != color) { tint = color; invalidate() }
  }

  override fun onDraw(canvas: Canvas) {
    val size = minOf(width, height).toFloat()
    if (size <= 0f) return
    stroke.color = tint
    solid.color = tint
    val scale = size / 24f
    stroke.strokeWidth = OverlayStyle.dpf(context, weightDp) / scale
    canvas.save()
    canvas.translate((width - size) / 2f, (height - size) / 2f)
    canvas.scale(scale, scale)
    drawIcon(canvas)
    canvas.restore()
  }

  private fun drawIcon(canvas: Canvas) {
    when (name) {
      MARK -> {
        circle(canvas, 12f, 12f, 7.4f)
        dot(canvas, 12f, 12f, 2.3f)
      }
      PERFORMANCE -> {
        box.set(3f, 5f, 21f, 21f)
        canvas.drawArc(box, 180f, 180f, false, stroke)
        line(canvas, 12f, 15.5f, 16.4f, 9.4f)
        dot(canvas, 12f, 15.5f, 1.5f)
      }
      MONITOR -> {
        path.reset()
        path.moveTo(2.5f, 13f); path.lineTo(6.4f, 13f); path.lineTo(8.6f, 7.5f)
        path.lineTo(11.6f, 18.2f); path.lineTo(14.6f, 10.6f); path.lineTo(16.8f, 13f); path.lineTo(21.5f, 13f)
        canvas.drawPath(path, stroke)
      }
      TOOLS -> {
        roundRect(canvas, 3.5f, 3.5f, 10.5f, 10.5f, 1.8f)
        roundRect(canvas, 13.5f, 3.5f, 20.5f, 10.5f, 1.8f)
        roundRect(canvas, 3.5f, 13.5f, 10.5f, 20.5f, 1.8f)
        roundRect(canvas, 13.5f, 13.5f, 20.5f, 20.5f, 1.8f)
      }
      NETWORK -> {
        box.set(1.2f, 8.2f, 22.8f, 29.8f)
        canvas.drawArc(box, 225f, 90f, false, stroke)
        box.set(4.6f, 11.6f, 19.4f, 26.4f)
        canvas.drawArc(box, 225f, 90f, false, stroke)
        box.set(8f, 15f, 16f, 23f)
        canvas.drawArc(box, 225f, 90f, false, stroke)
        dot(canvas, 12f, 19.6f, 1.3f)
      }
      OPTIMIZE -> {
        path.reset()
        path.moveTo(13.4f, 2.6f); path.lineTo(5.2f, 13.6f); path.lineTo(11f, 13.6f)
        path.lineTo(9.6f, 21.4f); path.lineTo(18.6f, 10.2f); path.lineTo(12.6f, 10.2f); path.close()
        canvas.drawPath(path, stroke)
      }
      STATS -> {
        roundRect(canvas, 3.6f, 13.4f, 7.2f, 20.4f, 1.2f, true)
        roundRect(canvas, 10.2f, 8.6f, 13.8f, 20.4f, 1.2f, true)
        roundRect(canvas, 16.8f, 3.6f, 20.4f, 20.4f, 1.2f, true)
      }
      CLOSE -> {
        line(canvas, 6.4f, 6.4f, 17.6f, 17.6f)
        line(canvas, 17.6f, 6.4f, 6.4f, 17.6f)
      }
      BACK -> {
        path.reset()
        path.moveTo(14.4f, 5.4f); path.lineTo(7.8f, 12f); path.lineTo(14.4f, 18.6f)
        canvas.drawPath(path, stroke)
      }
      FORWARD -> {
        path.reset()
        path.moveTo(9.6f, 5.4f); path.lineTo(16.2f, 12f); path.lineTo(9.6f, 18.6f)
        canvas.drawPath(path, stroke)
      }
      SUN -> {
        circle(canvas, 12f, 12f, 4.2f)
        for (i in 0 until 8) {
          val angle = Math.toRadians((i * 45).toDouble())
          val cos = Math.cos(angle).toFloat()
          val sin = Math.sin(angle).toFloat()
          line(canvas, 12f + cos * 7.2f, 12f + sin * 7.2f, 12f + cos * 9.8f, 12f + sin * 9.8f)
        }
      }
      DND -> {
        path.reset()
        path.moveTo(6.2f, 16.4f); path.lineTo(6.2f, 11.2f)
        path.cubicTo(6.2f, 7.8f, 8.8f, 5.4f, 12f, 5.4f)
        path.cubicTo(15.2f, 5.4f, 17.8f, 7.8f, 17.8f, 11.2f)
        path.lineTo(17.8f, 16.4f); path.close()
        canvas.drawPath(path, stroke)
        line(canvas, 10.2f, 19.4f, 13.8f, 19.4f)
        line(canvas, 4f, 4f, 20f, 20f)
      }
      CAMERA -> {
        roundRect(canvas, 3f, 6.6f, 21f, 19.4f, 2.4f)
        circle(canvas, 12f, 13f, 3.5f)
        line(canvas, 8.4f, 6.6f, 9.8f, 4.4f)
        line(canvas, 9.8f, 4.4f, 14.2f, 4.4f)
        line(canvas, 14.2f, 4.4f, 15.6f, 6.6f)
      }
      RECORD -> {
        circle(canvas, 12f, 12f, 6.4f)
        dot(canvas, 12f, 12f, 4.2f)
      }
      ROTATE -> {
        box.set(4.4f, 4.4f, 19.6f, 19.6f)
        canvas.drawArc(box, 40f, 250f, false, stroke)
        line(canvas, 15.6f, 3.2f, 19.8f, 6.6f)
        line(canvas, 15.6f, 3.2f, 15.2f, 8.2f)
      }
      TIMER -> {
        circle(canvas, 12f, 12.4f, 7.8f)
        line(canvas, 12f, 12.4f, 12f, 7.8f)
        line(canvas, 12f, 12.4f, 15.4f, 14.2f)
      }
      MEMORY -> {
        roundRect(canvas, 6f, 6f, 18f, 18f, 2f)
        roundRect(canvas, 9.4f, 9.4f, 14.6f, 14.6f, 1f, true)
        for (i in 0 until 4) {
          val at = 7.6f + i * 3f
          line(canvas, at, 3f, at, 6f)
          line(canvas, at, 18f, at, 21f)
          line(canvas, 3f, at, 6f, at)
          line(canvas, 18f, at, 21f, at)
        }
      }
      CHECK -> {
        path.reset()
        path.moveTo(4.8f, 12.6f); path.lineTo(9.8f, 17.6f); path.lineTo(19.2f, 6.4f)
        canvas.drawPath(path, stroke)
      }
      SETTINGS -> {
        circle(canvas, 12f, 12f, 3.2f)
        circle(canvas, 12f, 12f, 8.2f)
        for (i in 0 until 6) {
          val angle = Math.toRadians((i * 60).toDouble())
          val cos = Math.cos(angle).toFloat()
          val sin = Math.sin(angle).toFloat()
          line(canvas, 12f + cos * 8.2f, 12f + sin * 8.2f, 12f + cos * 10.6f, 12f + sin * 10.6f)
        }
      }
      BELL -> {
        path.reset()
        path.moveTo(6.4f, 16.4f); path.lineTo(6.4f, 11.2f)
        path.cubicTo(6.4f, 7.8f, 8.9f, 5.4f, 12f, 5.4f)
        path.cubicTo(15.1f, 5.4f, 17.6f, 7.8f, 17.6f, 11.2f)
        path.lineTo(17.6f, 16.4f); path.close()
        canvas.drawPath(path, stroke)
        line(canvas, 10.4f, 19.4f, 13.6f, 19.4f)
      }
      APPS -> {
        roundRect(canvas, 3.6f, 3.6f, 10f, 10f, 2.4f, true)
        roundRect(canvas, 14f, 3.6f, 20.4f, 10f, 2.4f, true)
        roundRect(canvas, 3.6f, 14f, 10f, 20.4f, 2.4f, true)
        roundRect(canvas, 14f, 14f, 20.4f, 20.4f, 2.4f, true)
      }
    }
  }

  private fun line(canvas: Canvas, x1: Float, y1: Float, x2: Float, y2: Float) = canvas.drawLine(x1, y1, x2, y2, stroke)

  private fun circle(canvas: Canvas, cx: Float, cy: Float, r: Float) = canvas.drawCircle(cx, cy, r, stroke)

  private fun dot(canvas: Canvas, cx: Float, cy: Float, r: Float) = canvas.drawCircle(cx, cy, r, solid)

  private fun roundRect(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, radius: Float, filled: Boolean = false) {
    box.set(left, top, right, bottom)
    canvas.drawRoundRect(box, radius, radius, if (filled) solid else stroke)
  }

  companion object {
    const val MARK = "mark"
    const val PERFORMANCE = "performance"
    const val MONITOR = "monitor"
    const val TOOLS = "tools"
    const val NETWORK = "network"
    const val OPTIMIZE = "optimize"
    const val STATS = "stats"
    const val CLOSE = "close"
    const val BACK = "back"
    const val FORWARD = "forward"
    const val SUN = "sun"
    const val DND = "dnd"
    const val CAMERA = "camera"
    const val RECORD = "record"
    const val ROTATE = "rotate"
    const val TIMER = "timer"
    const val MEMORY = "memory"
    const val CHECK = "check"
    const val SETTINGS = "settings"
    const val BELL = "bell"
    const val APPS = "apps"
  }
}
