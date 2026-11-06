import 'dart:async';

import 'package:angren_taxi/core/platform/device_identity.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';

/// Barcha testlar uchun umumiy sozlama.
///
/// Yo'lovchi safar holatini davriy tekshiradi (`OrderProvider.syncInterval`).
/// Widget testlarida ochiq qolgan davriy taymer "A Timer is still pending"
/// bilan testni yiqitadi, shuning uchun u standart holda o'chiriladi —
/// uni tekshiradigan test oralig'ni o'zi beradi. Qurilma ID si ham shunday.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  OrderProvider.defaultSyncInterval = null;
  // Har bir so'rov qurilma ID sini oladi; testda platforma kanali yo'q.
  DeviceIdentity.instance = DeviceIdentity.fixed(null);
  await testMain();
}
