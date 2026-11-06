import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/driver/legal/legal_save_error.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';
import 'package:flutter/foundation.dart';

/// Huquqiy profil holati — `GET/PATCH /drivers/me/legal`.
///
/// Alohida provayder (DriverProvider'ga qo'shilmagan): u allaqachon katta,
/// bu esa mustaqil bo'lim. Xato o'z maydoniga yoziladi — bosh ekran
/// bannerini so'rov yiqilgani uchun "bloklangan" holatga tushirmaslik
/// kerak (`unknown` bloklamaydi).
class DriverLegalProvider extends ChangeNotifier {
  DriverLegalProvider({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  DriverLegalSummary? _summary;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _loadError;
  String? _saveError;
  LegalSaveErrorKind? _saveErrorKind;
  bool _profileLocked = false;

  DriverLegalSummary? get summary => _summary;
  DriverLegalProfile get profile =>
      _summary?.profile ?? DriverLegalProfile.empty;
  LegalEligibility get eligibility =>
      _summary?.eligibility ?? LegalEligibility.unknown;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get loadError => _loadError;
  String? get saveError => _saveError;

  /// Oxirgi saqlash xatosining turi (kodli xato bo'lsa).
  LegalSaveErrorKind? get saveErrorKind => _saveErrorKind;

  /// PINFL/STIR/soliq maqomi/tug'ilgan sana qulflangan (hujjat tasdiqlangan).
  /// `GET /drivers/me/legal` buni bildirmaydi — server `LEGAL_PROFILE_LOCKED`
  /// qaytargach bilinadi va sessiya davomida eslab qolinadi.
  bool get isProfileLocked => _profileLocked;

  /// Bosh ekran banneri: faqat majburlash KUCHGA KIRGAN va haydovchi
  /// hozir haqiqatan bloklangan bo'lsa.
  bool get showBlockingBanner => eligibility.enforced && eligibility.blocking;

  static DriverLegalSummary? _parse(dynamic body) {
    if (body is! Map<String, dynamic>) return null;
    final payload = body['data'];
    return payload is Map<String, dynamic>
        ? DriverLegalSummary.fromJson(payload)
        : null;
  }

  Future<void> load() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _apiClient.get(ApiEndpoints.driverLegal);
      _summary = _parse(response.data) ?? _summary;
      _loadError = null;
    } catch (e) {
      _loadError = extractErrorMessage(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Saqlaydi; muvaffaqiyatda server qaytargan yangi xulosa (sabablar
  /// qayta hisoblangan) qo'llanadi.
  Future<bool> save(DriverLegalProfile profile) async {
    _isSaving = true;
    _saveError = null;
    _saveErrorKind = null;
    notifyListeners();
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.driverLegal,
        data: profile.toPatchJson(),
      );
      _summary = _parse(response.data) ??
          DriverLegalSummary(profile: profile, eligibility: eligibility);
      return true;
    } catch (e) {
      final kind = legalSaveErrorKind(ApiError.from(e));
      _saveErrorKind = kind;
      if (kind == LegalSaveErrorKind.locked) _profileLocked = true;
      _saveError =
          kind == null ? extractErrorMessage(e) : legalSaveErrorMessage(kind);
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  void clearSaveError() {
    if (_saveError == null) return;
    _saveError = null;
    _saveErrorKind = null;
    notifyListeners();
  }
}

DriverLegalProvider buildDriverLegalProvider() =>
    DriverLegalProvider(apiClient: sl<ApiClient>());
