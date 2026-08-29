import 'package:intl/intl.dart';

class Formatters {
  Formatters._();

  static final NumberFormat _priceFormat = NumberFormat(
    '#,##0',
    'uz_UZ',
  );

  static String formatPrice(double amount) {
    final formatted = _priceFormat.format(amount.toInt());
    // Replace standard comma grouping with space
    final spaced = formatted.replaceAll(',', ' ');
    return '$spaced UZS';
  }

  /// Angren Go style amount: "18 000 so'm" (space grouping, so'm suffix).
  static String formatSom(double amount) {
    final formatted = _priceFormat.format(amount.toInt()).replaceAll(',', ' ');
    return "$formatted so'm";
  }

  /// Just the grouped number without a currency suffix: "124 500".
  static String formatAmount(double amount) {
    return _priceFormat.format(amount.toInt()).replaceAll(',', ' ');
  }

  static String formatPriceCompact(double amount) {
    if (amount >= 1000000) {
      return '${(amount / 1000000).toStringAsFixed(1)} mln UZS';
    }
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(0)} ming UZS';
    }
    return '${amount.toInt()} UZS';
  }

  static String formatDate(DateTime date) {
    return DateFormat('dd.MM.yyyy', 'uz').format(date);
  }

  static String formatDateTime(DateTime date) {
    return DateFormat('dd.MM.yyyy HH:mm', 'uz').format(date);
  }

  static String formatTime(DateTime date) {
    return DateFormat('HH:mm', 'uz').format(date);
  }

  static String formatRelativeDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return "Bugun, ${formatTime(date)}";
    } else if (diff.inDays == 1) {
      return "Kecha, ${formatTime(date)}";
    } else if (diff.inDays < 7) {
      return '${diff.inDays} kun oldin';
    } else {
      return formatDate(date);
    }
  }

  /// Minute-granular relative time for recent timestamps ("5 daqiqa oldin"),
  /// falling back to [formatRelativeDate]'s day-granular phrasing once an
  /// hour has passed. Used by the notifications list, whose hardcoded
  /// placeholder copy this replaces used exactly this style.
  static String formatRelativeTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 1) {
      return 'Hozirgina';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} daqiqa oldin';
    } else if (diff.inHours < 24 && diff.inDays == 0) {
      return '${diff.inHours} soat oldin';
    }
    return formatRelativeDate(date);
  }

  /// O'zbekcha qisqartirilgan oy nomlari — `intl` ning `uz` lokali oy
  /// nomlarini ruscha/inglizcha aralash qaytaradi, shuning uchun qo'lda.
  static const List<String> _monthsShort = [
    'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
    'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
  ];

  /// Qisqa sana: "22-avg".
  static String formatShortDate(DateTime when) =>
      '${when.day}-${_monthsShort[when.month - 1]}';

  /// Kun yorlig'i: "Bugun" / "Ertaga" / "22-avg".
  ///
  /// [now] ATAYLAB parametr — testda soatga bog'lanmaslik uchun.
  /// Solishtirish KALENDAR KUNI bo'yicha, 24 soatlik farq bo'yicha EMAS:
  /// bugun 23:50 dan ertaga 00:10 gacha atigi 20 daqiqa, lekin bu
  /// "Ertaga" bo'lishi kerak.
  static String formatDayLabel(DateTime when, {DateTime? now}) {
    final today = now ?? DateTime.now();
    final thatDay = DateTime(when.year, when.month, when.day);
    final thisDay = DateTime(today.year, today.month, today.day);
    final dayDiff = thatDay.difference(thisDay).inDays;

    if (dayDiff == 0) return 'Bugun';
    if (dayDiff == 1) return 'Ertaga';
    return formatShortDate(when);
  }

  /// Rejalashtirilgan safar yorlig'i: "Bugun, 18:30" / "Ertaga, 08:00" /
  /// "22-avg, 08:00".
  static String formatScheduleLabel(DateTime when, {DateTime? now}) =>
      '${formatDayLabel(when, now: now)}, ${formatTime(when)}';

  static String formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.toInt()} m';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }

  static String formatDuration(int minutes) {
    if (minutes < 60) {
      return '$minutes daqiqa';
    }
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    return mins == 0 ? '$hours soat' : '$hours soat $mins daqiqa';
  }

  static String formatRating(double rating) {
    return rating.toStringAsFixed(1);
  }

  static String formatPhone(String phone) {
    // +998901234567 -> +998 90 123-45-67
    if (phone.length == 13 && phone.startsWith('+998')) {
      return '${phone.substring(0, 4)} ${phone.substring(4, 6)} ${phone.substring(6, 9)}-${phone.substring(9, 11)}-${phone.substring(11)}';
    }
    return phone;
  }
}
