// The full provider set of the orders module (the OrdersService facade plus
// every service it delegates to). Shared by OrdersModule and by the service
// specs so the wiring is declared exactly once — adding a new collaborator
// service never means touching six spec files.
import { Provider } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersCreationService } from './orders-creation.service';
import { OrdersLifecycleService } from './orders-lifecycle.service';
import { OrdersCompletionService } from './orders-completion.service';
import { RoutedDistancePricing } from './routed-distance-pricing';
import { OrdersDispatchService } from './orders-dispatch.service';
import { OrdersQueryService } from './orders-query.service';
import { OrdersReceiptService } from './orders-receipt.service';
import { OrdersTipsService } from './orders-tips.service';
import { OrdersEarningsService } from './orders-earnings.service';
import { OrdersStatsService } from './orders-stats.service';
import { OrderStatusTransitionService } from './order-status-transition.service';

export const ORDERS_PROVIDERS: Provider[] = [
  OrdersService,
  OrdersCreationService,
  OrdersLifecycleService,
  OrdersCompletionService,
  RoutedDistancePricing,
  OrdersDispatchService,
  OrdersQueryService,
  OrdersReceiptService,
  OrdersTipsService,
  OrdersEarningsService,
  OrdersStatsService,
  OrderStatusTransitionService,
];
