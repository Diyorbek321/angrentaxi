// Model tests for ReferralInfo.fromJson, backed by GET /users/me/referral
// (backend/src/modules/referrals/referrals.controller.ts).
import 'package:angren_taxi/shared/models/referral_info.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ReferralInfo.fromJson', () {
    test('parses a full referral info response', () {
      final info = ReferralInfo.fromJson(const {
        'referralCode': 'AB12CD',
        'referredCount': 3,
        'totalBonusEarned': 15000,
      });

      expect(info.referralCode, 'AB12CD');
      expect(info.referredCount, 3);
      expect(info.totalBonusEarned, 15000.0);
    });

    test('coerces an integer totalBonusEarned to double', () {
      final info = ReferralInfo.fromJson(const {
        'referralCode': 'XY99ZZ',
        'referredCount': 0,
        'totalBonusEarned': 0,
      });

      expect(info.totalBonusEarned, isA<double>());
      expect(info.totalBonusEarned, 0.0);
    });

    test('defaults referredCount/totalBonusEarned to 0 when absent', () {
      final info = ReferralInfo.fromJson(const {'referralCode': 'ZZ11AA'});

      expect(info.referredCount, 0);
      expect(info.totalBonusEarned, 0.0);
    });

    test('round-trips through toJson', () {
      const info = ReferralInfo(
        referralCode: 'CALLER1',
        referredCount: 5,
        totalBonusEarned: 25000,
      );

      final json = info.toJson();
      final roundTripped = ReferralInfo.fromJson(json);

      expect(roundTripped, info);
    });

    test('two ReferralInfo with the same fields are equal (Equatable)', () {
      const a = ReferralInfo(referralCode: 'AB12CD', referredCount: 3, totalBonusEarned: 15000);
      const b = ReferralInfo(referralCode: 'AB12CD', referredCount: 3, totalBonusEarned: 15000);

      expect(a, b);
    });
  });
}
