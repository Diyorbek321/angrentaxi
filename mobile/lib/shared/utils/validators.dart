import 'package:angren_taxi/l10n/l10n.dart';

class Validators {
  Validators._();

  static const String _phonePattern = r'^\+998[0-9]{9}$';

  static String? validatePhone(String? value) {
    if (value == null || value.isEmpty) {
      return AppL10n.current.shValPhoneRequired;
    }
    final cleaned = value.replaceAll(' ', '').replaceAll('-', '');
    final regex = RegExp(_phonePattern);
    if (!regex.hasMatch(cleaned)) {
      return AppL10n.current.shValPhoneInvalid;
    }
    return null;
  }

  static String? validateOtp(String? value) {
    if (value == null || value.isEmpty) {
      return AppL10n.current.shValOtpRequired;
    }
    if (value.length != 6) {
      return AppL10n.current.shValOtpLength;
    }
    if (!RegExp(r'^\d{6}$').hasMatch(value)) {
      return AppL10n.current.shValDigitsOnly;
    }
    return null;
  }

  static String? validateRequired(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return fieldName == null
          ? AppL10n.current.shValThisFieldRequired
          : AppL10n.current.shValFieldRequired(fieldName);
    }
    return null;
  }

  static String? validateName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return AppL10n.current.shValNameRequired;
    }
    if (value.trim().length < 2) {
      return AppL10n.current.shValNameTooShort;
    }
    return null;
  }

  static String normalizePhone(String phone) {
    final cleaned = phone.replaceAll(' ', '').replaceAll('-', '');
    if (cleaned.startsWith('998') && cleaned.length == 12) {
      return '+$cleaned';
    }
    if (cleaned.startsWith('8') && cleaned.length == 11) {
      return '+7${cleaned.substring(1)}';
    }
    return cleaned;
  }
}
