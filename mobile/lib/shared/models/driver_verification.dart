import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// HAYDOVCHI TEKSHIRUVI — `GET /drivers/me/verification` kontrakti.
//
// ⚠️ ARXITEKTURA QARORI: TALABLAR RO'YXATI SERVERDAN KELADI.
//
// Bu yerda hujjat turlarining QATTIQ KODLANGAN ro'yxati YO'Q va bo'lmaydi
// ham (eski naqsh uchun driver_onboarding_screen.dart dagi
// `_kDriverDocumentTypes` ga qarang). Sabab: transport turi bo'yicha qanday
// tekshiruv kerakligi biznes qarori bo'lib, u tez-tez o'zgaradi. Agar
// ro'yxat ilovada tursa, har o'zgarishda YANGI APK chiqarish kerak bo'ladi.
//
// Shuning uchun:
//   · `code`         — enum EMAS, erkin satr;
//   · `label`/`hint` — serverdan keladi, mobil tomonda tarjima jadvali YO'Q;
//   · yangi talab    — bazaga qator qo'shish, mobil kod O'ZGARMAYDI.
// ============================================================================

/// Bitta tekshiruv elementining holati.
///
/// ⚠️ `unknown` — MIJOZ TOMONIDAGI ZAXIRA, server hech qachon yubormaydi.
/// Server kelajakda yangi holat qo'shsa (masalan `grace_period`), eski
/// APK YIQILMASLIGI kerak: noma'lum holat "e'tibor talab qiladi" deb
/// ko'rsatiladi, LEKIN o'zi hech narsani bloklamaydi — onlayn bo'lish
/// qarorini faqat server beradi (`canGoOnline`).
enum DriverVerificationStatus {
  ok,
  dueSoon,
  overdue,
  pendingReview,
  rejected,
  missing,
  unknown,
}

DriverVerificationStatus _statusFromApi(String? value) {
  switch (value) {
    case 'ok':
      return DriverVerificationStatus.ok;
    case 'due_soon':
      return DriverVerificationStatus.dueSoon;
    case 'overdue':
      return DriverVerificationStatus.overdue;
    case 'pending_review':
      return DriverVerificationStatus.pendingReview;
    case 'rejected':
      return DriverVerificationStatus.rejected;
    case 'missing':
      return DriverVerificationStatus.missing;
    default:
      return DriverVerificationStatus.unknown;
  }
}

/// Element turi — FAQAT ikonka tanlash uchun ishlatiladi.
///
/// Noma'lum qiymat `document` ga tushadi: ikonka ma'no tashimaydi (yonida
/// serverning o'z yorlig'i turadi), shuning uchun bu yerda xato qilish
/// xavfsiz.
enum DriverVerificationKind { document, vehiclePhoto }

DriverVerificationKind _kindFromApi(String? value) =>
    value == 'vehicle_photo'
        ? DriverVerificationKind.vehiclePhoto
        : DriverVerificationKind.document;

/// Serverdan kelgan bitta talab: hujjat yoki avtomobil surati.
class DriverVerificationItem extends Equatable {
  const DriverVerificationItem({
    required this.code,
    required this.label,
    required this.kind,
    required this.status,
    this.hint,
    this.validUntil,
    this.daysLeft,
    this.rejectionReason,
    this.isRequired = true,
  });

  /// Barqaror identifikator — yuklash manzilida ishlatiladi
  /// (`POST /drivers/me/verification/:code`). Erkin satr.
  final String code;

  /// Ekranda ko'rinadigan nom. SERVER beradi — bu yerda tarjima yo'q.
  final String label;

  /// Qo'shimcha ko'rsatma ("Davlat raqami ko'rinsin"). Bo'lmasligi mumkin.
  final String? hint;

  final DriverVerificationKind kind;
  final DriverVerificationStatus status;

  /// Amal qilish muddati; muddatsiz talablar uchun `null`.
  final DateTime? validUntil;

  /// Muddatgacha qolgan kunlar. MANFIY qiymat kechikkanni bildiradi.
  final int? daysLeft;

  /// `status == rejected` bo'lganda menejer yozgan sabab.
  final String? rejectionReason;

  /// Majburiymi. Majburiy bo'lmagan element ham ro'yxatda turadi, lekin
  /// haydovchini bloklamaydi.
  final bool isRequired;

  factory DriverVerificationItem.fromJson(Map<String, dynamic> json) {
    final code = (json['code'] as String?)?.trim() ?? '';
    final label = (json['label'] as String?)?.trim();
    final hint = (json['hint'] as String?)?.trim();
    final rejectionReason = (json['rejectionReason'] as String?)?.trim();
    final rawValidUntil = json['validUntil'] as String?;

    return DriverVerificationItem(
      code: code,
      // Server yorliq bermasa `code` ning o'zi ko'rsatiladi. Mobil tomonda
      // "qaysi kod qanday nomlanadi" jadvali YO'Q — taxmin qilish
      // arxitektura qarorini buzadi va noto'g'ri nom chiqarishdan ko'ra
      // xom kodni ko'rsatgan afzal.
      label: (label == null || label.isEmpty) ? code : label,
      hint: (hint == null || hint.isEmpty) ? null : hint,
      kind: _kindFromApi(json['kind'] as String?),
      status: _statusFromApi(json['status'] as String?),
      // `tryParse` — buzuq sana butun ro'yxatni yiqitmasligi kerak.
      validUntil: rawValidUntil == null ? null : DateTime.tryParse(rawValidUntil),
      daysLeft: (json['daysLeft'] as num?)?.round(),
      rejectionReason:
          (rejectionReason == null || rejectionReason.isEmpty)
              ? null
              : rejectionReason,
      isRequired: (json['isRequired'] as bool?) ?? true,
    );
  }

  /// "12 kun qoldi" / "5 kun kechikkan" / "Bugun tugaydi".
  ///
  /// Muddat bo'lmagan talablarda (masalan avtomobil surati) `null` —
  /// ekranda umuman qator chiqmaydi.
  String? get deadlineText {
    final days = daysLeft;
    if (days == null) return null;
    if (days < 0) return '${-days} kun kechikkan';
    if (days == 0) return 'Bugun tugaydi';
    return '$days kun qoldi';
  }

  @override
  List<Object?> get props => [
        code,
        label,
        hint,
        kind,
        status,
        validUntil,
        daysLeft,
        rejectionReason,
        isRequired,
      ];
}

/// `GET /drivers/me/verification` javobining to'liq shakli.
class DriverVerification extends Equatable {
  const DriverVerification({
    required this.canGoOnline,
    required this.items,
    this.blockedReason,
  });

  /// Boshlang'ich qiymat: hali hech narsa yuklanmagan.
  ///
  /// `canGoOnline` ATAYLAB `true` — ma'lumot kelmaguncha haydovchini
  /// bloklamaymiz. Haqiqiy cheklovni server `PATCH /drivers/status` da
  /// baribir qo'llaydi; mijoz tomonda "bilmayman" ni "mumkin emas" deb
  /// talqin qilish ishlayotgan haydovchini bekordan-bekor to'xtatardi.
  static const DriverVerification unrestricted = DriverVerification(
    canGoOnline: true,
    items: [],
  );

  final bool canGoOnline;

  /// Nega onlayn bo'lib bo'lmasligi — O'ZBEKCHA MATN, serverdan keladi.
  final String? blockedReason;

  final List<DriverVerificationItem> items;

  factory DriverVerification.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final reason = (json['blockedReason'] as String?)?.trim();
    return DriverVerification(
      // Maydon yo'q bo'lsa bloklamaymiz — yuqoridagi `unrestricted` izohi.
      canGoOnline: (json['canGoOnline'] as bool?) ?? true,
      blockedReason: (reason == null || reason.isEmpty) ? null : reason,
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(DriverVerificationItem.fromJson)
              // Kodsiz element bilan hech narsa qilib bo'lmaydi (yuklash
              // manzili qurilmaydi), shuning uchun tashlab yuboriladi.
              .where((item) => item.code.isNotEmpty)
              .toList(growable: false)
          : const [],
    );
  }

  /// Muddati tugayotgan elementlar bor — OGOHLANTIRISH, bloklamaydi.
  bool get hasDueSoon =>
      items.any((item) => item.status == DriverVerificationStatus.dueSoon);

  /// Haydovchi biror ish qilishi kerak bo'lgan elementlar soni.
  int get actionNeededCount =>
      items.where((item) => item.status.needsAction).length;

  /// Ro'yxat bo'sh — bu NORMAL holat (hech qanday talab yo'q), xato emas.
  bool get isEmpty => items.isEmpty;

  /// Bitta elementni almashtiradi (yuklashdan keyin server qaytargan yangi
  /// holat bilan). Tartib saqlanadi — ro'yxat ekranda sakramasin.
  DriverVerification withItem(DriverVerificationItem updated) {
    final replaced = items.any((item) => item.code == updated.code);
    return DriverVerification(
      canGoOnline: canGoOnline,
      blockedReason: blockedReason,
      items: [
        for (final item in items)
          if (item.code == updated.code) updated else item,
        if (!replaced) updated,
      ],
    );
  }

  @override
  List<Object?> get props => [canGoOnline, blockedReason, items];
}

/// Holatning ekrandagi ko'rinishi.
///
/// ⚠️ WCAG 1.4.1: holat HECH QACHON faqat rang bilan berilmaydi — har bir
/// holat MATN + IKONKA + rang uchligini birga tashiydi.
extension DriverVerificationStatusPresentation on DriverVerificationStatus {
  String get label => switch (this) {
        DriverVerificationStatus.ok => 'Yaroqli',
        DriverVerificationStatus.dueSoon => 'Muddati tugayapti',
        DriverVerificationStatus.overdue => "Muddati o'tgan",
        DriverVerificationStatus.pendingReview => 'Tekshirilmoqda',
        DriverVerificationStatus.rejected => 'Rad etilgan',
        DriverVerificationStatus.missing => 'Yuklanmagan',
        // Noma'lum holat — nima bo'lganini aytolmaymiz, lekin haydovchini
        // "hammasi joyida" deb aldab ham qo'yolmaymiz.
        DriverVerificationStatus.unknown => "E'tibor talab qiladi",
      };

  AppStatusTone get tone => switch (this) {
        DriverVerificationStatus.ok => AppStatusTone.success,
        DriverVerificationStatus.dueSoon => AppStatusTone.warning,
        DriverVerificationStatus.overdue => AppStatusTone.danger,
        DriverVerificationStatus.pendingReview => AppStatusTone.info,
        DriverVerificationStatus.rejected => AppStatusTone.danger,
        DriverVerificationStatus.missing => AppStatusTone.neutral,
        DriverVerificationStatus.unknown => AppStatusTone.warning,
      };

  IconData get icon => switch (this) {
        DriverVerificationStatus.ok => Icons.check_circle_rounded,
        DriverVerificationStatus.dueSoon => Icons.schedule_rounded,
        DriverVerificationStatus.overdue => Icons.event_busy_rounded,
        DriverVerificationStatus.pendingReview => Icons.hourglass_top_rounded,
        DriverVerificationStatus.rejected => Icons.cancel_rounded,
        DriverVerificationStatus.missing => Icons.add_a_photo_outlined,
        DriverVerificationStatus.unknown => Icons.help_outline_rounded,
      };

  /// Haydovchi bu element bilan biror ish qilishi kerakmi.
  ///
  /// `pendingReview` — YO'Q: fayl allaqachon yuborilgan, endi navbat
  /// menejerda. `unknown` ham YO'Q: nima qilish kerakligini bilmaymiz,
  /// shuning uchun haydovchini bekorga ishga solmaymiz.
  bool get needsAction => switch (this) {
        DriverVerificationStatus.dueSoon ||
        DriverVerificationStatus.overdue ||
        DriverVerificationStatus.rejected ||
        DriverVerificationStatus.missing =>
          true,
        DriverVerificationStatus.ok ||
        DriverVerificationStatus.pendingReview ||
        DriverVerificationStatus.unknown =>
          false,
      };
}

/// Element turining dekorativ ikonasi.
extension DriverVerificationKindPresentation on DriverVerificationKind {
  IconData get icon => switch (this) {
        DriverVerificationKind.document => Icons.badge_outlined,
        DriverVerificationKind.vehiclePhoto =>
          Icons.directions_car_filled_outlined,
      };
}
