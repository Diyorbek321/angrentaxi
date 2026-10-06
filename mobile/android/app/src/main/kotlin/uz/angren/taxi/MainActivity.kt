package uz.angren.taxi

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
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
