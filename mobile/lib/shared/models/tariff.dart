import 'package:equatable/equatable.dart';

/// Kutish maydonlari yo'q bo'lganda ishlatiladigan zaxira qiymatlar.
///
/// ⚠️ Ular backend USTUNLARINING O'Z DEFAULT'i bilan AYNAN bir xil
/// (`backend/src/database/entities/tariff.entity.ts`:
/// `free_wait_minutes int DEFAULT 3`, `waiting_price_per_minute int
/// DEFAULT 500`). Kalitlar faqat bitta holatda yo'q bo'ladi — ilova yangi,
/// server esa hali `009_waiting_charge` migratsiyasidan o'tmagan. O'shanda
/// ekran raqamsiz umumiy gap aytgandan ko'ra server bilan bir xil sonni
/// aytgani yaxshi; sonlar ikki joyda takrorlanmasin deb esa ular shu yerda,
/// bitta joyda turadi.
const int _kFallbackFreeWaitMinutes = 3;
const double _kFallbackWaitingPricePerMinute = 500;

class Tariff extends Equatable {
  const Tariff({
    required this.id,
    required this.name,
    required this.description,
    required this.baseFare,
    required this.perKmRate,
    required this.minFare,
    this.iconName,
    this.isAvailable = true,
    this.maxPassengers = 4,
    this.surgeMultiplier = 1.0,
    this.freeWaitMinutes = _kFallbackFreeWaitMinutes,
    this.waitingPricePerMinute = _kFallbackWaitingPricePerMinute,
  });

  final String id;
  final String name;
  final String description;
  final double baseFare;
  final double perKmRate;
  final double minFare;
  final String? iconName;
  final bool isAvailable;
  final int maxPassengers;

  // Demand-surge pricing multiplier the backend computes per tariff (GET
  // /tariffs returns e.g. "surgeMultiplier":1). Defaults to 1.0 (no surge)
  // when the field is missing, matching the backend's own default.
  final double surgeMultiplier;

  /// BEPUL kutish oynasi, daqiqa. Haydovchi "keldim" bosgan lahzadan
  /// boshlanadi (`orders.arrived_at`).
  ///
  /// Bu maydon NARX HISOBIGA KIRMAYDI — kutish haqini faqat server
  /// hisoblaydi (`orders-completion.service.ts`). Mobil tomonda u FAQAT
  /// yo'lovchiga qoidani OLDINDAN aytish uchun kerak: bosishdan oldin
  /// aytilmagan haq — e'tirozning eng keng tarqalgan sababi.
  final int freeWaitMinutes;

  /// Bepul oynadan keyingi HAR BOSHLANGAN daqiqa narxi, so'm.
  ///
  /// Butun so'm: backend ustuni `int` (tiyin yo'q), ya'ni daqiqaga
  /// ko'paytmasi ham har doim butun bo'ladi va float xatosi paydo
  /// bo'ladigan yo'l umuman qolmaydi.
  final double waitingPricePerMinute;

  // The backend (GET /tariffs, see backend/src/database/entities/tariff.entity.ts)
  // returns basePrice/pricePerKm/minPrice/isActive — not baseFare/perKmRate/
  // minFare/isAvailable/description. Previously this parsed the wrong keys,
  // so every tariff's baseFare/minFare cast (`as num`) threw on null and
  // loadTariffs()'s catch-all silently swallowed it, leaving the tariff list
  // permanently empty on the tariff-select screen.
  factory Tariff.fromJson(Map<String, dynamic> json) {
    return Tariff(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      baseFare: (json['basePrice'] as num).toDouble(),
      perKmRate: (json['pricePerKm'] as num).toDouble(),
      minFare: (json['minPrice'] as num).toDouble(),
      iconName: json['iconName'] as String?,
      isAvailable: (json['isActive'] as bool?) ?? true,
      maxPassengers: (json['maxPassengers'] as int?) ?? 4,
      surgeMultiplier: (json['surgeMultiplier'] as num?)?.toDouble() ?? 1.0,
      // Eski server bu ikki kalitni yubormaydi — zaxira qiymatlar
      // ishlatiladi (yuqoridagi izohga qarang), tarif ro'yxati esa
      // avvalgidek yuklanaveradi.
      freeWaitMinutes:
          (json['freeWaitMinutes'] as num?)?.round() ?? _kFallbackFreeWaitMinutes,
      waitingPricePerMinute: (json['waitingPricePerMinute'] as num?)?.toDouble() ??
          _kFallbackWaitingPricePerMinute,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'baseFare': baseFare,
    'perKmRate': perKmRate,
    'minFare': minFare,
    'iconName': iconName,
    'isAvailable': isAvailable,
    'maxPassengers': maxPassengers,
    'surgeMultiplier': surgeMultiplier,
    'freeWaitMinutes': freeWaitMinutes,
    'waitingPricePerMinute': waitingPricePerMinute,
  };

  double estimatePrice(double distanceKm) {
    final calculated = baseFare + (perKmRate * distanceKm);
    return calculated < minFare ? minFare : calculated;
  }

  @override
  List<Object?> get props => [
    id,
    name,
    description,
    baseFare,
    perKmRate,
    minFare,
    iconName,
    isAvailable,
    maxPassengers,
    surgeMultiplier,
    freeWaitMinutes,
    waitingPricePerMinute,
  ];
}
