package uz.angren.taxi

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.provider.Settings
import io.flutter.plugin.common.MethodChannel
import android.content.Intent

class MainActivity : FlutterActivity() {
    private var pushChannel: MethodChannel? = null

    /** Ilova ochiq turganda chiqqan bildirishnoma bosildi → Dart (`tapped`). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        takePushData(intent)?.let { pushChannel?.invokeMethod("tapped", it) }
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
                        )
                        result.success(null)
                    }
                    "cancelOfferNotification" -> {
                        DriverOverlay.cancelOfferNotification(ctx); result.success(null)
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
