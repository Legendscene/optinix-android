package net.exitpoint.optinix.overlay

import android.app.AutomaticZenRule
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Build
import android.service.notification.Condition
import android.service.notification.ZenPolicy

class DndController(private val context: Context) {
  private val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private val prefs = GamingStore(context).preferences
  private val condition = Uri.parse("condition://${context.packageName}/gaming-session")

  fun access(): Boolean = manager.isNotificationPolicyAccessGranted

  fun active(): Boolean {
    if (!access() || Build.VERSION.SDK_INT < 29) return false
    return try {
      val id = prefs.getString("dndRuleId", null) ?: return false
      val rule = manager.getAutomaticZenRule(id) ?: return false
      rule.isEnabled && prefs.getBoolean("dndRequested", false)
    } catch (_: Exception) { false }
  }

  fun set(enabled: Boolean): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < 29) return result(false, "unsupported", "Use Android DND settings on Android 7–9.")
    if (!access()) return result(false, "permission", "Allow notification-policy access to control the Optinix DND rule.")
    return try {
      var id = prefs.getString("dndRuleId", null)
      if (id != null && manager.getAutomaticZenRule(id) == null) id = null
      if (id == null && enabled) {
        val rule = AutomaticZenRule(
          "Optinix gaming session", null, ComponentName(context, DndRuleActivity::class.java),
          condition, ZenPolicy.Builder().allowAlarms(true).allowMedia(true)
            .allowCalls(ZenPolicy.PEOPLE_TYPE_NONE).allowMessages(ZenPolicy.PEOPLE_TYPE_NONE).build(),
          NotificationManager.INTERRUPTION_FILTER_PRIORITY, true
        )
        id = manager.addAutomaticZenRule(rule)
        prefs.edit().putString("dndRuleId", id).apply()
      }
      if (id != null) {
        if (enabled) {
          val rule = manager.getAutomaticZenRule(id)
          if (rule != null && !rule.isEnabled) return result(false, "user-action", "The Optinix rule is disabled in Android Modes. Enable it in system settings.")
        }
        manager.setAutomaticZenRuleState(id, Condition(condition, "Optinix gaming session", if (enabled) Condition.STATE_TRUE else Condition.STATE_FALSE))
      }
      prefs.edit().putBoolean("dndRequested", enabled).apply()
      result(true, "applied", if (enabled) "Optinix DND rule requested. Other active rules still apply." else "Optinix DND rule released. Your other DND rules are unchanged.")
    } catch (error: Exception) {
      result(false, "failed", error.message ?: "Android refused the Optinix DND rule.")
    }
  }

  private fun result(ok: Boolean, status: String, message: String) = mapOf("ok" to ok, "status" to status, "message" to message)
}
