package uz.angren.taxi

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.provider.Settings
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
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
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "uz.angren.taxi/push")
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
                        )
                        result.success(null)
                    }
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
