import 'package:equatable/equatable.dart';

enum VehicleChangeStatus { pending, approved, rejected }

VehicleChangeStatus _statusFrom(dynamic value) => switch (value) {
      'approved' => VehicleChangeStatus.approved,
      'rejected' => VehicleChangeStatus.rejected,
      _ => VehicleChangeStatus.pending,
    };

/// Haydovchining mashina almashtirish so'rovi
/// (`GET/POST /drivers/me/vehicle-change`).
///
/// Tasdiqlangan haydovchi mashinasini to'g'ridan-to'g'ri o'zgartira olmaydi:
/// yo'lovchiga "shu raqamli mashinani kuting" deb aytiladigan qiymat
/// menejer tekshirmaguncha eski holicha qoladi.
class VehicleChangeRequest extends Equatable {
  const VehicleChangeRequest({
    required this.id,
    required this.status,
    required this.carModel,
    required this.carNumber,
    required this.createdAt,
    this.carYear,
    this.reviewNote,
  });

  final String id;
  final VehicleChangeStatus status;
  final String carModel;
  final String carNumber;
  final int? carYear;

  /// Rad etilganda — menejer yozgan sabab.
  final String? reviewNote;
  final DateTime createdAt;

  bool get isPending => status == VehicleChangeStatus.pending;

  factory VehicleChangeRequest.fromJson(Map<String, dynamic> json) {
    final proposed = json['proposed'] is Map<String, dynamic>
        ? json['proposed'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return VehicleChangeRequest(
      id: json['id'] as String,
      status: _statusFrom(json['status']),
      carModel: (proposed['carModel'] as String?) ?? '',
      carNumber: (proposed['carNumber'] as String?) ?? '',
      carYear: (proposed['carYear'] as num?)?.toInt(),
      reviewNote: json['reviewNote'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
    );
  }

  @override
  List<Object?> get props =>
      [id, status, carModel, carNumber, carYear, reviewNote, createdAt];
}
