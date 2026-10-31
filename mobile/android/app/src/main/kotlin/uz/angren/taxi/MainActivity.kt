package uz.angren.taxi

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.provider.Settings
import io.flutter.plugin.common.MethodChannel
import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

class MainActivity : FlutterActivity() {
    private var pushChannel: MethodChannel? = null

    /** Ilova taklif uchun qulf ustida ko'rsatilyaptimi ([releaseLockScreen]). */
    private var shownOverLock = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreenIfOffer(intent)
    }

    override fun onResume() {
        super.onResume()
        DriverOverlay.appVisible = true
    }

    override fun onPause() {
        DriverOverlay.appVisible = false
        super.onPause()
    }

    /** Ilova ochiq turganda chiqqan bildirishnoma bosildi → Dart (`tapped`). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        showOverLockScreenIfOffer(intent)
        takePushData(intent)?.let { pushChannel?.invokeMethod("tapped", it) }
    }

    /**
     * Zakaz bildirishnomasining full-screen intent'i (DriverOverlay) —
     * ekranni yoqib, taklifni qulf USTIDA ko'rsatadi. Faqat shu holatda:
     * ilova odatda qulf ostida yashirin qoladi.
     */
    private fun showOverLockScreenIfOffer(intent: Intent?) {
        if (intent?.getBooleanExtra(DriverOverlay.EXTRA_OFFER_ALERT, false) != true) return
        intent.removeExtra(DriverOverlay.EXTRA_OFFER_ALERT)
        shownOverLock = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
    }

    /**
     * Taklif hal bo'ldi: qulf ustida ko'rsatish to'xtaydi. Telefon hali
     * qulflangan bo'lsa avval qulfni ochish so'raladi (safar ilovada davom
     * etadi); bekor qilinsa — ilova qulf ostiga qaytadi.
     */
    private fun releaseLockScreen() {
        // Faqat O'ZIMIZ qulf ustiga chiqqan bo'lsak. Dart buni taklif topilmagan
        // har holatda chaqira oladi (push bosildi, lekin taklif allaqachon
        // tugagan) — bayroqsiz oddiy qulflangan telefonda qulf ochish so'ralardi.
        if (!shownOverLock) return
        shownOverLock = false
        val keyguard = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
        val clear = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(false)
                setTurnScreenOn(false)
            } else {
                @Suppress("DEPRECATION")
                window.clearFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
                )
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(
                this,
                object : KeyguardManager.KeyguardDismissCallback() {
                    override fun onDismissSucceeded() = clear()
                    override fun onDismissCancelled() = clear()
                    override fun onDismissError() = clear()
                },
            )
        } else {
            clear()
        }
    }

    /** Bir marta o'qiladi: ekran burilganda yoki qayta ochilganda takrorlanmasin. */
    private fun takePushData(intent: Intent?): String? {
        val data = intent?.getStringExtra(PushNotifications.EXTRA_PUSH_DATA) ?: return null
        intent.removeExtra(PushNotifications.EXTRA_PUSH_DATA)
        return data
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Kanal nomi Dart tomonida: lib/core/platform/driver_overlay.dart
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/driver_overlay")
            .setMethodCallHandler { call, result ->
                val ctx = applicationContext
                when (call.method) {
                    "canDrawOverlays" -> result.success(DriverOverlay.canDrawOverlays(ctx))
                    "openOverlaySettings" -> {
                        DriverOverlay.openOverlaySettings(ctx); result.success(null)
                    }
                    "isXiaomiFamily" -> result.success(DriverOverlay.isXiaomiFamily())
                    "showBubble" -> result.success(DriverOverlay.showBubble(ctx))
                    "hideBubble" -> {
                        DriverOverlay.hideBubble(ctx); result.success(null)
                    }
                    "bringToFront" -> result.success(DriverOverlay.bringToFront(ctx))
                    "showOfferNotification" -> {
                        DriverOverlay.showOfferNotification(
                            ctx,
                            call.argument<String>("title") ?: "",
                            call.argument<String>("text") ?: "",
                            call.argument<String>("channel") ?: "",
                            call.argument<String>("offerId"),
                            // Dart taklifning QOLGAN umrini beradi; eski
                            // chaqiruvlarda yo'q — standart 30 s.
                            call.argument<Number>("timeoutMs")?.toLong()
                                ?.takeIf { it > 0 } ?: DriverOverlay.DEFAULT_OFFER_TIMEOUT_MS,
                        )
                        result.success(null)
                    }
                    "playOfferSound" -> {
                        DriverOverlay.playOfferSound(ctx); result.success(null)
                    }
                    "cancelOfferNotification" -> {
                        DriverOverlay.cancelOfferNotification(ctx); result.success(null)
                    }
                    "releaseLockScreen" -> {
                        releaseLockScreen(); result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }

        // Push kanali ILOVA OCHILISHIDA yaratiladi — fonda kelgan push ham
        // backend ko'rsatgan `angren_taxi_orders` kanaliga tushsin.
        // Dart tomoni keyin tilga mos nom bilan yangilaydi.
        PushNotifications.ensureChannels(applicationContext, "Buyurtmalar", "Buyurtma holati")

        // Bildirishnomalar — lib/core/push/push_notifications.dart
        pushChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/push")
        pushChannel!!
            .setMethodCallHandler { call, result ->
                val ctx = applicationContext
                when (call.method) {
                    "ensureChannels" -> {
                        PushNotifications.ensureChannels(
                            ctx,
                            call.argument<String>("name") ?: "Buyurtmalar",
                            call.argument<String>("description") ?: "",
                        )
                        result.success(null)
                    }
                    "areEnabled" -> result.success(PushNotifications.areEnabled(ctx))
                    "show" -> {
                        PushNotifications.show(
                            ctx,
                            call.argument<String>("title") ?: "",
                            call.argument<String>("body") ?: "",
                            call.argument<Map<String, String>>("data") ?: emptyMap(),
                        )
                        result.success(null)
                    }
                    // Sovuq start shu bildirishnoma bosilib bo'lgan bo'lsa.
                    "takeLaunchTap" -> result.success(takePushData(intent))
                    else -> result.notImplemented()
                }
            }

        // Qurilma identifikatori — lib/core/platform/device_identity.dart
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/device")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "deviceId" -> result.success(
                        Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
                    )
                    else -> result.notImplemented()
                }
            }

        // Maxfiy ekranlar (OTP, to'lov, KYC) — lib/core/platform/secure_screen.dart
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/secure")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setSecure" -> {
                        if (call.argument<Boolean>("secure") == true) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }

        // Navigatsiya ovoz bo'laklari — lib/core/location/voice_clip_player.dart
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/voice")
            .setMethodCallHandler { call, result ->
                val ctx = applicationContext
                when (call.method) {
                    "play" -> result.success(
                        VoicePlayer.play(ctx, call.argument<List<String>>("assets") ?: emptyList()),
                    )
                    "stop" -> {
                        VoicePlayer.stop(ctx); result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
