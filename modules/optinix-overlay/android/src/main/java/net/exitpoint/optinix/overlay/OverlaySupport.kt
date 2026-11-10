package net.exitpoint.optinix.overlay

import android.Manifest
import android.app.ActivityManager
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Point
import android.graphics.Rect
import android.hardware.input.InputManager
import android.os.Build
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager

object OverlaySupport {
  fun canDraw(context: Context): Boolean = try { Settings.canDrawOverlays(context) } catch (_: Exception) { false }

  fun restricted(context: Context): Boolean = Build.VERSION.SDK_INT == 29 && !canDraw(context) &&
    (context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.isLowRamDevice == true

  fun reason(context: Context): String? = when {
    canDraw(context) -> null
    restricted(context) -> "Android 10 Go / low-memory builds can block Display over other apps. If Android disables the permission switch, the control HUD and stats HUD are unsupported on this device. In-app tools and session notifications still work."
    else -> "Allow Display over other apps in Android Settings to use the control HUD and stats HUD. Some games or phone policies can also block overlays."
  }

  fun notificationsEnabled(context: Context): Boolean = try {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.areNotificationsEnabled() &&
      (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
      manager.getNotificationChannel("optinix_gaming")?.importance != NotificationManager.IMPORTANCE_NONE
  } catch (_: Exception) { false }

  fun touchThroughOpacity(context: Context, requested: Double): Float {
    val maximum = if (Build.VERSION.SDK_INT >= 31) {
      try { (context.getSystemService(Context.INPUT_SERVICE) as InputManager).maximumObscuringOpacityForTouch }
      catch (_: Exception) { 0.8f }
    } else 1f
    return requested.coerceIn(0.4, 1.0).toFloat().coerceAtMost(maximum)
  }

  fun displayBounds(context: Context): Rect {
    val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    if (Build.VERSION.SDK_INT >= 30) return Rect(manager.maximumWindowMetrics.bounds)
    val size = Point()
    @Suppress("DEPRECATION")
    manager.defaultDisplay.getRealSize(size)
    return Rect(0, 0, size.x, size.y)
  }

  fun safeBounds(context: Context, view: View? = null): Rect {
    val area = displayBounds(context)
    val insets = view?.rootWindowInsets
    if (Build.VERSION.SDK_INT >= 30) {
      val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val safe = (insets ?: manager.currentWindowMetrics.windowInsets)
        .getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      area.set(area.left + safe.left, area.top + safe.top, area.right - safe.right, area.bottom - safe.bottom)
    } else if (insets != null) {
      val cutout = insets.displayCutout
      @Suppress("DEPRECATION")
      area.set(
        area.left + maxOf(insets.stableInsetLeft, cutout?.safeInsetLeft ?: 0),
        area.top + maxOf(insets.stableInsetTop, cutout?.safeInsetTop ?: 0),
        area.right - maxOf(insets.stableInsetRight, cutout?.safeInsetRight ?: 0),
        area.bottom - maxOf(insets.stableInsetBottom, cutout?.safeInsetBottom ?: 0)
      )
    }
    return area
  }
}
