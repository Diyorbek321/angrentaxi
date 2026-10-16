import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:flutter/foundation.dart';

/// Bosh sahifadagi "Trenddagi mahsulotlar" cheksiz lentasi.
///
/// Sahifalab yuklaydi (`GET /market/trending`). Tartibni server belgilaydi:
/// 7 kunlik sotuv, sotuv kam bo'lsa — yangi mahsulotlar (bo'lim bo'sh
/// qolmaydi). Xato bo'lsa yuklangan ro'yxat saqlanadi va keyingi urinish
/// O'SHA sahifani so'raydi — lenta tushib qolmaydi.
class TrendingProductsController extends ChangeNotifier {
  TrendingProductsController(this._api, {this.pageSize = 20});

  final ApiClient _api;
  final int pageSize;

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
        ApiEndpoints.marketTrending,
        params: {'page': _loadedPages + 1, 'limit': pageSize},
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
      debugPrint('[TrendingProducts] load failed: $e');
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
