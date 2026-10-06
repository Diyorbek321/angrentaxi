/// Haydovchi onlayn bo'lishidan oldin tekshiriladigan shartlar.
///
/// Tartib — ekrandagi tartib va BOG'LIQLIK tartibi: GPS o'chiq bo'lsa
/// ruxsat so'rash ma'nosiz, ruxsat bo'lmasa "aniq"lik so'ralmaydi.
enum ReadinessItem { gps, location, preciseLocation, notifications, battery }

/// Bir lahzadagi holat. Sof ma'lumot — test va UI ikkalasi ham shundan.
class DriverReadiness {
  const DriverReadiness(this._ok);

  final Map<ReadinessItem, bool> _ok;

  /// ⚠️ ONLAYN BO'LISHNI TO'SADIGANLAR. Batareya bu ro'yxatda YO'Q: uni
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
      case ReadinessItem.battery:
        return true;
    }
  }
}
