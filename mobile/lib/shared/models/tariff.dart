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

  factory Tariff.fromJson(Map<String, dynamic> json) {
    return Tariff(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      baseFare: (json['baseFare'] as num).toDouble(),
      perKmRate: (json['perKmRate'] as num).toDouble(),
      minFare: (json['minFare'] as num).toDouble(),
      iconName: json['iconName'] as String?,
      isAvailable: (json['isAvailable'] as bool?) ?? true,
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
