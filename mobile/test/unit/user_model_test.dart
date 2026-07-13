// Regression test: the backend's User entity has firstName/lastName
// columns, not a computed 'name' field. User.fromJson previously only read
// json['name'] (always null on a real response), so the real name never
// appeared anywhere in the app — every screen fell back to the phone number.
import 'package:angren_taxi/shared/models/user.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('User.fromJson', () {
    test('composes name from firstName + lastName when name is absent', () {
      final user = User.fromJson({
        'id': 'u1',
        'phone': '+998901234567',
        'firstName': 'Diyorbek',
        'lastName': 'Turgunboyev',
      });

      expect(user.name, 'Diyorbek Turgunboyev');
      expect(user.displayName, 'Diyorbek Turgunboyev');
    });

    test('falls back to phone when neither name nor firstName/lastName are set', () {
      final user = User.fromJson({'id': 'u1', 'phone': '+998901234567'});

      expect(user.name, isNull);
      expect(user.displayName, '+998901234567');
    });

    test('prefers an explicit name field if the backend ever sends one', () {
      final user = User.fromJson({
        'id': 'u1',
        'phone': '+998901234567',
        'name': 'Explicit Name',
        'firstName': 'Diyorbek',
      });

      expect(user.name, 'Explicit Name');
    });

    test('handles only firstName being set (no lastName)', () {
      final user = User.fromJson({
        'id': 'u1',
        'phone': '+998901234567',
        'firstName': 'Diyorbek',
        'lastName': null,
      });

      expect(user.name, 'Diyorbek');
    });
  });
}
