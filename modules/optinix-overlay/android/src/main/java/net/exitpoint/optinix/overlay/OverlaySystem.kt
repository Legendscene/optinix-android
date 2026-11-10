package net.exitpoint.optinix.overlay

import android.content.Context
import android.provider.Settings
import kotlin.math.roundToInt

/**
 * OverlaySystem — the genuinely supported system controls the game panel can
 * operate, plus their capability probes.
 *
 * Android 10–16 lets an ordinary app change exactly two relevant global
 * settings, and both need the user-granted "Modify system settings" access:
 * screen brightness and the auto-rotate flag. Everything else (CPU/GPU
 * governors, other apps' frame rates, killing background apps) is reserved
 * for the system or root and is reported unsupported instead of faked.
 */
object OverlaySystem {
  private const val BRIGHTNESS_MAX = 255

  fun canWrite(context: Context): Boolean = try {
    Settings.System.canWrite(context)
  } catch (_: Exception) {
    false
  }

  /** Current SCREEN_BRIGHTNESS as 0..1, or null when the device hides it. */
  fun brightness(context: Context): Float? = try {
    val value = Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, -1)
    if (value < 0) null else (value.toFloat() / BRIGHTNESS_MAX).coerceIn(0f, 1f)
  } catch (_: Exception) {
    null
  }

  fun setBrightness(context: Context, fraction: Float): Map<String, Any?> {
    if (!canWrite(context)) return result(false, "permission", "Allow Modify system settings to control brightness from the HUD.")
    val level = OverlayDashboard.brightnessLevel(fraction, BRIGHTNESS_MAX)
    return try {
      Settings.System.putInt(
        context.contentResolver,
        Settings.System.SCREEN_BRIGHTNESS_MODE,
        Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL,
      )
      val applied = Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, level)
      if (applied) result(true, "applied", "Screen brightness set to ${(level * 100f / BRIGHTNESS_MAX).roundToInt()}%.")
      else result(false, "failed", "Android rejected the brightness change.")
    } catch (error: Exception) {
      result(false, "failed", error.message ?: "Android rejected the brightness change.")
    }
  }

  /** null = the setting is unreadable on this build. */
  fun rotationLocked(context: Context): Boolean? = try {
    Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 1) == 0
  } catch (_: Exception) {
    null
  }

  fun setRotationLock(context: Context, locked: Boolean): Map<String, Any?> {
    if (!canWrite(context)) return result(false, "permission", "Allow Modify system settings to lock rotation from the HUD.")
    return try {
      val applied = Settings.System.putInt(
        context.contentResolver,
        Settings.System.ACCELEROMETER_ROTATION,
        if (locked) 0 else 1,
      )
      if (applied) {
        result(
          true,
          "applied",
          if (locked) "Auto-rotate locked. This is the phone-wide rotation setting." else "Auto-rotate restored.",
        )
      } else {
        result(false, "failed", "Android rejected the rotation change.")
      }
    } catch (error: Exception) {
      result(false, "failed", error.message ?: "Android rejected the rotation change.")
    }
  }

  private fun result(ok: Boolean, status: String, message: String) =
    mapOf<String, Any?>("ok" to ok, "status" to status, "message" to message)
}
