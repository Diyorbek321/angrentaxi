package uz.angren.taxi

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import kotlin.math.abs

/**
 * Onlayn haydovchi ilovadan chiqqanda: suzuvchi tugma, zakaz kelganda ilovani
 * ekranga chiqarish va ovozli bildirishnoma.
 *
 * NEGA SUZUVCHI TUGMA: Android 10+ fondagi ilovaga Activity ochishni taqiqlaydi.
 * Istisno — "Boshqa ilovalar ustida ko'rsatish" (SYSTEM_ALERT_WINDOW) ruxsati;
 * Android 15 (targetSdk 35) da esa bu ruxsat bilan birga ilovaning EKRANDA
 * KO'RINIB TURGAN oynasi ham bo'lishi shart. Tugma aynan shu oyna (va haydovchi
 * uchun ilovaga qaytish yo'li).
 *
 * Jarayon onlayn paytda geolocator'ning foreground service'i bilan tirik
 * turadi, shuning uchun alohida Service kerak emas — hamma narsa
 * applicationContext orqali.
 */
object DriverOverlay {
    // ⚠️ Kanal sozlamasi (ovoz, muhimlik) yaratilgandan keyin O'ZGARMAYDI.
    // Qo'ng'iroqdek jiringlash uchun yangi id; eskisi o'chiriladi.
    private const val CHANNEL_ID = "driver_offers_ring"
    private const val LEGACY_CHANNEL_ID = "driver_offers"
    private const val NOTIFICATION_ID = 4201

    /**
     * Taklif 15 s yashaydi (backend OFFER_TIMEOUT_MS). Odatda Dart uni bekor
     * qiladi; bu — zaxira: Dart o'lgan bo'lsa ham jiringlash 30 s da to'xtaydi.
     */
    private const val OFFER_TIMEOUT_MS = 30_000L

    /** MainActivity shu belgini ko'rsa, bloklangan ekran ustida ochiladi. */
    const val EXTRA_OFFER_ALERT = "uz.angren.taxi.OFFER_ALERT"

    /** MainActivity onResume/onPause: ekrandagi ilovada taklif ekrani o'zi ochiq. */
    @Volatile
    var appVisible = false

    /** Oxirgi e'lon qilingan taklif — socket va FCM bir taklifni ikki marta jiringlatmasin. */
    @Volatile
    private var lastOfferId: String? = null

    private var bubble: View? = null
    private var lastX = 0
    private var lastY = 300

    fun canDrawOverlays(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    fun openOverlaySettings(context: Context) {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /** MIUI'da qo'shimcha "fonda qalqib chiquvchi oynalar" ruxsati bor. */
    fun isXiaomiFamily(): Boolean {
        val m = Build.MANUFACTURER.lowercase()
        return m.contains("xiaomi") || m.contains("redmi") || m.contains("poco")
    }

    /** Ilovani old planga chiqaradi. Bloklangan bo'lsa Android jim rad etadi. */
    fun bringToFront(context: Context): Boolean {
        return try {
            val intent = Intent(context, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP,
            )
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            false
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    fun showBubble(context: Context): Boolean {
        if (bubble != null) return true
        if (!canDrawOverlays(context)) return false
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val density = context.resources.displayMetrics.density
        val size = (56 * density).toInt()

        val view = ImageView(context).apply {
            setImageResource(R.mipmap.ic_launcher)
            val pad = (6 * density).toInt()
            setPadding(pad, pad, pad, pad)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFFFFFFFF.toInt())
                setStroke((2 * density).toInt(), 0xFF0C7A4D.toInt())
            }
            elevation = 6 * density
            contentDescription = "Angren Taxi"
        }

        @Suppress("DEPRECATION")
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val params = WindowManager.LayoutParams(
            size, size, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = lastX
            y = lastY
        }

        // Surish — tugma navigator tugmalarini to'smasin; qisqa tegish — ilovaga qaytish.
        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0
        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX; downY = event.rawY
                    startX = params.x; startY = params.y
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = startX + (event.rawX - downX).toInt()
                    params.y = startY + (event.rawY - downY).toInt()
                    lastX = params.x; lastY = params.y
                    wm.updateViewLayout(v, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val moved = abs(event.rawX - downX) > 10 * density ||
                        abs(event.rawY - downY) > 10 * density
                    if (!moved) bringToFront(context)
                    true
                }
                else -> false
            }
        }

        return try {
            wm.addView(view, params)
            bubble = view
            true
        } catch (e: Exception) {
            false
        }
    }

    fun hideBubble(context: Context) {
        val view = bubble ?: return
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        try {
            wm.removeView(view)
        } catch (_: Exception) {
        }
        bubble = null
    }

    /**
     * Zakaz — kiruvchi qo'ng'iroq kabi: ekran o'chiq va telefon qulflangan
     * bo'lsa ham ekran yonadi va taklif qulf ustida ochiladi (full-screen
     * intent), ovoz taklif hal bo'lguncha takrorlanadi (FLAG_INSISTENT).
     *
     * Ilgari oddiy bildirishnoma bir marta "dzin" qilardi, ekran yonmasdi —
     * cho'ntakdagi telefonda 15 soniyalik taklif ko'pincha o'tib ketardi.
     *
     * Android 14+ da USE_FULL_SCREEN_INTENT faqat qo'ng'iroq/budilnik
     * ilovalariga avtomatik beriladi; berilmasa tizim baribir yuqori
     * muhimlikdagi (heads-up) bildirishnoma ko'rsatadi — yiqilmaydi.
     */
    fun showOfferNotification(
        context: Context,
        title: String,
        text: String,
        channelName: String,
        offerId: String? = null,
        timeoutMs: Long = OFFER_TIMEOUT_MS,
    ) {
        if (offerId != null) {
            if (offerId == lastOfferId) return
            lastOfferId = offerId
        }
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.deleteNotificationChannel(LEGACY_CHANNEL_ID)
            val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 600, 400, 600)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            }
            nm.createNotificationChannel(channel)
        }
        val fullScreen = PendingIntent.getActivity(
            context, 1,
            Intent(context, MainActivity::class.java)
                .putExtra(EXTRA_OFFER_ALERT, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
            ),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, CHANNEL_ID)
        } else {
            android.app.Notification.Builder(context)
                .setPriority(android.app.Notification.PRIORITY_HIGH)
                .setDefaults(android.app.Notification.DEFAULT_ALL)
        }
        builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(android.app.Notification.CATEGORY_CALL)
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setFullScreenIntent(fullScreen, true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setTimeoutAfter(timeoutMs)
        }
        val notification = builder.build().apply {
            flags = flags or android.app.Notification.FLAG_INSISTENT
        }
        try {
            nm.notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Bildirishnoma ruxsati yo'q — tayyorlik oynasi buni oldini oladi.
        }
    }

    /**
     * Data-only FCM taklifi jiringlatilsinmi (OfferPushReceiver). Ilova
     * ekranda bo'lsa — taklif ekrani o'zi ochiq; socket allaqachon e'lon
     * qilgan bo'lsa — takror yo'q; muddati o'tgan bo'lsa — kech kelgan push.
     */
    fun shouldRingFromPush(offerId: String?, expiresAtMs: Long?, nowMs: Long): Boolean =
        !appVisible &&
            !offerId.isNullOrEmpty() &&
            offerId != lastOfferId &&
            (expiresAtMs == null || expiresAtMs > nowMs)

    fun cancelOfferNotification(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }
}
