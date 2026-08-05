import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  MANAGER = 'manager',
  ADMIN = 'admin',
  MARKET = 'market',
  RESTAURANT = 'restaurant',
}

export enum UserStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  // A driver who just self-registered a profile — awaiting admin approval.
  // Passengers/managers/admins are never PENDING; they go ACTIVE immediately.
  PENDING = 'pending',
}

// Fine-grained capabilities for MANAGER accounts (RBAC layer on top of the
// coarse UserRole check). ADMIN always has every permission implicitly and
// never consults this list (see PermissionsGuard). A MANAGER's effective
// access is the intersection of "is a manager" (RolesGuard) AND "has this
// specific permission" (PermissionsGuard) — this is what lets an admin
// designate one manager as dispatch-only and another as full operations,
// without a separate DISPATCHER account type. One permission maps to one
// coherent area of the product, not one endpoint:
export enum Permission {
  // Live dispatch monitor, exceptions (SOS + no-drivers-found), manual
  // override/reassign, call-center order creation, dispatch stats/reports,
  // the override audit log.
  DISPATCH = 'dispatch',
  // View the driver roster (list/detail) — not the same as approving them.
  DRIVERS_VIEW = 'drivers_view',
  // Approve a pending driver's KYC application.
  DRIVERS_APPROVE = 'drivers_approve',
  // Adjust a driver's wallet balance or commission-rate override — a
  // money-moving action, ADMIN-only until explicitly granted to a manager.
  DRIVERS_FINANCE = 'drivers_finance',
  // Propose tariff changes, adjust surge multipliers, view the commission
  // setting — approving a proposed tariff change stays ADMIN-only.
  TARIFFS_MANAGE = 'tariffs_manage',
  // View and create promo codes — deleting one stays ADMIN-only.
  PROMO_MANAGE = 'promo_manage',
  // View driver bonus rules/progress — creating/editing a rule stays ADMIN-only.
  BONUSES_VIEW = 'bonuses_view',
  // View and respond to passenger/driver support threads.
  SUPPORT_MANAGE = 'support_manage',
  // View the withdrawal payout queue — approving/rejecting/marking paid
  // stays ADMIN-only.
  WITHDRAWALS_VIEW = 'withdrawals_view',
  // View the general user list/detail (passengers, drivers, vendors).
  USERS_VIEW = 'users_view',
}

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

// Read-path indexes.
// - role + created_at: UsersService.findAll (admin user list, filtered by
//   role and sorted newest-first) and the "new customers today"
//   role+created_at dashboard counter.
// - referred_by_user_id: ReferralsService counts a user's referrals on every
//   referral screen open.
// `phone` and `referral_code` are declared `unique: true`, so Postgres
// already backs them with an implicit unique index — no @Index for those.
@Index('idx_users_role_created_at', ['role', 'createdAt'])
@Index('idx_users_referred_by_user_id', ['referredByUserId'])
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  firstName: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  lastName: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PASSENGER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true, type: 'varchar', length: 300 })
  blockReason: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fcmToken: string | null;

  // Short shareable code identifying this user as a referrer. Auto-generated
  // at user creation (see generateUniqueReferralCode) and never changes.
  @Column({ unique: true, type: 'varchar', length: 10 })
  referralCode: string;

  // The user who referred this user, set at most once (see
  // ReferralsService.applyReferralCode). Null if this user signed up
  // without a referral code or hasn't applied one yet.
  @Column({ name: 'referred_by_user_id', nullable: true, type: 'uuid' })
  referredByUserId: string | null;

  // Only consulted for MANAGER accounts (see PermissionsGuard) — ignored for
  // every other role. Empty for non-managers.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
