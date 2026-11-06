import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:flutter/foundation.dart';

/// Market mahsulotlarining sahifalangan, cheksiz lentasi — `{items, hasMore}`
/// qaytaradigan har qanday endpoint uchun:
///  · bosh sahifadagi "Trenddagi mahsulotlar" (`GET /market/trending`, sukut);
///  · market sahifasidagi qidiruv (`GET /market/products/search`, `q` bilan).
///
/// Tartibni server belgilaydi. Xato bo'lsa yuklangan ro'yxat saqlanadi va
/// keyingi urinish O'SHA sahifani so'raydi — lenta tushib qolmaydi.
class ProductFeedController extends ChangeNotifier {
  ProductFeedController(
    this._api, {
    this.pageSize = 20,
    this.endpoint = ApiEndpoints.marketTrending,
    this.extraParams = const {},
  });

  final ApiClient _api;
  final int pageSize;
  final String endpoint;

  /// Har so'rovga qo'shiladi (masalan qidiruvda `{'q': ...}`).
  final Map<String, dynamic> extraParams;

  final List<MarketProduct> _items = [];
  final Set<String> _ids = {};
  int _loadedPages = 0;
  bool _hasMore = true;
  bool _loading = false;
  bool _hasError = false;

  List<MarketProduct> get items => List.unmodifiable(_items);
  bool get hasMore => _hasMore;
  bool get isLoading => _loading;
  bool get hasError => _hasError;

  /// Hali hech narsa yuklanmagan va yuklanayapti — skelet ko'rsatiladi.
  bool get isFirstLoad => _loading && _items.isEmpty;

  Future<void> loadMore() async {
    if (_loading || !_hasMore) return;
    _loading = true;
    notifyListeners();
    try {
      final response = await _api.get(
        endpoint,
        params: {...extraParams, 'page': _loadedPages + 1, 'limit': pageSize},
      );
      final body = response.data as Map<String, dynamic>;
      final data = body['data'] as Map<String, dynamic>;
      final raw = (data['items'] as List<dynamic>?) ?? const [];
      for (final json in raw) {
        final product = MarketProduct.fromJson(json as Map<String, dynamic>);
        // Sahifalar orasida tartib o'zgarishi mumkin (yangi sotuv) — takror yo'q.
        if (_ids.add(product.id)) _items.add(product);
      }
      _loadedPages += 1;
      _hasMore = data['hasMore'] == true && raw.isNotEmpty;
      _hasError = false;
    } catch (e) {
      debugPrint('[ProductFeed] $endpoint load failed: $e');
      _hasError = true;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    _items.clear();
    _ids.clear();
    _loadedPages = 0;
    _hasMore = true;
    _hasError = false;
    await loadMore();
  }
}
