import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:flutter/foundation.dart';

enum FavoritesProviderState { idle, loading, success, error }

/// Passenger's saved addresses ("Uy"/"Ish"/etc), backed by
/// `GET/POST/DELETE /users/favorite-addresses`
/// (backend/src/modules/favorites/favorites.controller.ts). Same conventions
/// as OrderProvider/DriverProvider: a ChangeNotifier constructed with an
/// injected ApiClient, built via [buildFavoritesProvider] from the service
/// locator for the app's provider tree.
class FavoritesProvider extends ChangeNotifier {
  FavoritesProvider({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  FavoritesProviderState _state = FavoritesProviderState.idle;
  String? _error;
  List<FavoriteAddress> _favorites = [];

  FavoritesProviderState get state => _state;
  String? get error => _error;
  List<FavoriteAddress> get favorites => List.unmodifiable(_favorites);

  void _setState(FavoritesProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadFavorites() async {
    _setState(FavoritesProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.favoriteAddresses);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _favorites = list
          .map((e) => FavoriteAddress.fromJson(e as Map<String, dynamic>))
          .toList();
      _setState(FavoritesProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(FavoritesProviderState.error);
    }
  }

  Future<bool> addFavorite({
    required String label,
    required String address,
    required double lat,
    required double lng,
  }) async {
    try {
      final response = await _apiClient.post(
        ApiEndpoints.favoriteAddresses,
        data: {
          'label': label,
          'address': address,
          'lat': lat,
          'lng': lng,
        },
      );
      final data = response.data as Map<String, dynamic>;
      final favorite =
          FavoriteAddress.fromJson(data['data'] as Map<String, dynamic>);
      _favorites = [favorite, ..._favorites];
      notifyListeners();
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> removeFavorite(String id) async {
    try {
      await _apiClient.delete(ApiEndpoints.favoriteAddressById(id));
      _favorites = _favorites.where((f) => f.id != id).toList();
      notifyListeners();
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    if (_state == FavoritesProviderState.error) {
      _setState(FavoritesProviderState.idle);
    }
  }
}

FavoritesProvider buildFavoritesProvider() => FavoritesProvider(
      apiClient: sl<ApiClient>(),
    );
