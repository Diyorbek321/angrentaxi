import 'package:equatable/equatable.dart';

class User extends Equatable {
  const User({
    required this.id,
    required this.phone,
    this.name,
    this.avatarUrl,
    this.rating,
    this.totalTrips,
  });

  final String id;
  final String phone;
  final String? name;
  final String? avatarUrl;
  final double? rating;
  final int? totalTrips;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      rating:
          json['rating'] != null ? (json['rating'] as num).toDouble() : null,
      totalTrips: json['totalTrips'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'name': name,
    'avatarUrl': avatarUrl,
    'rating': rating,
    'totalTrips': totalTrips,
  };

  User copyWith({
    String? id,
    String? phone,
    String? name,
    String? avatarUrl,
    double? rating,
    int? totalTrips,
  }) {
    return User(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      rating: rating ?? this.rating,
      totalTrips: totalTrips ?? this.totalTrips,
    );
  }

  String get displayName => name ?? phone;

  @override
  List<Object?> get props => [id, phone, name, avatarUrl, rating, totalTrips];
}
