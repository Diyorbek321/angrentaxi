import 'package:equatable/equatable.dart';

/// The current user's invite-a-friend program summary, backed by
/// `GET /users/me/referral`
/// (backend/src/modules/referrals/referrals.controller.ts).
class ReferralInfo extends Equatable {
  const ReferralInfo({
    required this.referralCode,
    required this.referredCount,
    required this.totalBonusEarned,
  });

  final String referralCode;
  final int referredCount;
  final double totalBonusEarned;

  factory ReferralInfo.fromJson(Map<String, dynamic> json) {
    return ReferralInfo(
      referralCode: json['referralCode'] as String,
      referredCount: (json['referredCount'] as num?)?.toInt() ?? 0,
      totalBonusEarned:
          (json['totalBonusEarned'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'referralCode': referralCode,
        'referredCount': referredCount,
        'totalBonusEarned': totalBonusEarned,
      };

  @override
  List<Object?> get props => [referralCode, referredCount, totalBonusEarned];
}
