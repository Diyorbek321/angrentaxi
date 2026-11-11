/// Haydovchi onlayn bo'lishidan oldin tekshiriladigan shartlar.
///
/// Tartib — ekrandagi tartib va BOG'LIQLIK tartibi: GPS o'chiq bo'lsa
/// ruxsat so'rash ma'nosiz, ruxsat bo'lmasa "aniq"lik so'ralmaydi,
/// bildirishnomalar o'chiq bo'lsa zakaz kanalini sozlash ma'nosiz.
enum ReadinessItem {
  gps,
  location,
  preciseLocation,
  notifications,

  /// Zakaz bildirishnomasi kanali (`driver_offers_ring`) jim qilinmagan.
  /// Ilova bildirishnomalari yoqilgan, lekin shu kanal "jim"/o'chiq bo'lsa,
  /// fonda kelgan taklif ovozsiz o'tib ketadi.
  offerAlerts,

  /// Android 14+: qulflangan telefonda taklif ekranni yoqib ochiladi
  /// (full-screen intent). Play'dan o'rnatilgan taksi ilovasiga bu ruxsat
  /// avtomatik BERILMAYDI.
  fullScreen,
  overlay,

  /// Xiaomi/Oppo/Vivo/Huawei: "Avtozapusk" o'chiq bo'lsa, ilova
  /// yopilganda tizim uni push bilan ham uyg'otmaydi.
  autostart,
  battery,
}

/// Bir lahzadagi holat. Sof ma'lumot — test va UI ikkalasi ham shundan.
class DriverReadiness {
  const DriverReadiness(
    this._ok, {
    this.xiaomiFamily = false,
    this.hidden = const {},
    this.autostartUnverifiable = false,
  });

  final Map<ReadinessItem, bool> _ok;

  /// Xiaomi/Redmi/POCO — "ustida ko'rsatish" bandiga MIUI'ning qo'shimcha
  /// ruxsati haqida ko'rsatma qo'shiladi (uni dasturdan tekshirib bo'lmaydi).
  final bool xiaomiFamily;

  /// Bu telefonda ma'nosi yo'q bandlar (masalan, Samsung'da "Avtozapusk"
  /// sahifasi yo'q) — ekranda ko'rsatilmaydi va bajarilgan hisoblanadi.
  final Set<ReadinessItem> hidden;

  /// Autostart holatini telefon aytmaydi (Xiaomi'dan boshqa OEM'lar) —
  /// "bajarildi" belgisi faqat haydovchi sozlamani ochib qaytganini bildiradi.
  final bool autostartUnverifiable;

  /// ⚠️ ONLAYN BO'LISHNI TO'SADIGANLAR. "Ustida ko'rsatish" ham YO'Q:
  /// ruxsatsiz zakaz baribir keladi (ovozli bildirishnoma bilan), faqat
  /// ilova o'zi ochilmaydi. Batareya, full-screen va autostart ham YO'Q:
  /// ularsiz taklif kechikishi yoki qulf ustida ochilmasligi mumkin, lekin
  /// keladi; ishlab chiqaruvchilarning "tejamkor" rejimlarini esa ishonchli
  /// tekshirib bo'lmaydi — haydovchini butunlay to'xtatib qo'yish adolatsiz.
  ///
  /// Zakaz kanali ESA TO'SADI: u jim bo'lsa fonda kelgan taklif umuman
  /// eshitilmaydi — bu bildirishnomalar o'chiqligi bilan bir xil natija.
  static const Set<ReadinessItem> blocking = {
    ReadinessItem.gps,
    ReadinessItem.location,
    ReadinessItem.preciseLocation,
    ReadinessItem.notifications,
    ReadinessItem.offerAlerts,
  };

  bool isOk(ReadinessItem item) => hidden.contains(item) || (_ok[item] ?? false);

  bool isVisible(ReadinessItem item) => !hidden.contains(item);

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
      case ReadinessItem.offerAlerts:
        // Ilova bildirishnomalari o'chiq bo'lsa kanal sahifasi ham "o'chiq"
        // ko'rsatadi — avval umumiy ruxsat.
        return isOk(ReadinessItem.notifications);
      case ReadinessItem.notifications:
      case ReadinessItem.fullScreen:
      case ReadinessItem.overlay:
      case ReadinessItem.autostart:
      case ReadinessItem.battery:
        return true;
    }
  }
}

/// Native tomon qaytaradigan autostart holati (`DriverOverlay.autostartStatus`).
enum AutostartStatus {
  /// Telefonda autostart boshqaruvi yo'q (Samsung, Pixel, ...).
  notApplicable,
  allowed,
  denied,

  /// Boshqaruv bor, lekin holatini o'qib bo'lmaydi.
  unknown;

  static AutostartStatus parse(String? raw) => AutostartStatus.values.firstWhere(
        (s) => s.name == raw,
        // Eski native / iOS / test — band ko'rsatilmaydi.
        orElse: () => AutostartStatus.notApplicable,
      );
}

/// Autostart bandi bajarilganmi. Holat noma'lum bo'lsa — haydovchi
/// sozlamani bir marta ochib qaytgani yetarli (boshqa tekshirish yo'li
/// yo'q; aks holda band hech qachon yashil bo'lmay, oyna har kuni chiqardi).
/// Aniq "o'chiq" deb o'qilgan bo'lsa — ochib qaytgani hisobga olinmaydi.
bool autostartOk(AutostartStatus status, {required bool visited}) => switch (status) {
      AutostartStatus.notApplicable || AutostartStatus.allowed => true,
      AutostartStatus.denied => false,
      AutostartStatus.unknown => visited,
    };
