package net.exitpoint.optinix.overlay

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toValues(): Map<String, Any?> = keys().asSequence().associateWith { key ->
  fun convert(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> value.toValues()
    is JSONArray -> (0 until value.length()).map { convert(value.opt(it)) }
    else -> value
  }
  convert(opt(key))
}

class GamingStore(context: Context) {
  val preferences = context.getSharedPreferences("optinix_gaming_v2", Context.MODE_PRIVATE)

  fun config(): JSONObject = json("config")

  fun configure(values: Map<String, Any?>) {
    val config = config()
    values.forEach { (key, value) -> config.put(key, JSONObject.wrap(value)) }
    preferences.edit().putString("config", config.toString()).apply()
  }

  fun history(): List<Map<String, Any?>> {
    val cutoff = System.currentTimeMillis() - config().optInt("retentionDays", 30).coerceIn(1, 90) * 86_400_000L
    val all = array("sessions").let { entries -> (0 until entries.length()).mapNotNull { entries.optJSONObject(it) } }
    val retained = all.filter { it.optLong("startedAt") >= cutoff }.take(50)
    if (all.size != retained.size) preferences.edit().putString("sessions", JSONArray(retained).toString()).apply()
    return retained.map { it.toValues() }
  }

  fun checkpoint(summary: Map<String, Any?>) {
    preferences.edit().putString("activeSession", JSONObject(summary).toString()).apply()
  }

  fun finish(summary: Map<String, Any?>) {
    val entries = listOf(summary) + history().filter { it["id"] != summary["id"] }
    preferences.edit().putString("sessions", JSONArray(entries.take(50)).toString()).remove("activeSession").apply()
  }

  fun recoverInterrupted() {
    val active = json("activeSession")
    if (active.has("id")) finish(active.toValues() + mapOf("interrupted" to true, "reason" to "process stopped"))
  }

  fun clearHistory() {
    preferences.edit().remove("sessions").apply()
  }

  fun macros(): List<JSONObject> = config().optJSONArray("macros")?.let { array ->
    (0 until array.length()).mapNotNull { array.optJSONObject(it) }.take(100)
  } ?: emptyList()

  fun games(): List<JSONObject> = config().optJSONArray("games")?.let { array ->
    (0 until array.length()).mapNotNull { array.optJSONObject(it) }.take(500)
  } ?: emptyList()

  private fun json(key: String): JSONObject = try { JSONObject(preferences.getString(key, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
  private fun array(key: String): JSONArray = try { JSONArray(preferences.getString(key, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
}
