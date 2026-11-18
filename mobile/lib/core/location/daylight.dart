import 'dart:math' as math;

/// Berilgan joy va sana uchun quyosh chiqishi/botishini hisoblaydi.
///
/// Nega kerak: tungi xarita uslubi "soat 19:00 dan keyin" kabi qat'iy
/// chegara bilan yoqilsa, Angrenda yozda soat 19:00 da hali quyosh baland —
/// haydovchi yorug' kunda qora xarita oladi. Dekabrda esa aksincha, 17:30 da
/// allaqachon qorong'i, lekin xarita hali oq turadi. Farq yiliga ~2.5 soat.
///
/// Algoritm — standart soddalashtirilgan quyosh geometriyasi (Cooper
/// deklinatsiya formulasi + soat burchagi). Aniqligi bir necha daqiqa;
/// xarita uslubini almashtirish uchun bundan ortig'i kerak emas.
class Daylight {
  const Daylight._();

  /// Quyosh botishidan keyin osmon yana ~30 daqiqa yorug' turadi
  /// (fuqarolik shafag'i). Xaritani aynan botish daqiqasida qoraytirish
  /// erta bo'lardi, shuning uchun shu qadar kechiktiramiz.
  static const Duration _twilight = Duration(minutes: 30);

  /// [at] vaqti shu joyda qorong'i (tun) bo'lsa `true`.
  ///
  /// [at] qurilmaning mahalliy vaqti bo'lishi kerak — vaqt mintaqasi
  /// siljishi shundan olinadi.
  static bool isNight({
    required DateTime at,
    required double latitude,
    required double longitude,
  }) {
    final times = _sunTimes(at: at, latitude: latitude, longitude: longitude);

    // Qutb kunlari/tunlari: soat burchagi mavjud emas.
    if (times == null) {
      // Deklinatsiya va kenglik belgisi bir xil bo'lsa — qutb KUNI.
      final declination = _declinationDegrees(_dayOfYear(at));
      final polarDay = (latitude >= 0) == (declination >= 0);
      return !polarDay;
    }

    final (sunrise, sunset) = times;
    return at.isBefore(sunrise) || at.isAfter(sunset.add(_twilight));
  }

  /// Mahalliy vaqtdagi (quyosh chiqishi, quyosh botishi) juftligi.
  /// Qutb kuni/tunida `null`.
  static (DateTime, DateTime)? _sunTimes({
    required DateTime at,
    required double latitude,
    required double longitude,
  }) {
    final declination = _declinationDegrees(_dayOfYear(at));

    final latRad = _rad(latitude);
    final declRad = _rad(declination);

    // Soat burchagi: quyosh ufqda bo'lgan paytdagi burchak.
    // |cos| > 1 bo'lsa quyosh o'sha kuni umuman chiqmaydi yoki botmaydi.
    final cosHourAngle = -math.tan(latRad) * math.tan(declRad);
    if (cosHourAngle.abs() > 1) return null;

    final hourAngleDegrees = _deg(math.acos(cosHourAngle));

    // Quyosh tush payti mahalliy SOAT bo'yicha 12:00 emas: joyning
    // uzunlamasi vaqt mintaqasi meridianidan farq qiladi. Har 1° = 4 daqiqa.
    final timeZoneHours = at.timeZoneOffset.inMinutes / 60.0;
    final meridian = 15.0 * timeZoneHours;
    final correctionMinutes = 4.0 * (longitude - meridian);
    final solarNoonMinutes = 12 * 60 + correctionMinutes;

    final halfDayMinutes = hourAngleDegrees * 4.0; // 1° = 4 daqiqa

    final midnight = DateTime(at.year, at.month, at.day);
    return (
      midnight.add(
        Duration(minutes: (solarNoonMinutes - halfDayMinutes).round()),
      ),
      midnight.add(
        Duration(minutes: (solarNoonMinutes + halfDayMinutes).round()),
      ),
    );
  }

  /// Quyosh deklinatsiyasi (gradus) — Cooper formulasi.
  /// 21-iyun atrofida +23.45°, 21-dekabr atrofida −23.45°.
  static double _declinationDegrees(int dayOfYear) =>
      23.45 * math.sin(2 * math.pi * (284 + dayOfYear) / 365.0);

  static int _dayOfYear(DateTime date) =>
      date.difference(DateTime(date.year)).inDays + 1;

  static double _rad(double degrees) => degrees * math.pi / 180.0;

  static double _deg(double radians) => radians * 180.0 / math.pi;
}
