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
    private const val CHANNEL_ID = "driver_offers"
    private const val NOTIFICATION_ID = 4201

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
     * Zaxira: ilovani ochib bo'lmasa ham haydovchi zakazni ESHITSIN.
     * Yuqori muhimlik — ekran tepasida chiqadi; bosilsa ilova ochiladi.
     */
    fun showOfferNotification(context: Context, title: String, text: String, channelName: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                        .build(),
                )
            }
            nm.createNotificationChannel(channel)
        }
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
        val notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setCategory(android.app.Notification.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            nm.notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Bildirishnoma ruxsati yo'q — tayyorlik oynasi buni oldini oladi.
        }
    }

    fun cancelOfferNotification(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }
}
