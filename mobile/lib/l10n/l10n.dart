import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

export 'package:angren_taxi/l10n/gen/app_localizations.dart';

// ============================================================================
// ILOVA TILI — o'zbekcha (asosiy) va ruscha.
//
// Matnlar lib/l10n/parts/*.json da, ARB fayllari tool/l10n_merge.py bilan
// yig'iladi. Vidjetda: `context.l10n.someKey`. Kontekst yo'q joyda (provider,
// servis, model): `AppL10n.current.someKey` — joriy tanlangan til.
// ============================================================================

/// Qo'llab-quvvatlanadigan tillar, standart birinchi.
const List<Locale> kSupportedLocales = [Locale('uz'), Locale('ru')];
const Locale kDefaultLocale = Locale('uz');

extension L10nContext on BuildContext {
  /// Joriy til matnlari.
  ///
  /// ⚠️ ZAXIRA — O'ZBEKCHA. Delegatlarsiz qurilgan `MaterialApp` (masalan
  /// vidjet testlari) da `Localizations.of` `null` qaytaradi; bu holda
  /// o'zbekcha matnlar beriladi, shunda o'zbekcha matnni qidiradigan
  /// mavjud testlar ham, delegatsiz ochilgan dialog ham ishlayveradi.
  AppLocalizations get l10n =>
      Localizations.of<AppLocalizations>(this, AppLocalizations) ??
      lookupAppLocalizations(kDefaultLocale);
}

/// Kontekstsiz kod uchun joriy til (xato xabarlari, formatlash, model
/// yorliqlari). [LocaleController] til o'zgarganda buni yangilaydi.
abstract final class AppL10n {
  static AppLocalizations _current = lookupAppLocalizations(kDefaultLocale);

  static AppLocalizations get current => _current;

  /// `intl` uchun: 'uz' yoki 'ru'. Sana va raqam formatlash shuni ishlatadi.
  static String get localeName => _current.localeName;

  static void _set(Locale locale) {
    _current = lookupAppLocalizations(locale);
    Intl.defaultLocale = locale.languageCode;
  }
}

/// Tanlangan tilni saqlaydi va butun ilovaga tarqatadi.
class LocaleController extends ChangeNotifier {
  LocaleController(this._prefs) {
    final saved = _prefs.getString(_key);
    _locale = kSupportedLocales.firstWhere(
      (l) => l.languageCode == saved,
      orElse: () => kDefaultLocale,
    );
    AppL10n._set(_locale);
  }

  static const _key = 'app_locale';

  final SharedPreferences _prefs;
  late Locale _locale;

  Locale get locale => _locale;

  Future<void> setLocale(Locale locale) async {
    if (locale == _locale || !kSupportedLocales.contains(locale)) return;
    _locale = locale;
    AppL10n._set(locale);
    notifyListeners();
    await _prefs.setString(_key, locale.languageCode);
  }
}
