package net.exitpoint.optinix.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

object GamingActions {
  fun result(ok: Boolean, message: String, status: String = if (ok) "applied" else "failed") =
    mapOf<String, Any?>("ok" to ok, "status" to status, "message" to message)

  fun openSettings(context: Context, target: String): Map<String, Any?> {
    val intent = when (target) {
      "display" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
      "dnd" -> Intent("android.settings.ZEN_MODE_SETTINGS")
      "dnd-access" -> Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
      "usage" -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      "storage" -> Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS)
      "battery" -> Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
      "network" -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
      "notifications" -> if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName) else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      "app" -> Intent(Intent.ACTION_VIEW, Uri.parse("optinix://games")).setPackage(context.packageName)
      else -> null
    } ?: return result(false, "No supported settings screen for this action.", "unsupported")
    return try {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      result(true, "System control opened. Changes require your action there.", "user-action")
    } catch (_: Exception) {
      result(false, "This device does not expose that settings screen. Open Android Settings manually.", "unsupported")
    }
  }
}
