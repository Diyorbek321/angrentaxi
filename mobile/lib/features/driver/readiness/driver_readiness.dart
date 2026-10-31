/// Haydovchi onlayn bo'lishidan oldin tekshiriladigan shartlar.
///
/// Tartib — ekrandagi tartib va BOG'LIQLIK tartibi: GPS o'chiq bo'lsa
/// ruxsat so'rash ma'nosiz, ruxsat bo'lmasa "aniq"lik so'ralmaydi.
enum ReadinessItem { gps, location, preciseLocation, notifications, overlay, battery }

/// Bir lahzadagi holat. Sof ma'lumot — test va UI ikkalasi ham shundan.
class DriverReadiness {
  const DriverReadiness(this._ok, {this.xiaomiFamily = false});

  final Map<ReadinessItem, bool> _ok;

  /// Xiaomi/Redmi/POCO — "ustida ko'rsatish" bandiga MIUI'ning qo'shimcha
  /// ruxsati haqida ko'rsatma qo'shiladi (uni dasturdan tekshirib bo'lmaydi).
  final bool xiaomiFamily;

  /// ⚠️ ONLAYN BO'LISHNI TO'SADIGANLAR. "Ustida ko'rsatish" ham YO'Q:
  /// ruxsatsiz zakaz baribir keladi (ovozli bildirishnoma bilan), faqat
  /// ilova o'zi ochilmaydi. Batareya ham YO'Q: uni
  /// tekshirish ishonchsiz (ishlab chiqaruvchilarning o'z "tejamkor"
  /// rejimlari Android API'siga ko'rinmaydi), ya'ni "bajarilmagan" deb
  /// ko'rsatilgan haydovchini butunlay to'xtatib qo'yish adolatsiz bo'lardi.
  static const Set<ReadinessItem> blocking = {
    ReadinessItem.gps,
    ReadinessItem.location,
    ReadinessItem.preciseLocation,
    ReadinessItem.notifications,
  };

  bool isOk(ReadinessItem item) => _ok[item] ?? false;

  bool get canGoOnline => blocking.every(isOk);

  /// Hammasi joyida (tavsiyalar ham) — tekshiruv oynasini ko'rsatmasdan
  /// darhol onlayn bo'lish mumkin.
  bool get isComplete => ReadinessItem.values.every(isOk);

  /// Oldingi qadam bajarilmagan bo'lsa, keyingisini "tuzatish" tugmasi
  /// ko'rsatilmaydi: GPS o'chiq turganda ruxsat so'rash xato beradi.
  bool canFix(ReadinessItem item) {
    switch (item) {
      case ReadinessItem.gps:
        return true;
      case ReadinessItem.location:
        return isOk(ReadinessItem.gps);
      case ReadinessItem.preciseLocation:
        return isOk(ReadinessItem.gps) && isOk(ReadinessItem.location);
      case ReadinessItem.notifications:
      case ReadinessItem.overlay:
      case ReadinessItem.battery:
        return true;
    }
  }
}
