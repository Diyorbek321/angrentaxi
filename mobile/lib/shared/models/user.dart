import 'package:equatable/equatable.dart';

class User extends Equatable {
  const User({
    required this.id,
    required this.phone,
    this.name,
    this.avatarUrl,
    this.rating,
    this.totalTrips,
    this.role,
    this.status,
  });

  final String id;
  final String phone;
  final String? name;
  final String? avatarUrl;
  final double? rating;
  final int? totalTrips;
  // Present on the /auth/verify-otp response (raw User entity). Used to tell
  // whether a driver-flavor login still needs to apply for a driver profile.
  final String? role;
  final String? status;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      rating:
          json['rating'] != null ? (json['rating'] as num).toDouble() : null,
      totalTrips: json['totalTrips'] as int?,
      role: json['role'] as String?,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'phone': phone,
    'name': name,
    'avatarUrl': avatarUrl,
    'rating': rating,
    'totalTrips': totalTrips,
    'role': role,
    'status': status,
  };

  User copyWith({
    String? id,
    String? phone,
    String? name,
    String? avatarUrl,
    double? rating,
    int? totalTrips,
    String? role,
    String? status,
  }) {
    return User(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      rating: rating ?? this.rating,
      totalTrips: totalTrips ?? this.totalTrips,
      role: role ?? this.role,
      status: status ?? this.status,
    );
  }

  String get displayName => name ?? phone;

  @override
  List<Object?> get props => [
    id,
    phone,
    name,
    avatarUrl,
    rating,
    totalTrips,
    role,
    status,
  ];
}
