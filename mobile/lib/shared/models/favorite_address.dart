import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

/// A passenger's saved address, backed by
/// `GET/POST/DELETE /users/favorite-addresses`
/// (backend/src/modules/favorites/favorites.controller.ts). The backend also
/// returns `userId`/`createdAt`, but neither is needed on the client today.
class FavoriteAddress extends Equatable {
  const FavoriteAddress({
    required this.id,
    required this.label,
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String id;
  final String label;
  final String address;
  final double lat;
  final double lng;

  factory FavoriteAddress.fromJson(Map<String, dynamic> json) {
    return FavoriteAddress(
      id: json['id'] as String,
      label: (json['label'] as String?) ?? '',
      address: (json['address'] as String?) ?? '',
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'address': address,
        'lat': lat,
        'lng': lng,
      };

  @override
  List<Object?> get props => [id, label, address, lat, lng];
}

/// Icon/color picked from the label so common favorites ("Uy"/"Ish") get a
/// recognizable look without the backend needing to store one.
extension FavoriteAddressPresentation on FavoriteAddress {
  IconData get icon {
    final lower = label.toLowerCase();
    if (lower.contains('uy') || lower.contains('home')) {
      return Icons.home_rounded;
    }
    if (lower.contains('ish') ||
        lower.contains('ofis') ||
        lower.contains('work')) {
      return Icons.work_rounded;
    }
    return Icons.location_on_rounded;
  }

  Color get color {
    final lower = label.toLowerCase();
    if (lower.contains('uy') || lower.contains('home')) {
      return kMintDeep;
    }
    if (lower.contains('ish') ||
        lower.contains('ofis') ||
        lower.contains('work')) {
      return kInfo;
    }
    return kWarning;
  }
}
