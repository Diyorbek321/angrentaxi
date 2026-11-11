import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Kuryerga «12-dekabrdan hamyon orqali hisob-kitob» eslatmasi yuborilgan
 * kunlar (migratsiya 027). Birlamchi kalit (user_id, reminder_date) —
 * bir kuryerga bir kunda ko'pi bilan bitta push, cron qayta ishga tushsa ham.
 */
@Entity('courier_wallet_reminders')
export class CourierWalletReminder {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Toshkent sanasi, `YYYY-MM-DD`. */
  @PrimaryColumn({ name: 'reminder_date', type: 'date' })
  reminderDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
