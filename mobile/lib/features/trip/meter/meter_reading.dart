/// Taksometrli safarning jonli ko'rsatkichi (`GET /orders/:id/meter`).
class MeterReading {
  const MeterReading({
    required this.distanceKm,
    required this.durationMin,
    required this.waitingFare,
    required this.fare,
  });

  factory MeterReading.fromJson(Map<String, dynamic> json) => MeterReading(
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        durationMin: (json['durationMin'] as num?)?.toInt() ?? 0,
        waitingFare: (json['waitingFare'] as num?)?.toDouble() ?? 0,
        fare: (json['fare'] as num?)?.toDouble() ?? 0,
      );

  final double distanceKm;
  final int durationMin;
  final double waitingFare;

  /// Hozirgacha jami (server yakunda xuddi shu formula bilan hisoblaydi).
  final double fare;
}
