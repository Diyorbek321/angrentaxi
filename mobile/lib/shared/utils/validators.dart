class Validators {
  Validators._();

  static const String _phonePattern = r'^\+998[0-9]{9}$';

  static String? validatePhone(String? value) {
    if (value == null || value.isEmpty) {
      return 'Telefon raqamini kiriting';
    }
    final cleaned = value.replaceAll(' ', '').replaceAll('-', '');
    final regex = RegExp(_phonePattern);
    if (!regex.hasMatch(cleaned)) {
      return 'Telefon raqami noto\'g\'ri (+998XXXXXXXXX)';
    }
    return null;
  }

  static String? validateOtp(String? value) {
    if (value == null || value.isEmpty) {
      return 'Kodni kiriting';
    }
    if (value.length != 6) {
      return 'Kod 6 raqamdan iborat bo\'lishi kerak';
    }
    if (!RegExp(r'^\d{6}$').hasMatch(value)) {
      return 'Faqat raqamlar kiriting';
    }
    return null;
  }

  static String? validateRequired(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return '${fieldName ?? "Bu maydon"} bo\'sh bo\'lmasligi kerak';
    }
    return null;
  }

  static String? validateName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Ismni kiriting';
    }
    if (value.trim().length < 2) {
      return 'Ism kamida 2 ta harfdan iborat bo\'lishi kerak';
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
