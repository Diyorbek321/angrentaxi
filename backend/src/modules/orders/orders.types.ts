// Shared response shapes for the orders module. Kept in their own file so the
// query, earnings and facade services can all reference them without importing
// each other. Re-exported from orders.service.ts for backwards compatibility
// with existing `import { PaginatedOrders } from './orders.service'` call sites.
import { Order } from '../../database/entities/order.entity';

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface DriverEarningsPeriod {
  gross: number;
  commission: number;
  /** 1% soliq agenti ushlab qolgani (`tax_withholding` qatorlari). */
  taxWithheld: number;
  /** Davrda BOSHLANGAN smenalar narxi (bekor qilinganlarsiz). */
  shiftPassCost: number;
  /**
   * gross − commission − taxWithheld − shiftPassCost. Chaqiq (tips) KIRMAYDI —
   * eski mijozlar uchun ma'no o'zgarmagan.
   */
  net: number;
  trips: number;
  /** Davrdagi yakunlangan safarlar chaqiqlari (`orders.tip_amount`), komissiyasiz. */
  tips: number;
  /** net + tips — haydovchining jami sof tushumi (naqd qo'lda + hamyonga). */
  netWithTips: number;
}

export interface DriverEarningsBreakdown {
  today: DriverEarningsPeriod;
  week: DriverEarningsPeriod;
  month: DriverEarningsPeriod;
}
