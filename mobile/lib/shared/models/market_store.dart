import 'package:equatable/equatable.dart';

class MarketStore extends Equatable {
  const MarketStore({
    required this.id,
    required this.name,
    required this.address,
    required this.deliveryMode,
    required this.workingHoursStart,
    required this.workingHoursEnd,
  });

  final String id;
  final String name;
  final String? address;
  final String deliveryMode;
  final String workingHoursStart;
  final String workingHoursEnd;

  factory MarketStore.fromJson(Map<String, dynamic> json) {
    return MarketStore(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      deliveryMode: (json['deliveryMode'] as String?) ?? 'platform',
      workingHoursStart: (json['workingHoursStart'] as String?) ?? '08:00',
      workingHoursEnd: (json['workingHoursEnd'] as String?) ?? '22:00',
    );
  }

  @override
  List<Object?> get props => [id, name, address, deliveryMode, workingHoursStart, workingHoursEnd];
}
