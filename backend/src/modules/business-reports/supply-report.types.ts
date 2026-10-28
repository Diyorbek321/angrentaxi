/** Haydovchi qisqa ko'rinishi — skill/egasi qo'ng'iroq qilishi uchun. */
export interface DriverBrief {
  driverId: string;
  name: string;
  phone: string;
  /** Oxirgi tugallangan safardan beri o'tgan kun; hech safar qilmagan — `null`. */
  daysSinceLastRide: number | null;
  rides: number;
}

export interface ShortageHour {
  /** Toshkent soati, 0–23. */
  hour: number;
  orders: number;
  /** Haydovchi topilmagan + yo'lovchi kutib bekor qilgan. */
  unmet: number;
}

/**
 * Haydovchilar bo'limi (supply) surati. `drivers`/`queue` — HOZIRGI holat,
 * qolganlari — davr [from, to) bo'yicha.
 */
export interface SupplySnapshot {
  period: { from: string; to: string };

  drivers: {
    approved: number;
    pendingApproval: number;
    blocked: number;
    onlineNow: number;
    /** Balansi manfiy — tizim ularni avtomatik oflayn qiladi. */
    negativeBalance: number;
    newRegistrations: number;
  };

  activity: {
    /** Davrda kamida bitta safar tugatgan haydovchilar. */
    activeDrivers: number;
    completedRides: number;
  };

  demand: {
    orders: number;
    completed: number;
    noDriverFound: number;
    /** Haydovchi biriktirilmasdan yo'lovchi o'zi bekor qilgan. */
    passengerGaveUp: number;
    shortageHours: ShortageHour[];
  };

  queue: {
    kycPending: number;
    /** Eng eski kutayotgan ariza necha soat kutyapti. */
    kycOldestHours: number | null;
  };

  /** 7+ kun safar qilmagan, lekin oxirgi 60 kunda ishlagan haydovchilar. */
  churning: DriverBrief[];
  /** Davrdagi eng faol haydovchilar. */
  topDrivers: DriverBrief[];
}

/** Buyurtmalarning necha foizi bajarildi (0–100); buyurtma bo'lmasa `null`. */
export function fulfilmentRate(s: SupplySnapshot): number | null {
  return s.demand.orders > 0 ? Math.round((s.demand.completed / s.demand.orders) * 100) : null;
}
