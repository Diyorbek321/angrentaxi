import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_error_messages.dart';
import 'package:angren_taxi/shared/models/shift_pass.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Smena sotib olish natijasi — ekran har biriga boshqacha javob beradi.
enum ShiftPassBuyOutcome {
  bought,

  /// 409 — faol smena allaqachon bor (ma'lumot qayta yuklanadi).
  alreadyActive,

  /// 400 — hamyonda mablag' yetarli emas yoki smena o'chirilgan; matn
  /// serverdan.
  rejected,

  /// Tarmoq / boshqa xato.
  failed,
}

class ShiftPassBuyResult {
  const ShiftPassBuyResult(this.outcome, [this.message]);

  final ShiftPassBuyOutcome outcome;
  final String? message;

  /// Rad etish sababi mablag' yetishmasligimi — "To'ldirish" tugmasi uchun.
  bool get isInsufficientFunds =>
      outcome == ShiftPassBuyOutcome.rejected &&
      (message?.toLowerCase().contains("mablag'") ?? false);
}

/// Hamyon atrofidagi yangi bo'limlar: ommaviy sozlamalar (to'ldirish
/// chegaralari, operator raqami), to'ldirishlar va kunlik smena.
///
/// Qoldiqning O'ZI bu yerda emas — u `DriverProvider.walletBalance` da
/// (daftar manbai bitta bo'lib qolsin).
class DriverWalletProvider extends ChangeNotifier {
  DriverWalletProvider({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  PublicSettings _settings = PublicSettings.defaults;
  bool _settingsLoaded = false;
  List<WalletTopup> _topups = const [];
  bool _isCreatingTopup = false;
  String? _topupError;
  bool _tooManyPendingTopups = false;

  ShiftPassInfo _shiftPass = ShiftPassInfo.disabled;
  bool _isBuyingShiftPass = false;

  PublicSettings get settings => _settings;
  bool get settingsLoaded => _settingsLoaded;
  List<WalletTopup> get topups => List.unmodifiable(_topups);
  bool get isCreatingTopup => _isCreatingTopup;
  String? get topupError => _topupError;

  /// Oxirgi urinish `WALLET_TOPUP_TOO_MANY_PENDING` bilan rad etildi —
  /// ekran ochiq to'ldirishlar ro'yxatini taklif qiladi.
  bool get tooManyPendingTopups => _tooManyPendingTopups;

  /// Hali yakunlanmagan (`pending`) to'ldirishlar — davom ettirish uchun.
  List<WalletTopup> get pendingTopups => List.unmodifiable(
        _topups.where((t) => t.status == WalletTopupStatus.pending),
      );
  ShiftPassInfo get shiftPass => _shiftPass;
  bool get isBuyingShiftPass => _isBuyingShiftPass;

  static dynamic _payload(Response<dynamic> response) {
    final body = response.data;
    return body is Map<String, dynamic> ? body['data'] : null;
  }

  Future<void> loadSettings() async {
    try {
      final payload =
          _payload(await _apiClient.get(ApiEndpoints.settingsPublic));
      if (payload is Map<String, dynamic>) {
        _settings = PublicSettings.fromJson(payload);
      }
      _settingsLoaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverWalletProvider] loadSettings error: $e');
    }
  }

  Future<void> loadTopups() async {
    try {
      final payload = _payload(await _apiClient.get(ApiEndpoints.walletTopups));
      if (payload is List) {
        _topups = payload
            .whereType<Map<String, dynamic>>()
            .map(WalletTopup.fromJson)
            .toList(growable: false);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[DriverWalletProvider] loadTopups error: $e');
    }
  }

  void _upsertTopup(WalletTopup topup) {
    _topups = [topup, ..._topups.where((t) => t.id != topup.id)];
  }

  /// `POST /payments/wallet/topup`. Muvaffaqiyatda `checkoutUrl` li yozuv.
  Future<WalletTopup?> createTopup({
    required int amount,
    required WalletTopupProvider provider,
  }) async {
    _isCreatingTopup = true;
    _topupError = null;
    _tooManyPendingTopups = false;
    notifyListeners();
    try {
      final payload = _payload(
        await _apiClient.post(
          ApiEndpoints.walletTopup,
          data: {'amount': amount, 'provider': provider.wireValue},
        ),
      );
      if (payload is! Map<String, dynamic>) {
        throw const FormatException('topup javobi bo\'sh');
      }
      final topup = WalletTopup.fromJson(payload);
      if (topup.id.isEmpty || (topup.checkoutUrl ?? '').isEmpty) {
        throw const FormatException('topup javobida checkoutUrl yo\'q');
      }
      _upsertTopup(topup);
      return topup;
    } catch (e) {
      final api = ApiError.from(e);
      // Server to'ldirishni o'chirgan (sozlama eskirgan) — sozlamani
      // qayta o'qiymiz, ekran operator kartasiga o'tadi.
      if (api?.code == ApiErrorCode.walletTopupDisabled) {
        await loadSettings();
      }
      final tooMany = topupTooManyPendingMessage(api);
      if (tooMany != null) {
        // Ro'yxat yangilansin — haydovchi ochiq to'lovni davom ettirsin.
        _tooManyPendingTopups = true;
        await loadTopups();
      }
      _topupError = tooMany ??
          (e is FormatException
              ? extractErrorMessage(null)
              : withCodedErrorAmounts(extractErrorMessage(e), api));
      return null;
    } finally {
      _isCreatingTopup = false;
      notifyListeners();
    }
  }

  /// `GET /payments/wallet/topup/:id` — holatni so'rash. Xatoda `null`
  /// (so'rov keyingi taktda qaytariladi).
  Future<WalletTopup?> refreshTopup(String id) async {
    try {
      final payload =
          _payload(await _apiClient.get(ApiEndpoints.walletTopupById(id)));
      if (payload is! Map<String, dynamic>) return null;
      final topup = WalletTopup.fromJson(payload);
      final previous = _topups.where((t) => t.id == id).firstOrNull;
      _upsertTopup(
        previous?.checkoutUrl == null
            ? topup
            : WalletTopup.fromJson({
                ...payload,
                'checkoutUrl': previous!.checkoutUrl,
              }),
      );
      notifyListeners();
      return topup;
    } catch (e) {
      debugPrint('[DriverWalletProvider] refreshTopup error: $e');
      return null;
    }
  }

  /// Realtime/push `paid` xabari — so'rovni kutmasdan holatni yangilaydi.
  void markTopupPaid(String id) {
    final existing = _topups.where((t) => t.id == id).firstOrNull;
    if (existing == null || existing.status == WalletTopupStatus.paid) return;
    _upsertTopup(
      existing.copyWith(status: WalletTopupStatus.paid, paidAt: DateTime.now()),
    );
    notifyListeners();
  }

  Future<void> loadShiftPass() async {
    try {
      final payload =
          _payload(await _apiClient.get(ApiEndpoints.driverShiftPass));
      if (payload is Map<String, dynamic>) {
        _shiftPass = ShiftPassInfo.fromJson(payload);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[DriverWalletProvider] loadShiftPass error: $e');
    }
  }

  Future<ShiftPassBuyResult> buyShiftPass() async {
    _isBuyingShiftPass = true;
    notifyListeners();
    try {
      final payload =
          _payload(await _apiClient.post(ApiEndpoints.driverShiftPass));
      final pass = ShiftPass.tryParse(payload);
      if (pass != null) _shiftPass = _shiftPass.withCurrent(pass);
      return const ShiftPassBuyResult(ShiftPassBuyOutcome.bought);
    } catch (e) {
      final status = e is DioException ? e.response?.statusCode : null;
      final api = ApiError.from(e);
      final message = withCodedErrorAmounts(extractErrorMessage(e), api);
      // Kod (v4) ustun; eski serverda — HTTP holati.
      if (api?.code == ApiErrorCode.shiftPassActive ||
          (api?.code == null && status == 409)) {
        await loadShiftPass();
        return ShiftPassBuyResult(ShiftPassBuyOutcome.alreadyActive, message);
      }
      if (status == 400 || (api?.code?.startsWith('SHIFT_PASS_') ?? false)) {
        return ShiftPassBuyResult(ShiftPassBuyOutcome.rejected, message);
      }
      return ShiftPassBuyResult(ShiftPassBuyOutcome.failed, message);
    } finally {
      _isBuyingShiftPass = false;
      notifyListeners();
    }
  }
}

DriverWalletProvider buildDriverWalletProvider() =>
    DriverWalletProvider(apiClient: sl<ApiClient>());
