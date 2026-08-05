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
  net: number;
  trips: number;
}

export interface DriverEarningsBreakdown {
  today: DriverEarningsPeriod;
  week: DriverEarningsPeriod;
  month: DriverEarningsPeriod;
}
