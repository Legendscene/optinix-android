package net.exitpoint.optinix.apps

import android.app.AppOpsManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Process
import android.os.storage.StorageManager
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File

class OptinixAppsModule : Module() {
  private fun context(): Context =
    appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private fun packageManager(): PackageManager = context().packageManager

  override fun definition() = ModuleDefinition {
    Name("OptinixApps")

    Constant("isSupported") { true }

    AsyncFunction("getInstalledApps") { includeSystem: Boolean ->
      installedApps(includeSystem)
    }

    AsyncFunction("getGameCandidates") {
      installedApps(false)
        .filter { it["isGame"] == true }
    }

    AsyncFunction("getAppIcon") { packageName: String, sizePx: Int ->
      iconDataUri(packageName, sizePx.coerceIn(48, 256))
    }

    AsyncFunction("getForegroundApp") {
      foregroundApp()
    }

    AsyncFunction("getRecentApps") { hours: Int ->
      recentApps(hours.coerceIn(1, 168))
    }

    AsyncFunction("getStorageStats") { packageNames: List<String> ->
      storageStats(packageNames)
    }

    AsyncFunction("boost") { packageNames: List<String> ->
      boost(packageNames)
    }

    AsyncFunction("clearOwnCache") {
      clearOwnCache()
    }

    AsyncFunction("openApp") { packageName: String ->
      openApp(packageName)
    }

    AsyncFunction("openAppInfo") { packageName: String ->
      openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
    }

    AsyncFunction("hasUsageAccess") {
      hasUsageAccess()
    }

    AsyncFunction("openUsageAccessSettings") {
      openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    AsyncFunction("hasOverlayPermission") {
      hasOverlayPermission()
    }

    AsyncFunction("openOverlaySettings") {
      val uri = Uri.parse("package:${context().packageName}")
      openSettings(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, uri))
    }

    AsyncFunction("hasBatteryOptimizationExemption") {
      hasBatteryOptimizationExemption()
    }

    AsyncFunction("requestBatteryOptimizationExemption") {
      val uri = Uri.parse("package:${context().packageName}")
      openSettings(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, uri))
    }

    AsyncFunction("getPermissionState") {
      mapOf(
        "usageAccess" to hasUsageAccess(),
        "overlay" to hasOverlayPermission(),
        "batteryOptimizationExempt" to hasBatteryOptimizationExemption(),
        "packageName" to context().packageName
      )
    }
  }

  private fun installedApps(includeSystem: Boolean): List<Map<String, Any?>> {
    val manager = packageManager()
    val flags = PackageManager.GET_META_DATA
    val packages = try {
      manager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), flags)
        .map { it.activityInfo.applicationInfo }
        .distinctBy { it.packageName }
    } catch (_: Exception) {
      return emptyList()
    }

    val result = ArrayList<Map<String, Any?>>()
    for (info in packages) {
      if (info.packageName == context().packageName) continue
      val isSystem = (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0
      if (isSystem && !includeSystem) continue
      val game = isGame(info)
      if (result.size >= MAX_APPS) break
      result.add(
        mapOf(
          "packageName" to info.packageName,
          "label" to labelOf(info),
          "isSystem" to isSystem,
          "isGame" to game,
          "installed" to true,
          "detection" to if (Build.VERSION.SDK_INT >= 26 && info.category == ApplicationInfo.CATEGORY_GAME) "category" else "heuristic",
          "versionName" to versionName(info.packageName),
          "targetSdk" to info.targetSdkVersion,
          "uid" to info.uid
        )
      )
    }

    return result.sortedWith(
      compareBy<Map<String, Any?>> { it["isSystem"] == true }
        .thenBy { (it["label"] as? String)?.lowercase() ?: "" }
    )
  }

  private fun labelOf(info: ApplicationInfo): String = try {
    packageManager().getApplicationLabel(info).toString()
  } catch (_: Exception) {
    info.packageName
  }

  private fun versionName(packageName: String): String? = try {
    @Suppress("DEPRECATION")
    packageManager().getPackageInfo(packageName, 0).versionName
  } catch (_: Exception) {
    null
  }

  private fun isGame(info: ApplicationInfo): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (info.category == ApplicationInfo.CATEGORY_GAME) return true
    }
    val name = info.packageName.lowercase()
    return GAME_HINTS.any { name.contains(it) }
  }

  private fun iconDataUri(packageName: String, sizePx: Int): String? {
    return try {
      val drawable = packageManager().getApplicationIcon(packageName)
      val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, sizePx, sizePx)
      drawable.draw(canvas)
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      bitmap.recycle()
      val encoded = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
      "data:image/png;base64,$encoded"
    } catch (_: Exception) {
      null
    }
  }

  private fun foregroundApp(): Map<String, Any?>? {
    if (!hasUsageAccess()) return null
    val manager = usageManager() ?: return null
    val now = System.currentTimeMillis()
    val events = try {
      manager.queryEvents(now - FOREGROUND_LOOKBACK_MS, now)
    } catch (_: Exception) {
      return null
    }
    val event = UsageEvents.Event()
    var lastPackage: String? = null
    var lastStamp = 0L
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val type = event.eventType
      if (type == EVENT_MOVE_TO_FOREGROUND) {
        if (event.timeStamp >= lastStamp) {
          lastStamp = event.timeStamp
          lastPackage = event.packageName
        }
      } else if ((type == 2 || type == 23) && event.packageName == lastPackage && event.timeStamp >= lastStamp) {
        lastPackage = null
        lastStamp = event.timeStamp
      }
    }
    val packageName = lastPackage ?: return null
    val info = try {
      @Suppress("DEPRECATION")
      packageManager().getApplicationInfo(packageName, 0)
    } catch (_: Exception) {
      null
    }
    return mapOf(
      "packageName" to packageName,
      "label" to (info?.let { labelOf(it) } ?: packageName),
      "isGame" to (info?.let { isGame(it) } ?: false),
      "sinceMs" to lastStamp
    )
  }

  private fun recentApps(hours: Int): List<Map<String, Any?>> {
    if (!hasUsageAccess()) return emptyList()
    val manager = usageManager() ?: return emptyList()
    val now = System.currentTimeMillis()
    val stats = try {
      manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - hours * 3_600_000L, now)
    } catch (_: Exception) {
      return emptyList()
    }
    if (stats.isEmpty()) return emptyList()

    val ownPackage = context().packageName
    return stats
      .filter { it.packageName != ownPackage && it.lastTimeUsed > 0L }
      .sortedByDescending { it.lastTimeUsed }
      .take(MAX_RECENT)
      .mapNotNull { entry ->
        val info = try {
          @Suppress("DEPRECATION")
          packageManager().getApplicationInfo(entry.packageName, 0)
        } catch (_: Exception) {
          null
        } ?: return@mapNotNull null
        mapOf(
          "packageName" to entry.packageName,
          "label" to labelOf(info),
          "isGame" to isGame(info),
          "isSystem" to ((info.flags and ApplicationInfo.FLAG_SYSTEM) != 0),
          "lastTimeUsed" to entry.lastTimeUsed,
          "totalTimeInForegroundMs" to entry.totalTimeInForeground
        )
      }
  }

  private fun storageStats(packageNames: List<String>): List<Map<String, Any?>> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return emptyList()
    val storageManager = context().getSystemService(Context.STORAGE_SERVICE) as? StorageManager
      ?: return emptyList()
    val statsManager = context().getSystemService(Context.STORAGE_STATS_SERVICE) as? StorageStatsManager
      ?: return emptyList()
    val uuid = try {
      storageManager.getUuidForPath(context().filesDir)
    } catch (_: Exception) {
      return emptyList()
    }

    val result = ArrayList<Map<String, Any?>>()
    for (packageName in packageNames.distinct().take(MAX_STORAGE_QUERY)) {
      try {
        val stats = statsManager.queryStatsForPackage(uuid, packageName, Process.myUserHandle())
        result.add(
          mapOf(
            "packageName" to packageName,
            "cacheBytes" to stats.cacheBytes,
            "dataBytes" to stats.dataBytes,
            "appBytes" to stats.appBytes,
            "totalBytes" to (stats.dataBytes + stats.appBytes),
            "supported" to true
          )
        )
      } catch (_: Exception) {
        result.add(mapOf("packageName" to packageName, "supported" to false))
      }
    }
    return result
  }

  private fun boost(packageNames: List<String>): Map<String, Any?> {
    return mapOf(
      "ok" to false, "supported" to false, "requested" to 0, "killed" to null,
      "reviewed" to packageNames.distinct().size,
      "message" to "Android manages background memory. Other apps are not force-stopped; use their app settings to review resource use."
    )
  }

  private fun clearOwnCache(): Map<String, Any?> {
    var freed = 0L
    val targets = ArrayList<File>()
    context().cacheDir?.let { targets.add(it) }
    context().externalCacheDir?.let { targets.add(it) }
    for (dir in targets) {
      val root = dir.canonicalPath + File.separator
      fun remove(file: File): Long {
        return try {
          if (!file.canonicalPath.startsWith(root)) 0L
          else if (file.isDirectory) {
            val deleted = file.listFiles()?.sumOf { remove(it) } ?: 0L
            file.delete()
            deleted
          } else {
            val bytes = file.length()
            if (file.delete()) bytes else 0L
          }
        } catch (_: Exception) { 0L }
      }
      freed += dir.listFiles()?.sumOf { remove(it) } ?: 0L
    }
    return mapOf("ok" to true, "freedBytes" to freed, "scope" to "optinix-cache")
  }

  private fun sizeOf(dir: File): Long {
    if (!dir.exists()) return 0L
    if (dir.isFile) return dir.length()
    var total = 0L
    val children = dir.listFiles() ?: return 0L
    for (child in children) {
      total += sizeOf(child)
    }
    return total
  }

  private fun openApp(packageName: String): Boolean {
    val intent = packageManager().getLaunchIntentForPackage(packageName) ?: return false
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context().startActivity(intent)
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun openSettings(intent: Intent): Boolean {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context().startActivity(intent)
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun usageManager(): UsageStatsManager? =
    context().getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

  private fun hasUsageAccess(): Boolean {
    val appOps = context().getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
    if (appOps != null) {
      try {
        val mode = appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context().packageName
        )
        if (mode == AppOpsManager.MODE_ALLOWED) return true
      } catch (_: Exception) {
      }
    }
    return false
  }

  private fun hasOverlayPermission(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context()) else true

  private fun hasBatteryOptimizationExemption(): Boolean {
    val power = context().getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
      ?: return false
    return try {
      power.isIgnoringBatteryOptimizations(context().packageName)
    } catch (_: Exception) {
      false
    }
  }

  companion object {
    private const val MAX_APPS = 400
    private const val MAX_RECENT = 40
    private const val MAX_STORAGE_QUERY = 60
    private const val MAX_BOOST = 80
    private const val FOREGROUND_LOOKBACK_MS = 10 * 60 * 1000L
    private const val EVENT_MOVE_TO_FOREGROUND = 1

    private val GAME_HINTS = listOf(
      "game", "gameloft", "supercell", "tencent", "garena", "krafton",
      "epicgames", "riotgames", "miniclip", "outfit7", "playrix",
      "zynga", "rovio", "ubisoft", "mihoyo", "hoyoverse", "pubg",
      "bgmi", "freefire", "cod", "minecraft", "roblox"
    )
  }
}
