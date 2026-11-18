import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/foundation.dart';

enum PromoStatus { idle, validating, applied, error }

/// Checkout'dagi promokod maydoni holati (docs/specs/food-market-ux-v5.md §2).
///
/// `POST /promo-codes/validate` ga `serviceType` va `amount` bilan so'raydi
/// va chegirma qatorini ko'rsatish uchun summani saqlaydi. Bu faqat
/// OLDINDAN KO'RISH: buyurtmada server kodni qayta tekshiradi va o'zi
/// hisoblaydi (`promoCode` buyurtma tanasida yuboriladi).
class PromoCodeController extends ChangeNotifier {
  PromoCodeController({required ApiClient apiClient, required this.serviceType})
      : _api = apiClient;

  final ApiClient _api;

  /// `food` yoki `market`.
  final String serviceType;

  PromoStatus _status = PromoStatus.idle;
  String? _appliedCode;
  double _discount = 0;
  String? _error;
  double? _validatedFor;

  PromoStatus get status => _status;
  bool get isValidating => _status == PromoStatus.validating;
  bool get isApplied => _status == PromoStatus.applied;

  /// Qo'llangan kod — buyurtma tanasiga shu ketadi.
  String? get appliedCode => isApplied ? _appliedCode : null;

  /// So'mdagi chegirma (oldindan ko'rish).
  double get discount => isApplied ? _discount : 0;
  String? get error => _status == PromoStatus.error ? _error : null;

  /// Savat summasi o'zgarganda: tekshirilgan summadan farq qilsa, kod qayta
  /// tekshiriladi (minimal summa / foiz o'zgarishi mumkin).
  bool needsRevalidation(double amount) => isApplied && _validatedFor != amount;

  Future<void> apply(String rawCode, {required double amount}) async {
    final code = rawCode.trim().toUpperCase();
    if (code.isEmpty) {
      _fail(AppL10n.current.saPromoEmpty);
      return;
    }
    _status = PromoStatus.validating;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.post(
        ApiEndpoints.validatePromo,
        data: {
          'code': code,
          // `orderAmount` — mavjud DTO maydoni; `amount` + `serviceType` —
          // spec v5 qo'shimchalari.
          'orderAmount': amount,
          'amount': amount,
          'serviceType': serviceType,
        },
      );
      final body = response.data;
      final data = body is Map ? body['data'] : null;
      if (data is! Map) {
        _fail(AppL10n.current.saPromoInvalid);
        return;
      }
      if (data['valid'] == false) {
        final notApplicable = data['code'] == ApiErrorCode.promoNotApplicable ||
            data['reason'] == ApiErrorCode.promoNotApplicable;
        final message = data['message'];
        _fail(notApplicable
            ? AppL10n.current.saPromoNotApplicable
            : (message is String && message.trim().isNotEmpty
                ? message
                : AppL10n.current.saPromoInvalid));
        return;
      }
      _appliedCode = code;
      _discount = _discountFrom(data, amount);
      _validatedFor = amount;
      _status = PromoStatus.applied;
      notifyListeners();
    } catch (e) {
      final apiError = ApiError.from(e);
      if (apiError?.code == ApiErrorCode.promoNotApplicable) {
        _fail(AppL10n.current.saPromoNotApplicable);
      } else {
        _fail(apiError?.message ?? extractErrorMessage(e));
      }
    }
  }

  static double _discountFrom(Map<dynamic, dynamic> data, double amount) {
    final direct = data['discountAmount'];
    if (direct is num) return direct.toDouble().clamp(0, amount).toDouble();
    final value = data['discountValue'];
    if (value is! num) return 0;
    final raw = data['discountType'] == 'percent'
        ? amount * value.toDouble() / 100
        : value.toDouble();
    return raw.clamp(0, amount).roundToDouble();
  }

  void _fail(String message) {
    _status = PromoStatus.error;
    _error = message;
    _appliedCode = null;
    _discount = 0;
    notifyListeners();
  }

  void clear() {
    _status = PromoStatus.idle;
    _appliedCode = null;
    _discount = 0;
    _error = null;
    _validatedFor = null;
    notifyListeners();
  }
}
