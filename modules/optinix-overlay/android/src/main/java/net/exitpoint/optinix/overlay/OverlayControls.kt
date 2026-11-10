package net.exitpoint.optinix.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.text.TextPaint
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.roundToInt

/**
 * OverlaySwitch — a small animated toggle.
 *
 * State is driven by the caller (`setChecked`), because several HUD toggles
 * control real system state (DND, rotation) that can fail: the panel always
 * redraws from the measured state instead of trusting the tap.
 */
class OverlaySwitch(context: Context) : View(context) {
  var accent: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  var checked: Boolean = false
    private set
  var onToggle: ((Boolean) -> Unit)? = null
  private var fraction = 0f
  private var animator: ValueAnimator? = null

  init {
    isClickable = true
    isFocusable = true
    setOnClickListener {
      if (isEnabled) {
        performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
        setChecked(!checked, true)
        onToggle?.invoke(checked)
      }
    }
  }

  fun setChecked(value: Boolean, animate: Boolean = true) {
    val target = if (value) 1f else 0f
    checked = value
    animator?.cancel()
    if (!animate) {
      fraction = target
      invalidate()
      return
    }
    animator = ValueAnimator.ofFloat(fraction, target).apply {
      duration = 160
      interpolator = DecelerateInterpolator()
      addUpdateListener { fraction = it.animatedValue as Float; invalidate() }
      start()
    }
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    val h = height.toFloat()
    val w = width.toFloat()
    if (h <= 0f || w <= 0f) return
    val inset = OverlayStyle.dpf(context, 1.2f)
    val trackHeight = h - inset * 2
    val radius = trackHeight / 2f
    val track = Paint(Paint.ANTI_ALIAS_FLAG)
    track.color = blend(Color.parseColor("#2e2e2e"), OverlayStyle.tint(accent, 255), fraction * 0.55f)
    canvas.drawRoundRect(RectF(inset, inset, w - inset, h - inset), radius, radius, track)

    val thumbRadius = radius - OverlayStyle.dpf(context, 2.4f)
    val travel = (w - inset * 2) - thumbRadius * 2 - OverlayStyle.dpf(context, 2.4f)
    val cx = inset + OverlayStyle.dpf(context, 2.4f) + thumbRadius + travel * fraction
    val thumb = Paint(Paint.ANTI_ALIAS_FLAG)
    thumb.color = blend(Color.parseColor("#8a8a8a"), accent, fraction)
    canvas.drawCircle(cx, h / 2f, thumbRadius, thumb)
  }

  private fun blend(from: Int, to: Int, amount: Float): Int {
    val t = amount.coerceIn(0f, 1f)
    return Color.argb(
      255,
      (Color.red(from) + (Color.red(to) - Color.red(from)) * t).roundToInt(),
      (Color.green(from) + (Color.green(to) - Color.green(from)) * t).roundToInt(),
      (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * t).roundToInt(),
    )
  }
}

/**
 * OverlaySlider — a slim horizontal slider used for real screen brightness.
 * The fill and thumb are drawn by hand so the control matches the plate
 * styling without a platform theme leaking in.
 */
class OverlaySlider(context: Context) : View(context) {
  var accent: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  var value: Float = 0.5f
    private set
  var onPreview: ((Float) -> Unit)? = null
  var onCommit: ((Float) -> Unit)? = null
  /** True while the user is dragging; render() must not fight the thumb. */
  var dragging: Boolean = false
    private set

  init {
    isClickable = true
    isFocusable = true
  }

  fun setValue(next: Float) {
    value = next.coerceIn(0f, 1f)
    invalidate()
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!isEnabled) return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
        dragging = true
        parent?.requestDisallowInterceptTouchEvent(true)
        value = (event.x / width.coerceAtLeast(1)).coerceIn(0f, 1f)
        onPreview?.invoke(value)
        invalidate()
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        dragging = false
        parent?.requestDisallowInterceptTouchEvent(false)
        if (event.actionMasked == MotionEvent.ACTION_UP) onCommit?.invoke(value)
        return true
      }
    }
    return false
  }

  override fun onDraw(canvas: Canvas) {
    val w = width.toFloat()
    val h = height.toFloat()
    if (w <= 0f || h <= 0f) return
    val thumbRadius = OverlayStyle.dpf(context, 7f)
    val cy = h / 2f
    val start = thumbRadius
    val end = w - thumbRadius
    val trackHeight = OverlayStyle.dpf(context, 5f)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#2e2e2e")
    canvas.drawRoundRect(RectF(start, cy - trackHeight / 2, end, cy + trackHeight / 2), trackHeight / 2, trackHeight / 2, paint)
    paint.color = accent
    val filled = start + (end - start) * value
    canvas.drawRoundRect(RectF(start, cy - trackHeight / 2, filled.coerceAtLeast(start + 1f), cy + trackHeight / 2), trackHeight / 2, trackHeight / 2, paint)
    canvas.drawCircle(filled, cy, thumbRadius, paint)
  }
}

/**
 * OverlayBoostRing — the animated memory ring in the Performance section.
 * The arc is the complement of the measured RAM-in-use reading (null →
 * no arc; the centre label renders the honest "--" outside this view),
 * a soft accent halo breathes on a slow loop, and sweep() plays a
 * one-shot boost flash. All motion collapses to a static ring when
 * reducedMotion is on — the numbers on the label never animate.
 */
class OverlayBoostRing(context: Context) : View(context) {
  var accent: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  var animated: Boolean = true
    set(value) {
      field = value
      if (!value) {
        pulse?.cancel()
        pulse = null
        breathing = (2 * Math.PI).toFloat()
        sweepAngle = -1f
      } else if (pulse == null) {
        startPulse()
      }
      invalidate()
    }
  private var fraction = -1f
  private var breathing = 0f
  private var sweepAngle = -1f
  private var pulse: ValueAnimator? = null
  private var sweepAnimator: ValueAnimator? = null

  fun setFraction(value: Float) {
    fraction = value.coerceIn(0f, 1f)
    invalidate()
  }

  private fun startPulse() {
    pulse = ValueAnimator.ofFloat(0f, (2 * Math.PI).toFloat()).apply {
      duration = 2400
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener { breathing = it.animatedValue as Float; invalidate() }
      start()
    }
  }

  /** One-shot boost flash: a short accent arc spins around the ring. */
  fun sweep() {
    if (!animated) return
    sweepAnimator?.cancel()
    sweepAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 700
      interpolator = DecelerateInterpolator()
      addUpdateListener {
        sweepAngle = 430f * (it.animatedValue as Float)
        if (it.animatedFraction >= 1f) sweepAngle = -1f
        invalidate()
      }
      start()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (animated && pulse == null) startPulse()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    pulse?.cancel(); pulse = null
    sweepAnimator?.cancel(); sweepAnimator = null
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val radius = (minOf(cx, cy) - OverlayStyle.dpf(context, 4f)).coerceAtLeast(1f)
    val breath = if (animated) 0.5f + 0.5f * kotlin.math.sin(breathing) else 0.35f

    val halo = Paint(Paint.ANTI_ALIAS_FLAG)
    halo.color = OverlayStyle.tint(accent, (16 + 30 * breath).roundToInt())
    canvas.drawCircle(cx, cy, radius + OverlayStyle.dpf(context, 4f), halo)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = OverlayStyle.dpf(context, 3f)
    paint.strokeCap = Paint.Cap.ROUND
    paint.color = Color.parseColor("#2e2e2e")
    val rect = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
    canvas.drawArc(rect, 0f, 360f, false, paint)

    if (fraction >= 0f) {
      paint.color = accent
      canvas.drawArc(rect, -90f, 360f * fraction, false, paint)
    }
    if (sweepAngle >= 0f) {
      paint.alpha = 200
      canvas.drawArc(rect, sweepAngle - 360f, 60f, false, paint)
      paint.alpha = 255
    }
  }
}

/**
 * OverlaySegmented — a segmented control with a sliding active pill.
 *
 * Segments share equal widths, so switching sections animates the pill's
 * translation instead of rebuilding the row. The pill and label colours are
 * derived from the HUD accent (user-configurable), never from a hard-coded
 * brand colour.
 */
class OverlaySegmented(context: Context) : FrameLayout(context) {
  private val track = View(context)
  private val pill = View(context)
  private val row = LinearLayout(context)
  private val labels = ArrayList<Pair<String, TextView>>()
  private var animator: ValueAnimator? = null
  private var selected = ""
  var accent: Int = Color.WHITE
    set(value) { field = value; paintPill(); paintLabels() }
  var onSelect: ((String) -> Unit)? = null

  init {
    track.background = OverlayStyle.fill(context, 10, Color.parseColor("#141414"))
    addView(track, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(pill, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.MATCH_PARENT))
    row.orientation = LinearLayout.HORIZONTAL
    addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    paintPill()
  }

  fun setOptions(options: List<Pair<String, String>>) {
    row.removeAllViews()
    labels.clear()
    options.forEach { (id, label) ->
      val cell = OverlayStyle.text(context, label, 10.5f, OverlayStyle.MUTED, "Inter_600SemiBold").apply {
        gravity = android.view.Gravity.CENTER
        maxLines = 1
        isClickable = true
        isFocusable = true
        setOnClickListener {
          if (selected != id) {
            performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            select(id, true, true)
          }
        }
      }
      labels.add(id to cell)
      row.addView(cell, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f))
    }
    if (selected !in options.map { it.first }) selected = options.firstOrNull()?.first.orEmpty()
    requestLayout()
    paintLabels()
  }

  fun select(id: String, animate: Boolean = true, notify: Boolean = false) {
    if (labels.none { it.first == id }) return
    if (selected == id) {
      paintLabels()
      return
    }
    selected = id
    paintLabels()
    if (animate) animatePill() else placePill(0f)
    if (notify) onSelect?.invoke(id)
  }

  fun currentId(): String = selected

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = when (MeasureSpec.getMode(heightMeasureSpec)) {
      MeasureSpec.EXACTLY -> MeasureSpec.getSize(heightMeasureSpec)
      else -> OverlayStyle.dp(context, 38)
    }
    setMeasuredDimension(width, height)
    val wSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
    val hSpec = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    for (i in 0 until childCount) getChildAt(i).measure(wSpec, hSpec)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val w = right - left
    val h = bottom - top
    track.layout(0, 0, w, h)
    row.layout(0, 0, w, h)
    val cell = if (labels.isEmpty()) w else w / labels.size
    val inset = OverlayStyle.dp(context, 3)
    val pillWidth = (cell - inset * 2).coerceAtLeast(0)
    pill.layout(0, inset, pillWidth, h - inset)
    placePill(0f)
  }

  private fun animatePill() {
    val target = targetX()
    animator?.cancel()
    animator = ValueAnimator.ofFloat(pill.translationX, target).apply {
      duration = 190
      interpolator = DecelerateInterpolator()
      addUpdateListener { pill.translationX = it.animatedValue as Float }
      start()
    }
  }

  private fun placePill(overridden: Float?) {
    val target = overridden ?: targetX()
    pill.translationX = target
  }

  private fun targetX(): Float {
    if (labels.isEmpty()) return 0f
    val cell = width / labels.size
    val index = labels.indexOfFirst { it.first == selected }.coerceAtLeast(0)
    return (index * cell + OverlayStyle.dp(context, 3)).toFloat()
  }

  private fun paintPill() {
    pill.background = OverlayStyle.solid(
      context,
      8,
      OverlayStyle.tint(accent, 42),
      OverlayStyle.tint(accent, 120),
    )
  }

  private fun paintLabels() {
    labels.forEach { (id, view) ->
      val on = id == selected
      view.setTextColor(if (on) accent else OverlayStyle.MUTED)
      view.typeface = OverlayStyle.font(context, if (on) "Inter_600SemiBold" else "Inter_500Medium")
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    placePill(0f)
  }
}

/**
 * OverlayMeterBar — a thin measured-level bar under a metric value.
 * The caller maps the measured reading to a 0–1 fraction (null → an empty
 * track); the fill always comes from the same number the label shows, so
 * the bar adds emphasis without ever inventing a second value.
 */
class OverlayMeterBar(context: Context) : View(context) {
  var accent: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  private var fraction = -1f

  fun setFraction(value: Float?) {
    fraction = value?.coerceIn(0f, 1f) ?: -1f
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    val h = height.toFloat()
    val w = width.toFloat()
    if (h <= 0f || w <= 0f) return
    val radius = h / 2f
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.parseColor("#2e2e2e")
    canvas.drawRoundRect(RectF(0f, 0f, w, h), radius, radius, paint)
    if (fraction >= 0f) {
      paint.color = accent
      val filled = (w * fraction).coerceAtLeast(radius)
      canvas.drawRoundRect(RectF(0f, 0f, filled, h), radius, radius, paint)
    }
  }
}

/**
 * OverlayGauge — the monitor hero: a large measured ring with the reading
 * centred inside, styled after the phone assistant's circular gauges.
 * The caller supplies both the measured fraction and the honest label
 * ("--" when the sampler has not measured anything yet), so the ring and
 * the number can never disagree. Static soft halo; no breathing — the
 * boost ring owns the only animation in the panel.
 */
class OverlayGauge(context: Context) : View(context) {
  var accent: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  var fraction: Float = -1f
    set(value) { field = value.coerceIn(-1f, 1f); invalidate() }
  var label: String = "--"
    set(value) { field = value; invalidate() }
  private val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    textAlign = Paint.Align.CENTER
    color = Color.WHITE
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val radius = (minOf(cx, cy) - OverlayStyle.dpf(context, 5f)).coerceAtLeast(1f)

    val halo = Paint(Paint.ANTI_ALIAS_FLAG)
    halo.color = OverlayStyle.tint(accent, 14)
    canvas.drawCircle(cx, cy, radius + OverlayStyle.dpf(context, 4.5f), halo)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = OverlayStyle.dpf(context, 4.6f)
    paint.strokeCap = Paint.Cap.ROUND
    paint.color = Color.parseColor("#2c2c2c")
    val rect = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
    canvas.drawArc(rect, 0f, 360f, false, paint)

    if (fraction >= 0f) {
      paint.color = accent
      canvas.drawArc(rect, -90f, 360f * fraction, false, paint)
    }

    val measured = fraction >= 0f
    textPaint.typeface = OverlayStyle.font(context, "JetBrainsMono_700Bold")
    textPaint.textSize = OverlayStyle.dpf(context, 15f)
    textPaint.color = if (measured) OverlayStyle.INK else OverlayStyle.MUTED
    val text = label.takeIf { it.isNotBlank() } ?: "--"
    val baseline = cy - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(text, cx, baseline, textPaint)
  }
}
