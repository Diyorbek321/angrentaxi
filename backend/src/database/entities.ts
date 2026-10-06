// Every TypeORM entity the app registers with its connection.
//
// ⚠️ WHY A SINGLE LIST. The connection is built with an explicit `entities`
// array (no autoLoadEntities), and TypeORM 0.3 does not check it against the
// modules' `forFeature` calls. An entity left out here lets the app boot and
// then fails with EntityMetadataNotFoundError on its first query — which has
// happened four times (DispatchOverride, PushNotificationLog, RoadSpeedSample,
// City). `entities.spec.ts` now fails the build instead: it compares this list
// with every class decorated with @Entity under database/entities.

import { AdBanner } from './entities/ad-banner.entity';
import { City } from './entities/city.entity';
import { Dish } from './entities/dish.entity';
import { DispatchOverride } from './entities/dispatch-override.entity';
import { DriverBonusAward } from './entities/driver-bonus-award.entity';
import { DriverBonusRule } from './entities/driver-bonus-rule.entity';
import { DriverDocument } from './entities/driver-document.entity';
import { DriverVerificationRequirement } from './entities/driver-verification-requirement.entity';
import { DriverVerificationSubmission } from './entities/driver-verification-submission.entity';
import { Driver } from './entities/driver.entity';
import { FavoriteAddress } from './entities/favorite-address.entity';
import { FoodOrder } from './entities/food-order.entity';
import { LostItemReport } from './entities/lost-item-report.entity';
import { MarketCategory } from './entities/market-category.entity';
import { MarketOrder } from './entities/market-order.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { Order } from './entities/order.entity';
import { Otp } from './entities/otp.entity';
import { PlatformSettings } from './entities/platform-settings.entity';
import { Product } from './entities/product.entity';
import { PromoCode } from './entities/promo_code.entity';
import { PromoCodeUsage } from './entities/promo_code_usage.entity';
import { PushNotificationLog } from './entities/push-notification-log.entity';
import { Rating } from './entities/rating.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Restaurant } from './entities/restaurant.entity';
import { RoadSpeedSample } from './entities/road-speed-sample.entity';
import { SosAlert } from './entities/sos-alert.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Store } from './entities/store.entity';
import { SupportMessage } from './entities/support-message.entity';
import { SupportThread } from './entities/support-thread.entity';
import { TariffChangeRequest } from './entities/tariff-change-request.entity';
import { Tariff } from './entities/tariff.entity';
import { Transaction } from './entities/transaction.entity';
import { TripMessage } from './entities/trip-message.entity';
import { TripTrackPoint } from './entities/trip-track-point.entity';
import { Trip } from './entities/trip.entity';
import { User } from './entities/user.entity';
import { VehicleChangeRequest } from './entities/vehicle-change-request.entity';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';

export const ENTITIES = [
  AdBanner,
  City,
  Dish,
  DispatchOverride,
  DriverBonusAward,
  DriverBonusRule,
  DriverDocument,
  DriverVerificationRequirement,
  DriverVerificationSubmission,
  Driver,
  FavoriteAddress,
  FoodOrder,
  LostItemReport,
  MarketCategory,
  MarketOrder,
  MenuCategory,
  NotificationLog,
  Order,
  Otp,
  PlatformSettings,
  Product,
  PromoCode,
  PromoCodeUsage,
  PushNotificationLog,
  Rating,
  RefreshToken,
  Restaurant,
  RoadSpeedSample,
  SosAlert,
  StockMovement,
  Store,
  SupportMessage,
  SupportThread,
  TariffChangeRequest,
  Tariff,
  Transaction,
  TripMessage,
  TripTrackPoint,
  Trip,
  User,
  VehicleChangeRequest,
  WithdrawalRequest,
];
