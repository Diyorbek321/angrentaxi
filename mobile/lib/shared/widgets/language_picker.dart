import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Til nomi har doim O'SHA TILDA yoziladi ("Русский", "O'zbekcha") — tilni
/// bilmaydigan foydalanuvchi ham o'zinikini topa olsin.
String languageName(BuildContext context, Locale locale) =>
    locale.languageCode == 'ru' ? context.l10n.languageRussian : context.l10n.languageUzbek;

/// Joriy til; `LocaleController` provayderi yo'q joyda (vidjet testlari)
/// standart til qaytadi, ekran esa yiqilmaydi.
Locale currentAppLocale(BuildContext context) =>
    context.watch<LocaleController?>()?.locale ?? kDefaultLocale;

/// Til tanlash oynasini ochadi va tanlovni darhol qo'llaydi.
Future<void> showLanguagePicker(BuildContext context) {
  final controller = context.read<LocaleController>();
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace2),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              sheetContext.l10n.appLanguage,
              style: const TextStyle(fontSize: kFontH3, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: kSpace2),
            for (final locale in kSupportedLocales)
              RadioListTile<Locale>(
                key: ValueKey('language-${locale.languageCode}'),
                contentPadding: EdgeInsets.zero,
                value: locale,
                groupValue: controller.locale,
                title: Text(languageName(sheetContext, locale)),
                onChanged: (value) {
                  if (value != null) controller.setLocale(value);
                  Navigator.of(sheetContext).pop();
                },
              ),
          ],
        ),
      ),
    ),
  );
}
