import 'package:equatable/equatable.dart';

class FoodRestaurant extends Equatable {
  const FoodRestaurant({
    required this.id,
    required this.name,
    required this.address,
    required this.isOpen,
  });

  final String id;
  final String name;
  final String? address;
  final bool isOpen;

  factory FoodRestaurant.fromJson(Map<String, dynamic> json) {
    return FoodRestaurant(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      isOpen: (json['status'] as String?) != 'closed',
    );
  }

  @override
  List<Object?> get props => [id, name, address, isOpen];
}
