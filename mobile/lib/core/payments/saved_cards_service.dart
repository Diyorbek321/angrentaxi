import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:dio/dio.dart';

/// Saqlangan kartalar bilan ishlashdagi xato. [message] — foydalanuvchiga
/// ko'rsatiladigan matn (server yoki Payme bergan), [code] — server kodi.
class SavedCardsException implements Exception {
  SavedCardsException(this.message, {this.code});
  final String message;
  final String? code;

  @override
  String toString() => message;
}

/// Payme SMS kodini yuborgani haqida javob.
class PaymeVerifyCodeSent {
  const PaymeVerifyCodeSent({required this.phone, required this.wait});

  /// Niqoblangan telefon (`99890*****31`).
  final String phone;

  /// Qayta yuborishgacha kutish.
  final Duration wait;
}

/// Saqlangan kartalar (docs/specs/saqlangan-kartalar.md v2).
///
/// KARTA RAQAMI BIZNING SERVERGA YUBORILMAYDI: u to'g'ridan-to'g'ri Payme
/// Subscribe API'ga ketadi (`cards.create` → `cards.get_verify_code` →
/// `cards.verify`, `X-Auth: <ommaviy merchant id>`), serverga esa faqat
/// tayyor token (`POST /payments/cards`). Payme uchun alohida [Dio] —
/// bizning auth/log interseptorlarimizsiz: JWT Payme'ga ketmasin, karta
/// raqami log'ga tushmasin.
class SavedCardsService {
  SavedCardsService({required ApiClient apiClient, Dio? paymeDio})
      : _api = apiClient,
        _payme = paymeDio ??
            Dio(BaseOptions(
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
              contentType: Headers.jsonContentType,
            ));

  final ApiClient _api;
  final Dio _payme;

  // ---------------------------------------------------------------- server

  Future<SavedCardsAvailability> availability() async {
    try {
      final res = await _api.get(ApiEndpoints.savedCardsAvailability);
      return SavedCardsAvailability.fromJson(_payload(res.data));
    } catch (_) {
      // Server eski (route yo'q) yoki tarmoq yo'q — funksiya o'chiq.
      return const SavedCardsAvailability.disabled();
    }
  }

  Future<List<SavedCard>> list() async {
    try {
      final res = await _api.get(ApiEndpoints.savedCards);
      final raw = _unwrap(res.data);
      final items = raw is List ? raw : const <dynamic>[];
      return items
          .whereType<Map<String, dynamic>>()
          .map(SavedCard.fromJson)
          .toList(growable: false);
    } catch (e) {
      throw _serverError(e);
    }
  }

  Future<SavedCard> save(String token) async {
    try {
      final res =
          await _api.post(ApiEndpoints.savedCards, data: {'token': token});
      return SavedCard.fromJson(_payload(res.data));
    } catch (e) {
      throw _serverError(e);
    }
  }

  Future<SavedCard> setDefault(String id) async {
    try {
      final res = await _api.patch(ApiEndpoints.savedCardDefault(id));
      return SavedCard.fromJson(_payload(res.data));
    } catch (e) {
      throw _serverError(e);
    }
  }

  Future<void> remove(String id) async {
    try {
      await _api.delete(ApiEndpoints.savedCardById(id));
    } catch (e) {
      throw _serverError(e);
    }
  }

  // ----------------------------------------------------------------- Payme

  /// Kartani Payme'da yaratadi; token qaytaradi (hali tasdiqlanmagan).
  /// [number] — 16 raqam, [expire] — `MMYY`.
  Future<String> paymeCreateCard(
    SavedCardsAvailability config, {
    required String number,
    required String expire,
  }) async {
    final result = await _paymeCall(config, 'cards.create', {
      'card': {'number': number, 'expire': expire},
      'save': true,
    });
    final token =
        (result['card'] as Map<String, dynamic>?)?['token'] as String?;
    if (token == null || token.isEmpty) {
      throw SavedCardsException('Payme: card token missing');
    }
    return token;
  }

  Future<PaymeVerifyCodeSent> paymeSendCode(
    SavedCardsAvailability config,
    String token,
  ) async {
    final result =
        await _paymeCall(config, 'cards.get_verify_code', {'token': token});
    final waitMs = result['wait'];
    return PaymeVerifyCodeSent(
      phone: (result['phone'] as String?) ?? '',
      wait: Duration(milliseconds: waitMs is num ? waitMs.toInt() : 60000),
    );
  }

  /// SMS kodini tasdiqlaydi; muvaffaqiyatli bo'lsa tokenni qaytaradi.
  Future<String> paymeVerify(
    SavedCardsAvailability config, {
    required String token,
    required String code,
  }) async {
    final result = await _paymeCall(
        config, 'cards.verify', {'token': token, 'code': code});
    final card = result['card'] as Map<String, dynamic>?;
    if (card?['verify'] != true) {
      throw SavedCardsException('Payme: card not verified');
    }
    return (card?['token'] as String?) ?? token;
  }

  Future<Map<String, dynamic>> _paymeCall(
    SavedCardsAvailability config,
    String method,
    Map<String, dynamic> params,
  ) async {
    if (!config.enabled || config.apiUrl == null || config.merchantId == null) {
      throw SavedCardsException('Saved cards are not available');
    }
    try {
      final res = await _payme.post<dynamic>(
        config.apiUrl!,
        data: {
          'id': DateTime.now().millisecondsSinceEpoch,
          'method': method,
          'params': params
        },
        options: Options(headers: {'X-Auth': config.merchantId}),
      );
      final body = res.data;
      if (body is! Map<String, dynamic>) {
        throw SavedCardsException('Payme: unexpected response');
      }
      final error = body['error'];
      if (error is Map<String, dynamic>) {
        throw SavedCardsException(
            _paymeMessage(error['message']) ?? 'Payme error ${error['code']}');
      }
      final result = body['result'];
      if (result is! Map<String, dynamic>) {
        throw SavedCardsException('Payme: empty result');
      }
      return result;
    } on SavedCardsException {
      rethrow;
    } on DioException catch (e) {
      // Faqat tur — so'rov tanasi (karta raqami) xabarga tushmasin.
      throw SavedCardsException('Payme: ${e.type.name}');
    }
  }

  /// Payme xabari satr yoki `{ru, uz, en}` bo'lishi mumkin.
  static String? _paymeMessage(dynamic message) {
    if (message is String && message.isNotEmpty) return message;
    if (message is Map) {
      for (final lang in const ['uz', 'ru', 'en']) {
        final value = message[lang];
        if (value is String && value.isNotEmpty) return value;
      }
    }
    return null;
  }

  // --------------------------------------------------------------- helpers

  static dynamic _unwrap(dynamic body) =>
      body is Map<String, dynamic> && body.containsKey('data')
          ? body['data']
          : body;

  static Map<String, dynamic> _payload(dynamic body) {
    final value = _unwrap(body);
    if (value is Map<String, dynamic>) return value;
    throw SavedCardsException('Unexpected response');
  }

  static SavedCardsException _serverError(Object e) {
    if (e is SavedCardsException) return e;
    return SavedCardsException(extractErrorMessage(e),
        code: ApiError.from(e)?.code);
  }
}
