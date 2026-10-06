import 'dart:async';

import 'package:angren_taxi/features/passenger/order_provider.dart';

/// Barcha testlar uchun umumiy sozlama.
///
/// Yo'lovchi safar holatini davriy tekshiradi (`OrderProvider.syncInterval`).
/// Widget testlarida ochiq qolgan davriy taymer "A Timer is still pending"
/// bilan testni yiqitadi, shuning uchun u standart holda o'chiriladi —
/// uni tekshiradigan test oralig'ni o'zi beradi.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  OrderProvider.defaultSyncInterval = null;
  await testMain();
}
