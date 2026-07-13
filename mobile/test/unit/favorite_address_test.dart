// Model tests for FavoriteAddress.fromJson (backend/src/modules/favorites),
// plus the icon/color presentation heuristic derived from the label.
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FavoriteAddress.fromJson', () {
    test('parses a full favorite response', () {
      final favorite = FavoriteAddress.fromJson({
        'id': 'fav-1',
        'userId': 'user-1',
        'label': 'Uy',
        'address': "Angren, Bobur ko'chasi, 10",
        'lat': 41.0167,
        'lng': 70.1436,
        'createdAt': '2026-07-13T10:00:00.000Z',
      });

      expect(favorite.id, 'fav-1');
      expect(favorite.label, 'Uy');
      expect(favorite.address, "Angren, Bobur ko'chasi, 10");
      expect(favorite.lat, 41.0167);
      expect(favorite.lng, 70.1436);
    });

    test('coerces integer lat/lng to double', () {
      final favorite = FavoriteAddress.fromJson({
        'id': 'fav-2',
        'label': 'Ish',
        'address': 'Ofis',
        'lat': 41,
        'lng': 70,
      });

      expect(favorite.lat, 41.0);
      expect(favorite.lng, 70.0);
    });

    test('defaults label/address to empty string when absent', () {
      final favorite = FavoriteAddress.fromJson({
        'id': 'fav-3',
        'lat': 41.0,
        'lng': 70.0,
      });

      expect(favorite.label, '');
      expect(favorite.address, '');
    });

    test('round-trips through toJson', () {
      const favorite = FavoriteAddress(
        id: 'fav-4',
        label: 'Bozor',
        address: 'Angren bozori',
        lat: 41.05,
        lng: 70.10,
      );

      final json = favorite.toJson();
      final roundTripped = FavoriteAddress.fromJson(json);

      expect(roundTripped, favorite);
    });

    test('two favorites with the same fields are equal (Equatable)', () {
      const a = FavoriteAddress(
        id: 'fav-1', label: 'Uy', address: 'A', lat: 1, lng: 2);
      const b = FavoriteAddress(
        id: 'fav-1', label: 'Uy', address: 'A', lat: 1, lng: 2);

      expect(a, b);
    });
  });

  group('FavoriteAddressPresentation', () {
    test('"Uy" gets a home icon', () {
      const favorite =
          FavoriteAddress(id: '1', label: 'Uy', address: 'A', lat: 0, lng: 0);
      expect(favorite.icon, Icons.home_rounded);
    });

    test('"Ish" gets a work icon', () {
      const favorite = FavoriteAddress(
          id: '1', label: 'Ish', address: 'A', lat: 0, lng: 0);
      expect(favorite.icon, Icons.work_rounded);
    });

    test('an arbitrary label falls back to a generic pin icon', () {
      const favorite = FavoriteAddress(
          id: '1', label: 'Bozor', address: 'A', lat: 0, lng: 0);
      expect(favorite.icon, Icons.location_on_rounded);
    });
  });
}
