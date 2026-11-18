/// O'zbekiston hududlari (ISO 3166-2:UZ) — taksi litsenziyasi hududi.
///
/// Server kodni saqlaydi va matching'da cheklov qo'llaydi: zakaz faqat shu
/// va chegaradosh hududlarda taklif qilinadi
/// (`backend/src/common/regions/uz-regions.ts` — ro'yxat bir xil bo'lishi shart).
enum UzRegion {
  toshkentShahri('UZ-TK', 'Toshkent shahri', 'город Ташкент'),
  toshkentViloyati('UZ-TO', 'Toshkent viloyati', 'Ташкентская область'),
  andijon('UZ-AN', 'Andijon viloyati', 'Андижанская область'),
  buxoro('UZ-BU', 'Buxoro viloyati', 'Бухарская область'),
  fargona('UZ-FA', "Farg'ona viloyati", 'Ферганская область'),
  jizzax('UZ-JI', 'Jizzax viloyati', 'Джизакская область'),
  xorazm('UZ-XO', 'Xorazm viloyati', 'Хорезмская область'),
  namangan('UZ-NG', 'Namangan viloyati', 'Наманганская область'),
  navoiy('UZ-NW', 'Navoiy viloyati', 'Навоийская область'),
  qashqadaryo('UZ-QA', 'Qashqadaryo viloyati', 'Кашкадарьинская область'),
  qoraqalpogiston('UZ-QR', "Qoraqalpog'iston Respublikasi", 'Республика Каракалпакстан'),
  samarqand('UZ-SA', 'Samarqand viloyati', 'Самаркандская область'),
  sirdaryo('UZ-SI', 'Sirdaryo viloyati', 'Сырдарьинская область'),
  surxondaryo('UZ-SU', 'Surxondaryo viloyati', 'Сурхандарьинская область');

  const UzRegion(this.code, this._uz, this._ru);

  final String code;
  final String _uz;
  final String _ru;

  String label({required bool ru}) => ru ? _ru : _uz;

  /// Kod emas (eski erkin matn) yoki `null` — `null`.
  static UzRegion? fromCode(String? code) {
    for (final r in values) {
      if (r.code == code) return r;
    }
    return null;
  }
}
