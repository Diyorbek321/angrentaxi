package uz.angren.taxi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Data-only FCM zakaz taklifi → qo'ng'iroqdek jiringlash (DriverOverlay).
 *
 * Nega Dart'ning onBackgroundMessage'i emas: u alohida isolate'da ishlaydi,
 * MainActivity'ning `driver_overlay` kanali u yerda yo'q. Bu yerda esa faqat
 * Context kerak — jarayon o'ldirilgan bo'lsa ham FCM uni uyg'otadi.
 *
 * Faqat haydovchi flavor manifestida e'lon qilingan. Matn backend'da
 * haydovchi tilida tayyorlanadi (data.title / data.body).
 */
class OfferPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val extras = intent.extras ?: return
        if (extras.getString("event") != "new_order_offer") return

        val offerId = extras.getString("orderId")
        val expiresAt = extras.getString("expiresAt")?.toLongOrNull()
        val now = System.currentTimeMillis()
        if (!DriverOverlay.shouldRingFromPush(offerId, expiresAt, now)) return

        val app = context.applicationContext
        DriverOverlay.showOfferNotification(
            app,
            extras.getString("title").orEmpty(),
            extras.getString("body").orEmpty(),
            app.getString(R.string.driver_offer_channel),
            offerId,
            expiresAt?.let { it - now } ?: OFFER_FALLBACK_TIMEOUT_MS,
        )
    }

    private companion object {
        /** Eski backend muddat yubormasa — taklif umri (15 s). */
        const val OFFER_FALLBACK_TIMEOUT_MS = 15_000L
    }
}
