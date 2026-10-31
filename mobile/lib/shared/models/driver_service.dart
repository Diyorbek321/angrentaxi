import 'package:equatable/equatable.dart';

// ============================================================================
// HAYDOVCHI XIZMAT TURLARI — `GET/PATCH /drivers/me/services` kontrakti.
//
// ⚠️ ARXITEKTURA QARORI: RO'YXAT SERVERDAN KELADI (tekshiruv ekranidagi
// naqshning aynan o'zi — shared/models/driver_verification.dart ga qarang).
//
// Bu yerda `taxi`/`food`/`market` uchun QATTIQ KODLANGAN nom yoki izoh
// YO'Q va bo'lmaydi ham: yangi vertikal (masalan `pharmacy`) qo'shilganda
// mobil kod O'ZGARMASLIGI va yangi APK kerak bo'lmasligi shart.
//
//   · `serviceType`  — enum EMAS, erkin satr (barqaror kalit);
//   · `label`/`description` — SERVERDAN, mobil tomonda tarjima jadvali YO'Q;
//   · `blockedReason` — o'zbekcha tayyor matn, serverdan;
//   · `missingRequirements` — TEKSHIRUV tizimidagi `code` qiymatlari.
// ============================================================================

/// Bitta xizmat turi: haydovchi uni yoqishi mumkinmi va nega mumkin emas.
class DriverServiceOption extends Equatable {
  const DriverServiceOption({
    required this.serviceType,
    required this.label,
    this.description,
    this.enabled = false,
    this.canEnable = true,
    this.blockedReason,
    this.missingRequirements = const [],
  });

  /// Barqaror kalit — PATCH tanasida aynan shu qiymat yuboriladi.
  final String serviceType;

  /// Ekrandagi nom. SERVER beradi.
  final String label;

  /// Bir qatorlik izoh ("Restorandan mijozga"). SERVER beradi.
  final String? description;

  /// Hozir yoqilganmi.
  final bool enabled;

  /// Yoqish mumkinmi. `false` bo'lsa [blockedReason] to'ldirilgan bo'ladi.
  final bool canEnable;

  /// Nega yoqib bo'lmaydi — o'zbekcha matn, serverdan.
  final String? blockedReason;

  /// Qaysi tekshiruv talablari bajarilmagan (`code` qiymatlari).
  ///
  /// Bu kodlar uchun mobil tomonda nom jadvali YO'Q — ular tekshiruv
  /// ro'yxatidagi server bergan yorliqlar bilan solishtiriladi
  /// (driver_services_screen.dart), topilmasa umuman ko'rsatilmaydi.
  final List<String> missingRequirements;

  factory DriverServiceOption.fromJson(Map<String, dynamic> json) {
    final serviceType = (json['serviceType'] as String?)?.trim() ?? '';
    final label = (json['label'] as String?)?.trim();
    final description = (json['description'] as String?)?.trim();
    final blockedReason = (json['blockedReason'] as String?)?.trim();
    final rawRequirements = json['missingRequirements'];

    return DriverServiceOption(
      serviceType: serviceType,
      // Server yorliq bermasa kalitning o'zi ko'rsatiladi: noto'g'ri nom
      // taxmin qilishdan ko'ra xom qiymatni ko'rsatgan afzal.
      label: (label == null || label.isEmpty) ? serviceType : label,
      description:
          (description == null || description.isEmpty) ? null : description,
      enabled: (json['enabled'] as bool?) ?? false,
      // ⚠️ Maydon kelmasa YOQISHGA RUXSAT beriladi. Mijoz tomonda
      // "bilmayman" ni "mumkin emas" deb talqin qilish haydovchini bekorga
      // to'sib qo'yardi; haqiqiy cheklovni PATCH baribir 400 bilan qaytaradi.
      canEnable: (json['canEnable'] as bool?) ?? true,
      blockedReason:
          (blockedReason == null || blockedReason.isEmpty) ? null : blockedReason,
      missingRequirements: rawRequirements is List
          ? rawRequirements
              .whereType<String>()
              .map((code) => code.trim())
              .where((code) => code.isNotEmpty)
              .toList(growable: false)
          : const [],
    );
  }

  DriverServiceOption copyWith({bool? enabled}) => DriverServiceOption(
        serviceType: serviceType,
        label: label,
        description: description,
        enabled: enabled ?? this.enabled,
        canEnable: canEnable,
        blockedReason: blockedReason,
        missingRequirements: missingRequirements,
      );

  /// Haydovchi bu turni HOZIR o'zgartira oladimi.
  ///
  /// ⚠️ Yoqilgan turni O'CHIRISH har doim mumkin — hatto talablari
  /// buzilgan bo'lsa ham. Aks holda hujjati muddati o'tgan haydovchi
  /// bajarolmaydigan buyurtmalarni olishda davom etardi va uni to'xtata
  /// olmasdi (bosh ekrandagi "Offline bo'lish" tugmasi bilan bir mantiq).
  bool get isInteractive => canEnable || enabled;

  @override
  List<Object?> get props => [
        serviceType,
        label,
        description,
        enabled,
        canEnable,
        blockedReason,
        missingRequirements,
      ];
}

/// `GET /drivers/me/services` javobining to'liq shakli.
class DriverServices extends Equatable {
  const DriverServices({required this.enabled, required this.options});

  /// Hali hech narsa yuklanmagan holat.
  static const DriverServices empty =
      DriverServices(enabled: [], options: []);

  /// Hozir yoqilgan turlar kalitlari.
  final List<String> enabled;

  /// Ko'rsatiladigan to'liq ro'yxat (yoqilgani ham, bloklangani ham).
  final List<DriverServiceOption> options;

  factory DriverServices.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final rawEnabled = json['enabled'];

    final options = rawOptions is List
        ? rawOptions
            .whereType<Map<String, dynamic>>()
            .map(DriverServiceOption.fromJson)
            // Kalitsiz element bilan hech narsa qilib bo'lmaydi — PATCH
            // tanasiga qo'yib bo'lmaydi, shuning uchun tashlab yuboriladi.
            .where((option) => option.serviceType.isNotEmpty)
            .toList(growable: false)
        : const <DriverServiceOption>[];

    return DriverServices(
      // `enabled` ro'yxati kelmasa elementlarning o'z holatidan yig'iladi —
      // ikkala manba ham bir xil haqiqatni aytadi.
      enabled: rawEnabled is List
          ? rawEnabled
              .whereType<String>()
              .map((type) => type.trim())
              .where((type) => type.isNotEmpty)
              .toList(growable: false)
          : options
              .where((option) => option.enabled)
              .map((option) => option.serviceType)
              .toList(growable: false),
      options: options,
    );
  }

  /// Ro'yxat bo'sh — server hech qanday tur taklif qilmadi.
  bool get isEmpty => options.isEmpty;

  /// Hozir yoqilgan turlarning server bergan nomlari.
  List<String> get enabledLabels => options
      .where((option) => option.enabled)
      .map((option) => option.label)
      .toList(growable: false);

  @override
  List<Object?> get props => [enabled, options];
}
