import 'package:equatable/equatable.dart';

class Driver extends Equatable {
  const Driver({
    required this.id,
    required this.phone,
    required this.name,
    required this.carModel,
    required this.carColor,
    required this.carNumber,
    this.avatarUrl,
    this.rating = 5.0,
    this.totalTrips = 0,
    this.isOnline = false,
    this.currentLat,
    this.currentLng,
  });

  final String id;
  final String phone;
  final String name;
  final String carModel;
  final String carColor;
  final String carNumber;
  final String? avatarUrl;
  final double rating;
  final int totalTrips;
  final bool isOnline;
  final double? currentLat;
  final double? currentLng;

  factory Driver.fromJson(Map<String, dynamic> json) {
    return Driver(
      id: json['id'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String,
      carModel: json['carModel'] as String,
      carColor: json['carColor'] as String,
      carNumber: json['carNumber'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      rating:
          json['rating'] != null ? (json['rating'] as num).toDouble() : 5.0,
      totalTrips: (json['totalTrips'] as int?) ?? 0,
      isOnline: (json['isOnline'] as bool?) ?? false,
      currentLat:
          json['currentLat'] != null
              ? (json['currentLat'] as num).toDouble()
              : null,
      currentLng:
          json['currentLng'] != null
              ? (json['currentLng'] as num).toDouble()
              : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'name': name,
    'carModel': carModel,
    'carColor': carColor,
    'carNumber': carNumber,
    'avatarUrl': avatarUrl,
    'rating': rating,
    'totalTrips': totalTrips,
    'isOnline': isOnline,
    'currentLat': currentLat,
    'currentLng': currentLng,
  };

  Driver copyWith({
    String? id,
    String? phone,
    String? name,
    String? carModel,
    String? carColor,
    String? carNumber,
    String? avatarUrl,
    double? rating,
    int? totalTrips,
    bool? isOnline,
    double? currentLat,
    double? currentLng,
  }) {
    return Driver(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      name: name ?? this.name,
      carModel: carModel ?? this.carModel,
      carColor: carColor ?? this.carColor,
      carNumber: carNumber ?? this.carNumber,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      rating: rating ?? this.rating,
      totalTrips: totalTrips ?? this.totalTrips,
      isOnline: isOnline ?? this.isOnline,
      currentLat: currentLat ?? this.currentLat,
      currentLng: currentLng ?? this.currentLng,
    );
  }

  String get carInfo => '$carColor $carModel • $carNumber';

  @override
  List<Object?> get props => [
    id,
    phone,
    name,
    carModel,
    carColor,
    carNumber,
    avatarUrl,
    rating,
    totalTrips,
    isOnline,
    currentLat,
    currentLng,
  ];
}
