package net.exitpoint.optinix.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.view.View

/**
 * CPU/RAM history: CPU as an accent line with a soft area fill beneath it and
 * an endpoint dot on the newest sample; RAM as a quiet gray line. Null points
 * break the line honestly instead of being bridged.
 */
class OverlaySparkline(context: Context) : View(context) {
  private val cpuPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.6f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }
  private val ramPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.2f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = Color.parseColor("#5b657a")
  }
  private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(0.7f)
    color = Color.parseColor("#1c2431")
  }
  private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }

  /** Fill gradient stops, rebuilt whenever the accent changes. */
  private var fillTop = 0
  private var fillBottom = 0

  private var cpuValues: List<Double?> = emptyList()
  private var ramValues: List<Double?> = emptyList()

  fun setAccent(color: Int) {
    cpuPaint.color = color
    dotPaint.color = color
    fillTop = Color.argb(64, Color.red(color), Color.green(color), Color.blue(color))
    fillBottom = Color.argb(0, Color.red(color), Color.green(color), Color.blue(color))
    invalidate()
  }

  fun setSeries(cpu: List<Double?>, ram: List<Double?>) {
    cpuValues = cpu.takeLast(MAX_POINTS)
    ramValues = ram.takeLast(MAX_POINTS)
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val left = paddingLeft.toFloat()
    val top = paddingTop.toFloat()
    val width = (this.width - paddingLeft - paddingRight).toFloat()
    val height = (this.height - paddingTop - paddingBottom).toFloat()
    if (width <= 0f || height <= 0f) return

    val mid = top + height / 2f
    canvas.drawLine(left, top + height, left + width, top + height, gridPaint)
    canvas.drawLine(left, mid, left + width, mid, gridPaint)

    // The fade is sized against the current view height, so it is rebuilt on
    // layout changes only via this draw pass — costless at 700 ms ticks.
    fillPaint.shader = LinearGradient(left, top, left, top + height, fillTop, fillBottom, Shader.TileMode.CLAMP)
    drawArea(canvas, cpuValues, left, top, width, height)
    drawSeries(canvas, cpuValues, cpuPaint, left, top, width, height)
    drawSeries(canvas, ramValues, ramPaint, left, top, width, height)
    drawEndpoint(canvas, cpuValues, dotPaint, left, top, width, height)
  }

  /** Translucent accent area under a series, cut off at null gaps. */
  private fun drawArea(
    canvas: Canvas,
    values: List<Double?>,
    left: Float,
    top: Float,
    width: Float,
    height: Float
  ) {
    if (values.size < 2) return
    val step = width / (MAX_POINTS - 1).toFloat()
    val offset = (MAX_POINTS - values.size).toFloat() * step
    val path = Path()
    var open = false
    var previousX = 0f
    values.forEachIndexed { index, value ->
      if (value == null || !value.isFinite()) {
        if (open) { closeArea(canvas, path, previousX, top, height) }
        open = false
        return@forEachIndexed
      }
      val x = left + offset + index * step
      val y = top + height - (value.coerceIn(0.0, 100.0) / 100.0 * height).toFloat()
      if (!open) { path.moveTo(x, top + height); path.lineTo(x, y); open = true }
      else path.lineTo(x, y)
      previousX = x
    }
    if (open) closeArea(canvas, path, previousX, top, height)
  }

  private fun closeArea(canvas: Canvas, path: Path, lastX: Float, top: Float, height: Float) {
    path.lineTo(lastX, top + height)
    path.close()
    canvas.drawPath(path, fillPaint)
  }

  private fun drawSeries(
    canvas: Canvas,
    values: List<Double?>,
    paint: Paint,
    left: Float,
    top: Float,
    width: Float,
    height: Float
  ) {
    if (values.size < 2) return
    val step = width / (MAX_POINTS - 1).toFloat()
    val offset = (MAX_POINTS - values.size).toFloat() * step
    var previousX = 0f
    var previousY = 0f
    var connected = false
    values.forEachIndexed { index, value ->
      if (value == null || !value.isFinite()) { connected = false; return@forEachIndexed }
      val x = left + offset + index * step
      val y = top + height - (value.coerceIn(0.0, 100.0) / 100.0 * height).toFloat()
      if (connected) canvas.drawLine(previousX, previousY, x, y, paint)
      previousX = x
      previousY = y
      connected = true
    }
  }

  /** Accent dot on the newest measured CPU sample (none until 2+ points). */
  private fun drawEndpoint(
    canvas: Canvas,
    values: List<Double?>,
    paint: Paint,
    left: Float,
    top: Float,
    width: Float,
    height: Float
  ) {
    if (values.size < 2) return
    val index = values.indexOfLast { it != null && it.isFinite() }
    val value = values.getOrNull(index) ?: return
    val step = width / (MAX_POINTS - 1).toFloat()
    val offset = (MAX_POINTS - values.size).toFloat() * step
    val x = left + offset + index * step
    val y = top + height - (value.coerceIn(0.0, 100.0) / 100.0 * height).toFloat()
    canvas.drawCircle(x, y, dp(1.8f), paint)
  }

  private fun dp(value: Float): Float =
    value * resources.displayMetrics.density

  companion object {
    private const val MAX_POINTS = 44
  }
}
