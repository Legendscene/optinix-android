package net.exitpoint.optinix.overlay

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URI
import java.net.URL
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

object NetworkDiagnostics {
  private val running = AtomicBoolean(false)
  private val cancelled = AtomicBoolean(false)
  @Volatile private var connection: HttpURLConnection? = null
  private val dnsWorker = ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, ArrayBlockingQueue<Runnable>(1), { task -> Thread(task, "OptinixDns").apply { isDaemon = true } })

  fun cancel() { cancelled.set(true); connection?.disconnect() }

  fun diagnose(context: Context, config: Map<String, Any?>): Map<String, Any?> {
    if (!running.compareAndSet(false, true)) return mapOf("ok" to false, "message" to "A diagnostic is already running.")
    cancelled.set(false)
    try {
      val target = (config["target"] as? String) ?: "https://www.gstatic.com/generate_204"
      val uri = URI(target)
      require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null && target.length <= 300) { "Use an HTTPS target without credentials or fragments." }
      val count = ((config["samples"] as? Number)?.toInt() ?: 5).coerceIn(2, 10)
      val timeout = ((config["timeoutMs"] as? Number)?.toInt() ?: 2500).coerceIn(500, 5000)
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
      val transport = when {
        capabilities == null -> "offline"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
        else -> "other"
      }
      var dnsMs: Double? = null
      var dnsError: String? = null
      var addressCount: Int? = null
      try {
        val start = SystemClock.elapsedRealtimeNanos()
        val future = dnsWorker.submit<Array<InetAddress>> { InetAddress.getAllByName(uri.host) }
        try { addressCount = future.get(timeout.toLong(), TimeUnit.MILLISECONDS).size; dnsMs = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0 }
        finally { future.cancel(true) }
      } catch (_: Exception) { dnsError = "DNS lookup timed out or failed; the system resolver may be unavailable." }
      val samples = ArrayList<Map<String, Any?>>()
      repeat(count) {
        if (cancelled.get()) return@repeat
        val start = SystemClock.elapsedRealtimeNanos()
        var elapsed: Double? = null
        var status: Int? = null
        var error: String? = null
        try {
          connection = URL(target).openConnection() as HttpURLConnection
          connection!!.apply {
            connectTimeout = timeout; readTimeout = timeout
            requestMethod = "HEAD"; instanceFollowRedirects = false; useCaches = false
            setRequestProperty("Cache-Control", "no-cache")
          }
          status = connection!!.responseCode
          if (status in 200..299) elapsed = (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0
          else error = "HTTP $status (not a successful probe)"
        } catch (_: Exception) { error = if (cancelled.get()) "Cancelled" else "Request failed or timed out" }
        finally { connection?.disconnect(); connection = null }
        samples.add(mapOf("elapsedMs" to elapsed, "httpStatus" to status, "error" to error, "at" to System.currentTimeMillis()))
        if (!cancelled.get()) Thread.sleep(150)
      }
      val values = samples.map { (it["elapsedMs"] as? Number)?.toDouble() }
      val summary = NetworkSummary.summarize(values)
      return summary + mapOf(
        "ok" to (summary["averageMs"] != null && !cancelled.get()),
        "cancelled" to cancelled.get(), "target" to target, "transport" to transport,
        "validated" to capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED),
        "metered" to connectivity.isActiveNetworkMetered,
        "dnsMs" to dnsMs, "dnsAddressCount" to addressCount, "dnsError" to dnsError,
        "samples" to samples, "finishedAt" to System.currentTimeMillis(),
        "message" to if (cancelled.get()) "Diagnostic cancelled." else "HTTPS endpoint timing includes DNS/TLS/server overhead; it is not game-server ping or IP packet loss."
      )
    } catch (error: Exception) {
      return mapOf("ok" to false, "message" to (error.message ?: "Diagnostic failed."))
    } finally { running.set(false); connection = null }
  }
}
