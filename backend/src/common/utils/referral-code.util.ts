import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

const REFERRAL_CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 5;

// Six uppercase alphanumeric characters sliced from a fresh UUID's hex
// digits — short enough to type/share, long enough (16.7M combinations) that
// collisions are rare at this scale.
function randomReferralCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, REFERRAL_CODE_LENGTH).toUpperCase();
}

// Generates a referral code that is unique against the users table at call
// time. Used everywhere a User row is first inserted (OTP verification,
// dispatcher-created passenger accounts, admin-created vendor accounts).
// Collisions are exceedingly rare, so a short retry loop is enough — no need
// for a DB-level upsert-with-retry dance.
export async function generateUniqueReferralCode(
  userRepository: Repository<User>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = randomReferralCode();
    const existing = await userRepository.findOne({ where: { referralCode: code } });
    if (!existing) {
      return code;
    }
  }

  // Extremely unlikely fallback: widen the code using the full (deduplicated)
  // UUID hex to all but eliminate further collisions. Still fits varchar(10).
  return randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}
