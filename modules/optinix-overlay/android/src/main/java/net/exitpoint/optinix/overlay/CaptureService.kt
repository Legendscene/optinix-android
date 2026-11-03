package net.exitpoint.optinix.overlay

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.WindowManager
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

class CaptureService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val imageThread = HandlerThread("OptinixCapture")
  private var projection: MediaProjection? = null
  private var display: VirtualDisplay? = null
  private var reader: ImageReader? = null
  private var recorder: MediaRecorder? = null
  private var file: ParcelFileDescriptor? = null
  private var output: Uri? = null
  private var recorderStarted = false
  private var imageSaved = false
  private var video = false
  private var destroyed = false
  private val takingImage = AtomicBoolean(false)
  private val captureLock = Any()
  private val callback = object : MediaProjection.Callback() { override fun onStop() { stopSelf() } }
  private val screenOff = object : BroadcastReceiver() { override fun onReceive(context: Context?, intent: Intent?) { stopSelf() } }

  override fun onCreate() {
    super.onCreate()
    imageThread.start()
    if (Build.VERSION.SDK_INT >= 26) (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel("optinix_capture", "Screen capture", NotificationManager.IMPORTANCE_LOW))
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
    else registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == STOP || intent == null) { stopSelf(); return START_NOT_STICKY }
    if (active) return START_NOT_STICKY
    val data = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra("data", Intent::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra<Intent>("data")
    if (data == null || intent.getIntExtra("resultCode", 0) != Activity.RESULT_OK) { captureMessage = "Capture consent missing."; stopSelf(); return START_NOT_STICKY }
    video = intent.getStringExtra("mode") == "record"
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(47824, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(47824, notification())
      active = true
      val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(Activity.RESULT_OK, data)
      projection!!.registerCallback(callback, handler)
      output = CaptureRepository(this).create(video)
      val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val bounds = if (Build.VERSION.SDK_INT >= 30) wm.maximumWindowMetrics.bounds else android.graphics.Rect(0, 0, resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels)
      val factor = minOf(1.0, (if (video) 1280.0 else 1600.0) / max(bounds.width(), bounds.height()))
      val width = max(2, ((bounds.width() * factor).toInt() / 2) * 2)
      val height = max(2, ((bounds.height() * factor).toInt() / 2) * 2)
      val density = resources.displayMetrics.densityDpi
      if (video) {
        file = contentResolver.openFileDescriptor(output!!, "w") ?: throw IllegalStateException("Capture file is unavailable.")
        recorder = (if (Build.VERSION.SDK_INT >= 31) MediaRecorder(this) else @Suppress("DEPRECATION") MediaRecorder()).apply {
          setVideoSource(MediaRecorder.VideoSource.SURFACE)
          setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
          setVideoEncoder(MediaRecorder.VideoEncoder.H264)
          setVideoSize(width, height)
          setVideoFrameRate(30)
          setVideoEncodingBitRate(4_000_000)
          setOutputFile(file!!.fileDescriptor)
          setMaxDuration(600_000)
          setOnInfoListener { _, what, _ -> if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) stopSelf() }
          setOnErrorListener { _, _, _ -> captureMessage = "Recording stopped after an encoder error."; stopSelf() }
          prepare()
        }
        display = projection!!.createVirtualDisplay("Optinix recording", width, height, density, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recorder!!.surface, null, handler)
        recorder!!.start()
        recorderStarted = true
        recording = true
        captureMessage = "Recording silent video. Stop from the notification, HUD or Optinix."
      } else {
        val readyAfter = SystemClock.elapsedRealtime() + 750
        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        reader!!.setOnImageAvailableListener({ source ->
          val image = try { source.acquireLatestImage() } catch (_: Exception) { null } ?: return@setOnImageAvailableListener
          synchronized(captureLock) {
          try {
            if (SystemClock.elapsedRealtime() < readyAfter || !takingImage.compareAndSet(false, true) || destroyed) return@setOnImageAvailableListener
            val plane = image.planes[0]
            val paddedWidth = plane.rowStride / plane.pixelStride
            val bitmap = Bitmap.createBitmap(paddedWidth, height, Bitmap.Config.ARGB_8888)
            bitmap.copyPixelsFromBuffer(plane.buffer)
            val cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height)
            try {
              contentResolver.openOutputStream(output!!)?.use { stream ->
                if (!cropped.compress(Bitmap.CompressFormat.PNG, 100, stream)) throw IllegalStateException("Image could not be saved.")
              } ?: throw IllegalStateException("Image file is unavailable.")
              imageSaved = true
            } finally { if (cropped !== bitmap) cropped.recycle(); bitmap.recycle() }
          } catch (error: Exception) { captureMessage = error.message ?: "Screenshot failed." }
          finally { image.close(); if (takingImage.get()) handler.post { stopSelf() } }
          }
        }, Handler(imageThread.looper))
        display = projection!!.createVirtualDisplay("Optinix screenshot", width, height, density, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, handler)
        captureMessage = "Capturing one image. Secure content may be blank."
        handler.postDelayed({ if (!imageSaved) captureMessage = "No screen image was received."; stopSelf() }, 7000)
      }
    } catch (error: Exception) { captureMessage = error.message ?: "Capture failed."; stopSelf() }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    synchronized(captureLock) { destroyed = true }
    handler.removeCallbacksAndMessages(null)
    var success = imageSaved
    if (recorderStarted) {
      try { recorder?.stop(); success = true } catch (_: Exception) { captureMessage = "Recording was too short or the encoder failed; no video was saved." }
    }
    try { display?.release() } catch (_: Exception) {}
    try { reader?.setOnImageAvailableListener(null, null); reader?.close() } catch (_: Exception) {}
    try { recorder?.reset(); recorder?.release() } catch (_: Exception) {}
    try { file?.close() } catch (_: Exception) {}
    try { projection?.unregisterCallback(callback); projection?.stop() } catch (_: Exception) {}
    try { unregisterReceiver(screenOff) } catch (_: Exception) {}
    output?.let { uri ->
      try {
        val repository = CaptureRepository(this)
        if (success) { repository.finish(uri, video); captureMessage = if (video) "Video saved on this device." else "Screenshot saved on this device." }
        else repository.discard(uri)
      } catch (_: Exception) { captureMessage = "Capture file could not be finalized." }
    }
    imageThread.quitSafely()
    active = false; recording = false
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun notification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "optinix_capture") else @Suppress("DEPRECATION") Notification.Builder(this)
    val stop = PendingIntent.getService(this, 7180, Intent(this, CaptureService::class.java).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return builder.setSmallIcon(android.R.drawable.ic_menu_camera).setContentTitle(if (video) "Optinix is recording your screen" else "Optinix screenshot")
      .setContentText("User-authorized capture • no microphone audio").setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Stop capture", stop).build()).build()
  }

  companion object {
    private const val STOP = "net.exitpoint.optinix.capture.STOP"
    @Volatile var active = false
    @Volatile var recording = false
    @Volatile var captureMessage = "No capture running."
    fun stop(context: Context) { context.stopService(Intent(context, CaptureService::class.java)) }
    fun state(): Map<String, Any?> = mapOf("active" to active, "recording" to recording, "message" to captureMessage)
  }
}
