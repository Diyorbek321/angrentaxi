package uz.angren.taxi

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

/**
 * Push bildirishnomalari uchun Android tomoni.
 *
 * 1. Backend (`firebase.service.ts`) har bir push'ni `channelId:
 *    'angren_taxi_orders'` bilan yuboradi. Kanal qurilmada YARATILMAGAN
 *    bo'lsa FCM uni "Miscellaneous" zaxira kanaliga tushiradi — ko'p
 *    qobiqlarda (MIUI, ColorOS) u jim, heads-up'siz kanal. Shu sababli
 *    kanal ilova birinchi ochilishidayoq yaratiladi.
 * 2. Ilova OCHIQ turganda FCM bildirishnomani o'zi ko'rsatmaydi — Dart
 *    `FirebaseMessaging.onMessage` ni oladi va [show] orqali chiqaradi.
 */
object PushNotifications {
    const val ORDERS_CHANNEL_ID = "angren_taxi_orders"
    private var nextId = 2000

    fun ensureChannels(context: Context, name: String, description: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = nm.getNotificationChannel(ORDERS_CHANNEL_ID)
        if (existing != null) {
            // Faqat nom/tavsif yangilanadi (til almashganda). Muhimlikni
            // Android foydalanuvchi tanlovini buzmaslik uchun o'zgartirmaydi.
            existing.name = name
            existing.description = description
            nm.createNotificationChannel(existing)
            return
        }
        val channel = NotificationChannel(
            ORDERS_CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            this.description = description
            enableVibration(true)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build(),
            )
        }
        nm.createNotificationChannel(channel)
    }

    // minSdk 24 — NotificationManager.areNotificationsEnabled() mavjud.
    fun areEnabled(context: Context): Boolean =
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .areNotificationsEnabled()

    fun show(context: Context, title: String, body: String) {
        ensureChannels(context, "Buyurtmalar", "Buyurtma holati")
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
            ),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, ORDERS_CHANNEL_ID)
        } else {
            android.app.Notification.Builder(context)
                .setPriority(android.app.Notification.PRIORITY_HIGH)
                .setDefaults(android.app.Notification.DEFAULT_ALL)
        }
        val notification = builder
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(0xFF0C7A4D.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(nextId++, notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS berilmagan — Dart tomoni ruxsatni so'raydi.
        }
    }
}
