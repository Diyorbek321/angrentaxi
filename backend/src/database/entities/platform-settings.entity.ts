import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Single-row table for platform-wide config. Read/created lazily by
// SettingsService.getOrCreate() rather than a seed migration.
@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 10.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  defaultCommissionRate: number;

  @Column({ name: 'platform_name', type: 'varchar', default: 'Angren Taxi' })
  platformName: string;

  @Column({ name: 'support_phone', type: 'varchar', default: '+998 71 200 00 00' })
  supportPhone: string;

  @Column({ name: 'support_email', type: 'varchar', default: 'support@angrentaxi.uz' })
  supportEmail: string;

  // Stored and toggleable from Super Admin > Global Settings, but NOT yet
  // enforced by any request-blocking guard — flipping this only changes what
  // the setting reads back as. Wiring real traffic-blocking enforcement on a
  // live, deployed app is a separate, deliberate decision (see the PR/task
  // notes) rather than something to silently switch on.
  // Flat delivery fee added to every food/market order, in so'm.
  //
  // This lived only in the mobile app as `SuperappProvider._deliveryFee =
  // 7000`, so the passenger was shown a total the server never recorded: the
  // order row, the vendor's board and the receipt were all 7000 lower than
  // the figure at checkout. The server owns it now.
  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 7000,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  deliveryFee: number;

  // Naqd ovqat/market buyurtmasi chegarasi, so'm (migratsiya 019). Kuryer
  // tovarni do'kondan O'Z pulidan sotib oladi — katta summani cho'ntagidan
  // to'lamasin. Undan katta buyurtma faqat karta bilan.
  @Column({
    name: 'max_cash_vendor_order',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 200000,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  maxCashVendorOrder: number;

  // Safar opsiyalari haqi, so'm (migratsiya 023): `{ child_seat: 5000 }`.
  // Menejer belgilaydi; o'qish `normalizeTripOptionFees` orqali.
  @Column({ name: 'trip_option_fees', type: 'jsonb', default: () => "'{}'" })
  tripOptionFees: Record<string, number>;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode: boolean;

  // ------------------------------------------ huquqiy talablar (migr. 025)
  // docs/LEGAL-COMPLIANCE.md. Standart qiymatlar hech narsani o'zgartirmaydi:
  // majburlash o'chiq, ushlab qolish o'chiq, promo yo'q.

  // VMQ 200 talablarini taksi haydovchisiga MAJBURLASH sanasi. `null` —
  // majburlanmaydi (faqat ogohlantirish); kelajak sana — muhlat davri.
  @Column({ name: 'legal_compliance_enforced_from', type: 'timestamptz', nullable: true })
  legalComplianceEnforcedFrom: Date | null;

  @Column({ name: 'min_driver_age_years', type: 'int', default: 21 })
  minDriverAgeYears: number;

  @Column({ name: 'min_licence_experience_years', type: 'int', default: 3 })
  minLicenceExperienceYears: number;

  // Shahar ichida taksi mashinasining eng katta yoshi (VMQ 200).
  @Column({ name: 'max_vehicle_age_years', type: 'int', default: 15 })
  maxVehicleAgeYears: number;

  // Soliq agenti sifatida 1% ushlab qolish (PQ-247). Standart o'chiq.
  @Column({ name: 'tax_withholding_enabled', type: 'boolean', default: false })
  taxWithholdingEnabled: boolean;

  @Column({
    name: 'driver_tax_withholding_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 1.0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  driverTaxWithholdingRate: number;

  // Ishga tushirish aksiyasi: shu sanagacha taksi haydovchilaridan komissiya
  // olinmaydi (`commission-policy.ts`). `null` — aksiya yo'q.
  @Column({ name: 'launch_promo_commission_until', type: 'timestamptz', nullable: true })
  launchPromoCommissionUntil: Date | null;

  // ------------------------------------------ bosqich 2 (migratsiya 026)
  // docs/LEGAL-COMPLIANCE.md §7–8.

  // Sotuvchi bilan hisob-kitob: 'cash' (bugungi xulq) | 'wallet'
  // (`delivery/vendor-settlement-mode.ts`). Amaldagi rejim — sana bilan birga.
  @Column({ name: 'vendor_settlement_mode', type: 'varchar', length: 10, default: 'cash' })
  vendorSettlementMode: string;

  // E-tijorat qonuni 23-modda kuchga kirishi: shu paytdan rejim 'cash' bo'lsa
  // ham hamyon. `null` — faqat `vendorSettlementMode` ga qaraladi.
  @Column({
    name: 'vendor_wallet_settlement_from',
    type: 'timestamptz',
    nullable: true,
    default: () => "'2026-12-12 00:00:00+05'",
  })
  vendorWalletSettlementFrom: Date | null;

  // Smena (kunlik obuna). Standart o'chiq — hech narsa o'zgarmaydi.
  @Column({ name: 'shift_pass_enabled', type: 'boolean', default: false })
  shiftPassEnabled: boolean;

  @Column({
    name: 'shift_pass_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 25000,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  shiftPassPrice: number;

  @Column({ name: 'shift_pass_duration_hours', type: 'int', default: 24 })
  shiftPassDurationHours: number;

  // Smena qamraydigan xizmat turlari (`ServiceType` qiymatlari).
  @Column({ name: 'shift_pass_service_types', type: 'jsonb', default: () => `'["taxi"]'` })
  shiftPassServiceTypes: string[];

  // --- 3-bosqich (migratsiya 027) ---------------------------------------

  // Haydovchi/kuryer hamyonini Payme/Click orqali o'zi to'ldirishi.
  // Standart o'chiq — merchant kalitlari ulanganda admin yoqadi.
  @Column({ name: 'wallet_topup_enabled', type: 'boolean', default: false })
  walletTopupEnabled: boolean;

  @Column({
    name: 'wallet_topup_min',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 10000,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  walletTopupMin: number;

  @Column({
    name: 'wallet_topup_max',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 2000000,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  walletTopupMax: number;

  /** Ilovadagi tezkor tugmalar, so'm. */
  @Column({ name: 'wallet_topup_presets', type: 'jsonb', default: () => `'[50000, 100000, 200000]'` })
  walletTopupPresets: number[];

  // --- Security review (2026-10-15, migratsiya 030) -----------------------

  // Karta orqali to'ldirilgan pul shuncha kun YECHIB OLINMAYDI (sarflash
  // mumkin) — "to'ldir, sarfla, chargeback" ga qarshi (#3a). 0 — o'chiq.
  @Column({ name: 'wallet_topup_hold_days', type: 'int', default: 7 })
  walletTopupHoldDays: number;

  // Menejer (admin emas) bitta qo'lda tuzatishda |summa| chegarasi, so'm (#6).
  @Column({
    name: 'manual_adjustment_manager_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 2000000,
    transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) },
  })
  manualAdjustmentManagerLimit: number;

  // Platforma (yuridik shaxs) STIR'i — platformaning o'z xizmati fiskal
  // yozuvlarida (`principal_type = 'platform'`, masalan smena). 9 raqam.
  @Column({ name: 'platform_tin', type: 'varchar', length: 9, nullable: true })
  platformTin: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
