package net.exitpoint.optinix.apps

import android.app.AppOpsManager
import android.app.ActivityManager
import android.app.NotificationManager
import android.Manifest
import android.app.usage.StorageStatsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
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

    AsyncFunction("openAppManagementSettings") {
      openSettings(Intent(Settings.ACTION_APPLICATION_SETTINGS))
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
      val lowRam = (context().getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.isLowRamDevice == true
      val restricted = Build.VERSION.SDK_INT == 29 && lowRam && !hasOverlayPermission()
      val notifications = context().getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      mapOf(
        "usageAccess" to hasUsageAccess(),
        "overlay" to hasOverlayPermission(),
        "overlayRestricted" to restricted,
        "overlayReason" to if (restricted) "Android 10 Go / low-memory builds can block overlay permission. If the switch is unavailable in Android Settings, floating HUDs are unsupported. In-app tools and session notifications still work." else null,
        "notifications" to (notifications.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33 || context().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && notifications.getNotificationChannel("optinix_gaming")?.importance != NotificationManager.IMPORTANCE_NONE),
        "batteryOptimizationExempt" to hasBatteryOptimizationExemption(),
        "packageName" to context().packageName
      )
    }

    // Startup (auto-start) capability probe. Android itself has no auto-start
    // page — vendors (Realme UI/ColorOS, MIUI, One UI, OxygenOS, vivo, ASUS,
    // EMUI) hide per-app start managers in their own packages. "supported" is
    // only true when one of the known managers is genuinely resolvable on
    // THIS device; nothing is simulated.
    AsyncFunction("getStartupSupport") { startupSupport() }

    AsyncFunction("openAutoStartSettings") { openAutoStartSettings() }
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
    var lastActivity: String? = null
    var lastStamp = 0L
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val type = event.eventType
      if (type == EVENT_MOVE_TO_FOREGROUND) {
        if (event.timeStamp >= lastStamp) {
          lastStamp = event.timeStamp
          lastPackage = event.packageName
          lastActivity = event.className
        }
      } else if ((type == 2 || type == 23) && event.packageName == lastPackage && event.timeStamp >= lastStamp &&
        (lastActivity == null || event.className == null || event.className == lastActivity)) {
        lastPackage = null
        lastActivity = null
        lastStamp = event.timeStamp
      } else if (type in listOf(15, 17, 26) && event.timeStamp >= lastStamp) { lastPackage = null; lastActivity = null; lastStamp = event.timeStamp }
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

  private fun hasOverlayPermission(): Boolean = try { Settings.canDrawOverlays(context()) } catch (_: Exception) { false }

  private fun hasBatteryOptimizationExemption(): Boolean {
    val power = context().getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
      ?: return false
    return try {
      power.isIgnoringBatteryOptimizations(context().packageName)
    } catch (_: Exception) {
      false
    }
  }

  /** Capability scan: the first auto-start manager actually present on this
   *  device wins; null means the vendor control is not supported here and
   *  the UI must say so instead of pretending. After the class-name scan, an
   *  action-based fallback catches OEM releases that reuse the manager app
   *  under new activity names (seen on RMX3998 ColorOS: Phone Manager exposes
   *  its app management via the oplus intent actions, no StartupAppListActivity). */
  private fun resolveAutoStartManager(): ActivityInfo? {
    val manager = packageManager()
    for ((packageName, classes) in AUTO_START_CANDIDATES) {
      for (className in classes) {
        val activity = try {
          manager.getActivityInfo(ComponentName(packageName, className), 0)
        } catch (_: Exception) {
          null
        } ?: continue
        if (canOpenManager(activity)) return activity
      }
    }
    for (action in AUTO_START_ACTIONS) {
      val activity = try {
        manager.resolveActivity(Intent(action), PackageManager.MATCH_DEFAULT_ONLY)
      } catch (_: Exception) {
        null
      }?.activityInfo ?: continue
      if (canOpenManager(activity)) return activity
    }
    return null
  }

  private fun canOpenManager(activity: ActivityInfo): Boolean = activity.exported && activity.enabled && activity.applicationInfo.enabled &&
    (activity.permission == null || context().checkSelfPermission(activity.permission) == PackageManager.PERMISSION_GRANTED)

  private fun startupSupport(): Map<String, Any?> {
    val activity = resolveAutoStartManager()
    return mapOf(
      "supported" to (activity != null),
      "manufacturer" to Build.MANUFACTURER,
      "managerLabel" to try { activity?.loadLabel(packageManager())?.toString() } catch (_: Exception) { activity?.packageName },
      "directAutoStart" to (activity?.name?.let { name -> listOf("Startup", "AutoStart", "Autostart", "ChainLaunch", "BgStart").any { name.contains(it, ignoreCase = true) } } == true),
      "packageName" to context().packageName
    )
  }

  private fun openAutoStartSettings(): Map<String, Any?> {
    val activity = resolveAutoStartManager()
      ?: return mapOf(
        "ok" to false,
        "supported" to false,
        "message" to "Startup control is not supported on this device. Use Settings → Apps → $APP_LABEL for battery and background options instead."
      )
    val opened = openSettings(Intent().setClassName(activity.packageName, activity.name))
    val label = try { activity.loadLabel(packageManager()).toString() } catch (_: Exception) { "the vendor manager" }
    return when {
      opened -> mapOf("ok" to true, "supported" to true, "message" to "Opened $label. Check its battery or startup controls; available options vary by phone version.")
      else -> mapOf("ok" to false, "supported" to true, "message" to "Android blocked opening $label. It may not be exported on this device version.")
    }
  }

  companion object {
    private const val MAX_APPS = 400
    private const val MAX_RECENT = 40
    private const val MAX_STORAGE_QUERY = 60
    private const val MAX_BOOST = 80
    private const val FOREGROUND_LOOKBACK_MS = 10 * 60 * 1000L
    private const val EVENT_MOVE_TO_FOREGROUND = 1
    /** The app's own display name, used only for honest fallback copy. */
    private const val APP_LABEL = "Optinix"

    /** Known vendor auto-start managers. Each candidate is resolved via
     *  getActivityInfo() at run time — visibility-gated on Android 11+, so a
     *  package that does not exist (or is hidden) throws and we move on. */
    private val AUTO_START_CANDIDATES = listOf(
      // Realme UI / ColorOS (the current test device is Realme RMX3998)
      "com.coloros.safecenter" to listOf(
        "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.coloros.safecenter.startup.StartupAppListActivity"
      ),
      "com.coloros.phonemanager" to listOf(
        "com.coloros.phonemanager.activity.StartupAppListActivity",
        // Current ColorOS/Realme UI releases: the auto-start controls live
        // inside Phone Manager's app management (no StartupAppListActivity).
        "com.oplus.phonemanager.appmanager.AppManagerActivity",
      ),
      // legacy OPPO
      "com.oppo.safe" to listOf(
        "com.oppo.safe.permission.startup.StartupAppListActivity"
      ),
      // MIUI / HyperOS
      "com.miui.securitycenter" to listOf(
        "com.miui.permcenter.autostart.AutoStartManagementActivity"
      ),
      // Samsung One UI (Device care battery page)
      "com.samsung.android.sm" to listOf(
        "com.samsung.android.sm.ui.battery.BatteryActivity"
      ),
      "com.samsung.android.lool" to listOf(
        "com.samsung.android.sm.ui.battery.BatteryActivity"
      ),
      // OxygenOS
      "com.oneplus.security" to listOf(
        "com.oneplus.security.chainlaunchs.ChainLaunchAppListActivity"
      ),
      // vivo / iQOO
      "com.iqoo.secure" to listOf(
        "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"
      ),
      "com.vivo.permissionmanager" to listOf(
        "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
      ),
      // ASUS
      "com.asus.mobilemanager" to listOf(
        "com.asus.mobilemanager.entryfunction.EntryActivity"
      ),
      // EMUI / HarmonyOS
      "com.huawei.systemmanager" to listOf(
        "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
      )
    )

    /** Packages may hide the manager behind renamed activities; these intent
     *  actions still resolve on the OEM's own app (verified in the RMX3998
     *  Activity Resolver Table for com.coloros.phonemanager). */
    private val AUTO_START_ACTIONS = listOf(
      "oplus.intent.action.APP_MANAGER_ACTIVITY",
      "oplus.intent.action.PHONE_MANAGER_MAIN_ACTIVITY",
      "com.coloros.safecenter.SecureSafeMainActivity"
    )

    private val GAME_HINTS = listOf(
      "game", "gameloft", "supercell", "tencent", "garena", "krafton",
      "epicgames", "riotgames", "miniclip", "outfit7", "playrix",
      "zynga", "rovio", "ubisoft", "mihoyo", "hoyoverse", "pubg",
      "bgmi", "freefire", "cod", "minecraft", "roblox"
    )
  }
}
