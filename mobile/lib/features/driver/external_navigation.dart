import 'dart:io';

import 'package:url_launcher/url_launcher.dart';

/// Tashqi navigatorga topshirish uchun nomzod havolalar — tartibi MUHIM.
///
/// ⚠️ NEGA `geo:` OXIRIDA. `geo:0,0?q=…` xarita ilovasida faqat NUQTANI
/// ochadi: haydovchi yana "Yo'nalish" → "Boshlash" ni bosishi kerak —
/// mashina haydab ketayotganda ikki qo'shimcha tegish. Shuning uchun avval
/// to'g'ridan-to'g'ri yo'nalish rejimi:
///   1. Yandex Navigator — O'zbekistonda haydovchilar asosan shuni ishlatadi;
///   2. Google Maps navigatsiya rejimi (`google.navigation:`);
///   3. `geo:` — qaysi xarita bo'lsa ham, hech bo'lmasa nuqta.
/// iOS'da Apple Maps yo'nalish havolasi (`dirflg=d` — avtomobil).
List<Uri> navigationUris(double lat, double lng, String label, {bool ios = false}) {
  if (ios) {
    return [Uri.parse('https://maps.apple.com/?daddr=$lat,$lng&dirflg=d')];
  }
  return [
    Uri.parse('yandexnavi://build_route_on_map?lat_to=$lat&lon_to=$lng'),
    Uri.parse('google.navigation:q=$lat,$lng&mode=d'),
    Uri.parse('geo:0,0?q=$lat,$lng(${Uri.encodeComponent(label)})'),
  ];
}

/// Birinchi ochila oladigan navigatorni ochadi. Hech biri bo'lmasa `false`.
Future<bool> openExternalNavigation(
  double lat,
  double lng,
  String label, {
  Future<bool> Function(Uri uri)? canLaunch,
  Future<bool> Function(Uri uri)? launch,
}) async {
  final can = canLaunch ?? canLaunchUrl;
  final open = launch ?? (uri) => launchUrl(uri, mode: LaunchMode.externalApplication);
  for (final uri in navigationUris(lat, lng, label, ios: Platform.isIOS)) {
    if (await can(uri) && await open(uri)) return true;
  }
  return false;
}
