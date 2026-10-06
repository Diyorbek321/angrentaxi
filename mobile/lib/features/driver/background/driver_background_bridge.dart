import 'package:angren_taxi/core/platform/driver_overlay.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/widgets.dart';

/// Zakaz bildirishnomasining matni (foydalanuvchi tilida).
typedef OfferNotice = ({String title, String text, String channel});

/// Onlayn haydovchi ilovadan chiqqanda nima bo'lishini hal qiladi.
///
///  · fonga o'tdi va onlayn → suzuvchi tugma (Android 15 da ilovani ekranga
///    chiqarish uchun ko'rinib turgan oyna SHART, haydovchiga esa qaytish yo'li);
///  · fonda turganda YANGI zakaz → ilova o'zini ekranga chiqaradi VA ovozli
///    bildirishnoma chiqadi. Ikkalasi ham, chunki Android chiqarishni JIM rad
///    etishi mumkin (ruxsat yo'q, MIUI) — shunda ham haydovchi eshitsin;
///  · ilovaga qaytdi → tugma va bildirishnoma yo'qoladi (taklif ekrani ochiq).
///
/// Sof mantiq: platforma [DriverOverlay] orqali, holat — funksiyalar orqali,
/// ya'ni plaginsiz to'liq testlanadi.
class DriverBackgroundBridge {
  DriverBackgroundBridge({
    required this.overlay,
    required this.isOnline,
    required this.pendingOffer,
    required this.noticeFor,
  });

  final DriverOverlay overlay;
  final bool Function() isOnline;
  final Order? Function() pendingOffer;
  final OfferNotice Function(Order offer) noticeFor;

  bool _inBackground = false;
  String? _announcedOfferId;

  bool get inBackground => _inBackground;

  Future<void> onLifecycle(AppLifecycleState state) async {
    switch (state) {
      case AppLifecycleState.resumed:
        _inBackground = false;
        await overlay.hideBubble();
        await overlay.cancelOfferNotification();
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        if (_inBackground) return;
        _inBackground = true;
        if (isOnline()) await overlay.showBubble();
      // `inactive` — bildirishnoma pardasi tushirildi, qo'ng'iroq dialogi:
      // ilova hali ekranda, hech narsa qilinmaydi.
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  /// [DriverProvider] har o'zgarganda.
  Future<void> onDriverChanged() async {
    if (!isOnline()) {
      await overlay.hideBubble();
    } else if (_inBackground) {
      // Fonda turganda onlayn bo'ldi (masalan, holat tiklandi) — tugma kerak.
      await overlay.showBubble();
    }

    final offer = pendingOffer();
    if (offer == null) {
      _announcedOfferId = null;
      return;
    }
    // Provider bitta taklif uchun bir necha marta xabar beradi — e'lon bir marta.
    if (offer.id == _announcedOfferId) return;
    _announcedOfferId = offer.id;
    if (!_inBackground) return; // ekranda — taklif ekrani o'zi ochiladi

    await overlay.bringToFront();
    final notice = noticeFor(offer);
    await overlay.showOfferNotification(
      title: notice.title,
      text: notice.text,
      channel: notice.channel,
    );
  }
}
