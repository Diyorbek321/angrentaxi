import 'package:equatable/equatable.dart';

/// Saqlangan karta (`GET /payments/cards`). Token hech qachon ilovaga
/// qaytmaydi — faqat niqob (`8600 **** **** 6311`) va turi.
class SavedCard extends Equatable {
  const SavedCard({
    required this.id,
    required this.provider,
    required this.maskedPan,
    required this.cardBrand,
    required this.isDefault,
    this.expiry,
  });

  factory SavedCard.fromJson(Map<String, dynamic> json) => SavedCard(
        id: json['id'] as String,
        provider: (json['provider'] as String?) ?? 'payme',
        maskedPan: (json['maskedPan'] as String?) ?? '',
        cardBrand: (json['cardBrand'] as String?) ?? 'unknown',
        isDefault: json['isDefault'] == true,
        expiry: json['expiry'] as String?,
      );

  final String id;
  final String provider;
  final String maskedPan;

  /// `uzcard` | `humo` | `visa` | `mastercard` | `unknown`.
  final String cardBrand;
  final bool isDefault;

  /// `MM/YY`, provayder bersa.
  final String? expiry;

  /// Oxirgi 4 raqam — chiplarda qisqa ko'rsatish uchun (`•• 6311`).
  String get lastFour {
    final digits = maskedPan.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 4 ? digits.substring(digits.length - 4) : digits;
  }

  /// Ko'rinadigan tur nomi.
  String get brandLabel => switch (cardBrand) {
        'uzcard' => 'Uzcard',
        'humo' => 'Humo',
        'visa' => 'Visa',
        'mastercard' => 'Mastercard',
        _ => '',
      };

  SavedCard copyWith({bool? isDefault}) => SavedCard(
        id: id,
        provider: provider,
        maskedPan: maskedPan,
        cardBrand: cardBrand,
        isDefault: isDefault ?? this.isDefault,
        expiry: expiry,
      );

  @override
  List<Object?> get props =>
      [id, provider, maskedPan, cardBrand, isDefault, expiry];
}

/// `GET /payments/cards/availability`. `enabled: false` — karta bog'lash
/// o'chiq, ilova eski oqimni (Payme sahifasi) ko'rsatadi.
class SavedCardsAvailability extends Equatable {
  const SavedCardsAvailability({
    required this.enabled,
    this.merchantId,
    this.apiUrl,
  });

  const SavedCardsAvailability.disabled()
      : enabled = false,
        merchantId = null,
        apiUrl = null;

  factory SavedCardsAvailability.fromJson(Map<String, dynamic> json) {
    final merchantId = json['merchantId'] as String?;
    final apiUrl = json['apiUrl'] as String?;
    // Yarim sozlangan javob — o'chiq deb hisoblaymiz.
    final usable = json['enabled'] == true &&
        (merchantId?.isNotEmpty ?? false) &&
        (apiUrl?.startsWith('https://') ?? false);
    return usable
        ? SavedCardsAvailability(
            enabled: true, merchantId: merchantId, apiUrl: apiUrl)
        : const SavedCardsAvailability.disabled();
  }

  final bool enabled;

  /// Payme ommaviy merchant id — `cards.*` uchun (maxfiy emas).
  final String? merchantId;

  /// Payme Subscribe API manzili (jonli yoki sandbox).
  final String? apiUrl;

  @override
  List<Object?> get props => [enabled, merchantId, apiUrl];
}
