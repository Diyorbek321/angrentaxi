import 'dart:convert';
import 'dart:io';

import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Guruhlash belgisi NBSP (intl `uz_UZ`) — taqqoslash uchun oddiy bo'shliqqa.
String som(double v) => Formatters.formatSom(v).replaceAll('\u00a0', ' ');

void main() {
  setUpAll(() async {
    await initializeDateFormatting('uz');
    await initializeDateFormatting('ru');
  });

  test('every Uzbek key has a Russian translation', () {
    Map<String, dynamic> keys(String locale) =>
        (jsonDecode(File('lib/l10n/app_$locale.arb').readAsStringSync()) as Map<String, dynamic>)
          ..removeWhere((k, _) => k.startsWith('@'));
    expect(keys('ru').keys.toSet(), keys('uz').keys.toSet());
  });

  test('switching the language changes non-widget text and persists', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final controller = LocaleController(prefs);

    expect(TripOption.childSeat.label, "Bola o'rindig'i");
    expect(som(18000), "18 000 so'm");

    await controller.setLocale(const Locale('ru'));
    expect(TripOption.childSeat.label, isNot("Bola o'rindig'i"));
    expect(som(18000), '18 000 сум');
    expect(prefs.getString('app_locale'), 'ru');

    // A fresh start reads the saved choice.
    expect(LocaleController(prefs).locale, const Locale('ru'));

    await controller.setLocale(const Locale('uz'));
    expect(TripOption.childSeat.label, "Bola o'rindig'i");
  });
}
