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
