import 'package:equatable/equatable.dart';

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
  ];
}
