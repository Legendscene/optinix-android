package net.exitpoint.optinix.overlay

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle

class CaptureConsentActivity : Activity() {
  private var requested = false
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requested = savedInstanceState?.getBoolean("requested") ?: false
    if (requested) return
    val recording = intent.getStringExtra("mode") == "record"
    AlertDialog.Builder(this)
      .setTitle(if (recording) "Record your screen?" else "Take a screenshot?")
      .setMessage("Android will ask for screen-capture permission. ${if (recording) "Video is silent, limited to 10 minutes, and can be stopped from the notification or Optinix." else "One image will be captured after you confirm."} Captures stay on this device. Secure content cannot be captured.")
      .setPositiveButton("Continue") { _, _ ->
        requested = true
        try {
          val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
          startActivityForResult(manager.createScreenCaptureIntent(), REQUEST)
        } catch (_: Exception) { CaptureService.captureMessage = "Screen capture is unavailable on this device."; finish() }
      }
      .setNegativeButton("Cancel") { _, _ -> CaptureService.captureMessage = "Capture cancelled."; finish() }
      .setOnCancelListener { CaptureService.captureMessage = "Capture cancelled."; finish() }
      .show()
  }

  override fun onSaveInstanceState(outState: Bundle) { outState.putBoolean("requested", requested); super.onSaveInstanceState(outState) }

  @Deprecated("Activity result bridge for native consent activity")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST) return
    if (resultCode == RESULT_OK && data != null) {
      val service = Intent(this, CaptureService::class.java)
        .putExtra("resultCode", resultCode).putExtra("data", data).putExtra("mode", intent.getStringExtra("mode"))
      try {
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service) else startService(service)
      } catch (error: Exception) { CaptureService.captureMessage = error.message ?: "Android refused capture startup." }
    } else CaptureService.captureMessage = "Screen-capture consent was denied. Nothing was captured."
    finish()
  }

  override fun onDestroy() { if (!isChangingConfigurations) pending = false; super.onDestroy() }

  companion object {
    private const val REQUEST = 7160
    @Volatile private var pending = false
    fun request(context: Context, mode: String): Map<String, Any?> {
      if (mode !in setOf("screenshot", "record")) return GamingActions.result(false, "Unsupported capture mode.")
      if (pending || CaptureService.active) return GamingActions.result(false, "Finish or cancel the current capture first.")
      return try {
        pending = true
        CaptureService.captureMessage = "Awaiting your screen-capture consent."
        context.startActivity(Intent(context, CaptureConsentActivity::class.java).putExtra("mode", mode).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        GamingActions.result(true, "Confirm the disclosure and Android screen-capture dialog.", "user-action")
      } catch (_: Exception) { pending = false; GamingActions.result(false, "Open Optinix to request screen capture.", "user-action") }
    }
  }
}
