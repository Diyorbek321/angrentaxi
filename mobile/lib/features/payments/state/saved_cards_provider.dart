import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:flutter/foundation.dart';

/// Yo'lovchining saqlangan kartalari: hamyon ekrani, kartalar ekrani va
/// tarif ekranidagi "Karta" chipi shu holatni o'qiydi.
///
/// [availability] o'chiq bo'lsa — ilova eski oqimni ko'rsatadi (karta
/// bog'lash mavjud emas, karta safari Payme sahifasi orqali to'lanadi).
class SavedCardsProvider extends ChangeNotifier {
  SavedCardsProvider({required SavedCardsService service}) : _service = service;

  final SavedCardsService _service;

  SavedCardsService get service => _service;

  SavedCardsAvailability _availability =
      const SavedCardsAvailability.disabled();
  SavedCardsAvailability get availability => _availability;
  bool get isEnabled => _availability.enabled;

  List<SavedCard> _cards = const [];
  List<SavedCard> get cards => _cards;

  bool _loading = false;
  bool get isLoading => _loading;

  bool _loaded = false;

  /// Hech bo'lmasa bir marta muvaffaqiyatli yuklanganmi.
  bool get isLoaded => _loaded;

  String? _error;
  String? get error => _error;

  /// Avtomatik yechiladigan karta (server bilan bir xil qoida — asosiy).
  SavedCard? get defaultCard {
    for (final card in _cards) {
      if (card.isDefault) return card;
    }
    return null;
  }

  /// Avval [availability], yoqilgan bo'lsa — kartalar ro'yxati.
  Future<void> load() async {
    if (_loading) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _availability = await _service.availability();
      _cards = _availability.enabled ? await _service.list() : const [];
      _loaded = true;
    } on SavedCardsException catch (e) {
      _error = e.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Faqat hali yuklanmagan bo'lsa (tarif ekrani har ochilganda so'ramasin).
  Future<void> ensureLoaded() => _loaded ? Future.value() : load();

  /// Yangi kartani ro'yxatga qo'shadi (server javobi bo'yicha).
  void addCard(SavedCard card) {
    final others = _cards.where((c) => c.id != card.id);
    final normalized = card.isDefault
        ? others.map((c) => c.copyWith(isDefault: false))
        : others;
    _cards = List.unmodifiable([card, ...normalized]);
    notifyListeners();
  }

  /// Xato — [SavedCardsException]; ro'yxat serverdan qayta o'qiladi
  /// (asosiy karta server tomonda boshqasiga o'tgan bo'lishi mumkin).
  Future<void> remove(String id) async {
    await _service.remove(id);
    _cards = List.unmodifiable(await _service.list());
    notifyListeners();
  }

  Future<void> setDefault(String id) async {
    await _service.setDefault(id);
    _cards =
        List.unmodifiable(_cards.map((c) => c.copyWith(isDefault: c.id == id)));
    notifyListeners();
  }
}

SavedCardsProvider buildSavedCardsProvider() =>
    SavedCardsProvider(service: SavedCardsService(apiClient: sl<ApiClient>()));
