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
    this.balance = 0,
    this.commissionRate,
    this.userStatus,
    String? userId,
  }) : userId = userId ?? id;

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
  final double balance;
  final double? commissionRate;
  // From the nested `user` object on GET /drivers/me — 'pending' means this
  // driver applied but hasn't been approved by an admin/manager yet.
  final String? userStatus;
  // The driver's *User* UUID (distinct from `id`, the driver profile row's
  // own PK) — needed for endpoints keyed by user id, e.g.
  // GET /ratings/driver/:userId. Falls back to `id` when the backend
  // response doesn't include a nested `user` object (shouldn't happen for
  // GET /drivers/me in practice, but keeps this field always non-null).
  final String userId;

  // Backend sends this shape in two different forms depending on the caller:
  // - GET /drivers/me returns the Driver entity with a nested `user` object
  //   (phone/firstName/lastName live there, not at top level).
  // - An order's `driver` field is the flat User entity with name/carModel/
  //   carNumber/rating already bolted on by OrdersService.attachDisplayFields
  //   (phone/name live at the top level there).
  // Neither shape has carColor or totalTrips — backend doesn't track either.
  factory Driver.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    final phone =
        (json['phone'] as String?) ?? (user?['phone'] as String?) ?? '';
    final name = (json['name'] as String?) ??
        [user?['firstName'], user?['lastName']]
            .whereType<String>()
            .where((s) => s.isNotEmpty)
            .join(' ');

    return Driver(
      id: json['id'] as String,
      phone: phone,
      name: name.isNotEmpty ? name : phone,
      carModel: (json['carModel'] as String?) ?? '',
      carColor: (json['carColor'] as String?) ?? '',
      carNumber: (json['carNumber'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      rating: json['rating'] != null ? (json['rating'] as num).toDouble() : 5.0,
      totalTrips: (json['totalTrips'] as int?) ?? 0,
      isOnline: (json['isOnline'] as bool?) ?? false,
      currentLat: json['currentLat'] != null
          ? (json['currentLat'] as num).toDouble()
          : null,
      currentLng: json['currentLng'] != null
          ? (json['currentLng'] as num).toDouble()
          : null,
      balance: json['balance'] != null ? (json['balance'] as num).toDouble() : 0,
      commissionRate: json['commissionRate'] != null
          ? (json['commissionRate'] as num).toDouble()
          : null,
      userStatus: user?['status'] as String?,
      userId: (json['userId'] as String?) ?? (user?['id'] as String?),
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
        'balance': balance,
        'commissionRate': commissionRate,
        'userStatus': userStatus,
        'userId': userId,
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
    double? balance,
    double? commissionRate,
    String? userStatus,
    String? userId,
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
      balance: balance ?? this.balance,
      commissionRate: commissionRate ?? this.commissionRate,
      userStatus: userStatus ?? this.userStatus,
      userId: userId ?? this.userId,
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
        balance,
        commissionRate,
        userStatus,
        userId,
      ];
}
