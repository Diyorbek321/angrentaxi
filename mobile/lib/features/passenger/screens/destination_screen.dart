import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/map_picker_screen.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_action_row.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

// ============================================================================
// MANZIL TANLASH EKRANI — QATLAMLI YUZA (Yandex Go tuzilma tili).
//
// Ekran foni `kSurface2`, mazmun bloklari esa oq `AgSurfaceCard` — ikkalasi
// BIRGA ishlatiladi, chunki oq karta oq fonda ajralmaydi. Bloklar chegara
// bilan emas, YUZA farqi bilan guruhlanadi: bu ekranda 4 tagacha blok bor
// va har biriga ramka chizilsa ko'z mazmunni emas, to'rni o'qiy boshlaydi.
//
// ⚠️ IKKI NUQTA — IKKI XIL GLIF (`AgRoutePanel` bilan bir xil qoida):
//   "qayerdan"  → `kPrimary` DOIRA,
//   to'xtash    → `kInk` KVADRAT (ichida marshrutdagi tartib raqami).
// Rang yolg'iz farq bo'lib qolmasligi kerak (WCAG 1.4.1).
//
// NEGA `AgRoutePanel` TO'G'RIDAN-TO'G'RI ISHLATILMADI: u qat'iy IKKI qatorli
// ("qayerdan" + "qayerga"), qatorlar `String` qabul qiladi va har birida
// bittadan `onTap` bor. Bu ekranda esa qatorlar soni o'zgaruvchan (olinish
// nuqtasi + 5 tagacha to'xtash), har bir to'xtash qatorida alohida "olib
// tashlash" tugmasi bor va "qayerga" qatori umuman yo'q — u aynan shu
// ekranda TANLANAYOTGAN narsa. Komponentni bunga moslash uchun uni
// o'zgartirish kerak bo'lardi (Faza 1 fayllariga tegilmaydi), shuning uchun
// bu yerda faqat uning GLIF TILI takrorlanadi.
// ============================================================================

// ---------------------------------------------------------------------------
// O'LCHAMLAR
//
// Bular dizayn shkalasining tokenlari emas — aynan shu ekranning
// geometriyasi, shuning uchun mahalliy konstantalarda yashaydi (xuddi
// `ag_route_panel.dart` dagidek). Har biri sababi bilan yozilgan: keyingi
// o'quvchi raqamni "shunchaki chiroyli" deb o'zgartirmasligi kerak.
// ---------------------------------------------------------------------------

/// Marshrut ustunining kengligi. Eng katta glif (raqamli to'xtash kvadrati)
/// shu ustunga sig'adi, boshlanish doirasi esa uning MARKAZIDA turadi —
/// shunda ikkala glif bitta vertikal o'qda o'qiladi va qatorlar "marshrut
/// ustuni" bo'lib ko'rinadi.
const double _kGlyphColumn = 18;

/// Boshlanish nuqtasi glifi — `AgRoutePanel._FromGlyph` bilan bir xil o'lcham.
const double _kFromGlyphSize = 9;

/// To'xtash glifi. Nuqtadan katta, chunki ICHIDA marshrutdagi tartib raqami
/// turadi (olinish nuqtasi — 1, birinchi to'xtash — 2 ...).
const double _kStopGlyphSize = 18;

/// 18dp kvadrat uchun 4dp burchak — shakl kvadratligicha qoladi, lekin
/// doira yonida "kesilgan" ko'rinmaydi.
const double _kStopGlyphCorner = 4;

/// Marshrut qatorining MINIMAL balandligi (qat'iy emas): ikki qatorli matn
/// (manzil + izoh) tizim shrifti kattalashtirilganda o'sishga haqli.
const double _kRouteRowHeight = 56;

/// Manzil matni boshlanadigan chekinish — qator chekinishi + glif ustuni +
/// oradagi bo'shliq. Ajratkich ham shu masofadan boshlanadi, ya'ni glif
/// ustuni uzluksiz qoladi.
const double _kRouteTextInset = kSpace4 + _kGlyphColumn + kSpace3;

/// Taklif/saqlangan manzil qatorining minimal balandligi. 52dp — 48dp
/// tegish nishonidan yuqori, lekin `ListTile` ning 72dp lik ikki qatorli
/// balandligidan sezilarli past: bu ekranda klaviatura ochiq turadi va har
/// bir piksel ro'yxatga ketishi kerak.
const double _kPlaceRowHeight = 52;

/// Ro'yxat qatoridagi ikonka qutisi va uning ichidagi ikonka.
const double _kPlaceIconBox = 32;
const double _kPlaceIconSize = 18;

/// Ajratkich chekinishi: qator chekinishi + ikonka qutisi + bo'shliq.
const double _kPlaceTextInset = kSpace3 + _kPlaceIconBox + kSpace3;

/// Marshrut kartasi egallashi mumkin bo'lgan eng katta ulush.
///
/// 5 tagacha to'xtash qo'shilganda karta 6 qatorga (~336dp) yetadi. Bu
/// ekranda klaviatura DOIM ochiq — qisqa telefonda ustidan qoladigan joy
/// ~430dp, ya'ni karta qidiruv maydonini ham, natijalar ro'yxatini ham
/// ekrandan itarib yuborardi (eski `ListTile` variantida 223dp toshib
/// ketardi). Shuning uchun karta mavjud balandlikning 40% idan oshmaydi va
/// undan keyin ICHIDA suriladi: cheksiz o'sadigan yagona blok — to'xtashlar
/// ro'yxati, qidiruv va natijalar esa hech qachon yo'qolmaydi.
const double _kRouteCardMaxFraction = 0.4;

/// Qidiruv maydoni va amal tugmalari chegarasining qalinligi. `AgActionRow`
/// ham 1.5 ishlatadi — ikkalasi yonma-yon turgani uchun bir xil bo'lishi
/// kerak, aks holda biri "faolroq" ko'rinadi.
const double _kBorderWidth = 1.5;

class _AddressSuggestion {
  const _AddressSuggestion({
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String address;
  final double lat;
  final double lng;
}

class DestinationScreen extends StatefulWidget {
  const DestinationScreen({super.key, this.isSavingFavorite = false});

  /// When true, this screen was opened from home_screen's "Qo'shish" tile to
  /// pick a *new* location to save as a favorite, rather than to start an
  /// order. In this mode, selecting a search result or map-picker result
  /// prompts for a label and calls [FavoritesProvider.addFavorite] instead
  /// of navigating to the tariff screen. Defaults to false so the normal
  /// search-and-order flow is unaffected.
  final bool isSavingFavorite;

  @override
  State<DestinationScreen> createState() => _DestinationScreenState();
}

class _DestinationScreenState extends State<DestinationScreen> {
  final _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  List<_AddressSuggestion> _suggestions = [];
  bool _isSearching = false;
  String? _searchError;

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _resolvePickupAddress();
      context.read<FavoritesProvider>().loadFavorites();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // The pickup arrives here as raw GPS coordinates with a placeholder
  // address ("Joylashuv aniqlanmoqda...", set by home_screen's
  // _onWhereToTap). Resolve a real street address for it so the pickup row
  // doesn't just show that placeholder forever.
  Future<void> _resolvePickupAddress() async {
    final provider = context.read<OrderProvider>();
    final pickup = provider.pendingPickup;
    if (pickup == null || pickup.address != 'Joylashuv aniqlanmoqda...') return;

    try {
      final placemarks = await placemarkFromCoordinates(pickup.lat, pickup.lng)
          .timeout(const Duration(seconds: 6));
      if (!mounted || placemarks.isEmpty) return;
      final p = placemarks.first;
      final addr = [p.street, p.subLocality, p.locality]
          .where((e) => e != null && e.isNotEmpty)
          .join(', ');
      if (addr.isNotEmpty) {
        provider.setPendingPickup(
          OrderLocation(address: addr, lat: pickup.lat, lng: pickup.lng),
        );
      }
    } catch (_) {
      // Keep the placeholder — not worth surfacing an error for this.
    }
  }

  Future<void> _openMapPicker({
    required String title,
    required LatLng? initial,
    required ValueChanged<OrderLocation> onPicked,
  }) async {
    // Boshlang'ich nuqta noma'lum bo'lsa xarita birinchi faol shahar
    // markazidan ochiladi — qamrov ro'yxati hali kelmagan bo'lsa
    // `fallbackCenter` eski `AppConfig` qiymatiga qaytadi, ya'ni xarita
    // baribir ochiladi.
    final fallback = context.read<OrderProvider>().coverage.fallbackCenter;
    final result = await Navigator.of(context).push<OrderLocation>(
      MaterialPageRoute<OrderLocation>(
        builder: (_) => MapPickerScreen(
          title: title,
          initialLocation: initial ?? fallback,
        ),
      ),
    );
    if (result != null) onPicked(result);
  }

  Future<void> _onSearchChanged(String query) async {
    if (query.length < 3) {
      setState(() {
        _suggestions = [];
        _searchError = null;
      });
      return;
    }

    setState(() {
      _isSearching = true;
      _searchError = null;
    });

    try {
      final locations = await locationFromAddress(
        '$query, Angren, Uzbekistan',
      ).timeout(const Duration(seconds: 5));

      if (!mounted) return;

      final suggestions = <_AddressSuggestion>[];
      for (final loc in locations.take(5)) {
        final placemarks = await placemarkFromCoordinates(
          loc.latitude,
          loc.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          final addr = [
            p.street,
            p.subLocality,
            p.locality,
          ].where((e) => e != null && e.isNotEmpty).join(', ');
          suggestions.add(
            _AddressSuggestion(
              address: addr.isEmpty ? query : addr,
              lat: loc.latitude,
              lng: loc.longitude,
            ),
          );
        }
      }

      if (mounted) {
        setState(() {
          _suggestions = suggestions;
          _isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSearching = false;
          _searchError = 'Manzilni topib bo\'lmadi';
          _suggestions = [];
        });
      }
    }
  }

  void _selectSuggestion(_AddressSuggestion suggestion) {
    _selectLocation(
      OrderLocation(
        address: suggestion.address,
        lat: suggestion.lat,
        lng: suggestion.lng,
      ),
    );
  }

  void _selectLocation(OrderLocation location) {
    if (widget.isSavingFavorite) {
      _promptSaveFavorite(location);
      return;
    }
    context.read<OrderProvider>().setPendingDropoff(location);
    Navigator.of(context).pushNamed('/passenger/tariff');
  }

  /// Asks for a label ("Uy"/"Ish"/custom) and saves [location] via
  /// [FavoritesProvider.addFavorite], then pops back to wherever
  /// [DestinationScreen] was opened from (home_screen's "Qo'shish" tile).
  Future<void> _promptSaveFavorite(OrderLocation location) async {
    final labelController = TextEditingController();
    final label = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Manzilni saqlash'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                location.address,
                style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
              ),
              const SizedBox(height: kSpace4),
              Wrap(
                spacing: kSpace2,
                children: [
                  ActionChip(
                    label: const Text('Uy'),
                    onPressed: () => Navigator.of(ctx).pop('Uy'),
                  ),
                  ActionChip(
                    label: const Text('Ish'),
                    onPressed: () => Navigator.of(ctx).pop('Ish'),
                  ),
                ],
              ),
              const SizedBox(height: kSpace4),
              TextField(
                controller: labelController,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: "Nomi (masalan, Bozor)",
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Bekor qilish'),
            ),
            TextButton(
              onPressed: () =>
                  Navigator.of(ctx).pop(labelController.text.trim()),
              child: const Text('Saqlash'),
            ),
          ],
        );
      },
    );

    if (label == null || label.isEmpty || !mounted) return;

    final favoritesProvider = context.read<FavoritesProvider>();
    final success = await favoritesProvider.addFavorite(
      label: label,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
    );

    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(favoritesProvider.error ?? 'Manzilni saqlab bo\'lmadi'),
        ),
      );
    }
  }

  /// Qator o'ng chekkasidagi "bosishdan oldingi javob": olinish nuqtasidan
  /// shu manzilgacha TO'G'RI CHIZIQLI masofa.
  ///
  /// ⚠️ Bu TAXMINIY yo'l-yo'riq, narx emas. Safar uzunligi va narxi baribir
  /// tarif ekranidagi OSRM marshruti bo'yicha hisoblanadi — shuning uchun
  /// yozuv oldida "~" turadi va u `kInkMuted` bilan ikkinchi darajada
  /// beriladi. Hisob mahalliy (`latlong2`), qo'shimcha tarmoq so'rovi yo'q,
  /// ya'ni ro'yxat qatorini ko'rsatish hech narsani sekinlashtirmaydi.
  String? _airDistanceLabel(OrderLocation? pickup, double lat, double lng) {
    if (pickup == null) return null;
    final meters = const Distance().as(
      LengthUnit.Meter,
      LatLng(pickup.lat, pickup.lng),
      LatLng(lat, lng),
    );
    return '~${Formatters.formatDistance(meters)}';
  }

  @override
  Widget build(BuildContext context) {
    // Faqat `pendingPickup` kuzatiladi: `OrderProvider` soket yangilanishlari
    // bilan tez-tez xabar beradi, ro'yxatdagi masofa esa faqat olinish
    // nuqtasi o'zgarganda qayta hisoblanishi kerak.
    //
    // Tanlov aynan SHU YERDA olinadi, `LayoutBuilder` ichida emas: uning
    // `builder` i layout bosqichida ishlaydi va o'sha paytda `context.select`
    // chaqirish taqiqlangan (provider "widget daraxtidan tashqarida" deb
    // xato beradi).
    final pickup = context.select<OrderProvider, OrderLocation?>(
      (provider) => provider.pendingPickup,
    );

    return Scaffold(
      // Qatlamli til: ekran foni `kSurface2`, ustidagi bloklar oq karta.
      backgroundColor: kSurface2,
      appBar: AppBar(
        title: Text(
          widget.isSavingFavorite ? 'Manzilni saqlash' : 'Manzilni kiriting',
        ),
        // AppBar ham fon rangida — sarlavha va mazmun bitta uzluksiz
        // yuzada turadi, ekran tepasida ortiqcha "chegara" paydo bo'lmaydi.
        backgroundColor: kSurface2,
        // Material 3 kontent ostidan surilganda AppBar ni birlamchi rang
        // bilan bo'yaydi — bu qatlamli fonni buzardi.
        surfaceTintColor: kSurface2,
        scrolledUnderElevation: 0,
        foregroundColor: kInk,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Orqaga',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          return Column(
            children: [
              // The route card edits OrderProvider.pendingPickup/waypoints,
              // which is meaningless while just picking a location to save as
              // a favorite — hidden in that mode.
              if (!widget.isSavingFavorite)
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: constraints.maxHeight * _kRouteCardMaxFraction,
                  ),
                  child: SingleChildScrollView(child: _buildRouteCard()),
                ),
              _buildSearchField(),
              _buildActions(),
              Expanded(child: _buildContent(pickup)),
            ],
          );
        },
      ),
    );
  }

  /// Marshrut kartasi: olinish nuqtasi + qo'shilgan to'xtashlar bitta oq
  /// yuzada. Ilgari bular ekran bo'ylab sochilgan `ListTile` lar edi va
  /// ular orasidagi bog'liqlik faqat joylashuvdan sezilardi.
  Widget _buildRouteCard() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, 0),
      child: AgSurfaceCard(
        // Qatorlar kartaning butun kengligini egallaydi (tegish maydoni
        // kengroq bo'ladi), gorizontal chekinish qator ichida beriladi.
        padding: const EdgeInsets.symmetric(vertical: kSpace1),
        child: _cardRows([
          _buildPickupRow(),
          _buildWaypointsList(),
        ]),
      ),
    );
  }

  Widget _buildPickupRow() {
    return Consumer<OrderProvider>(
      builder: (context, provider, _) {
        final pickup = provider.pendingPickup;
        final address = pickup?.address ?? 'Joriy joylashuv';
        return _RouteRow(
          // `kPrimary` DOIRA — boshlanish nuqtasi.
          glyph: const _FromGlyph(),
          title: address,
          caption: 'Qayerdan',
          semanticsLabel: 'Qayerdan: $address. O\'zgartirish',
          trailing: const ExcludeSemantics(
            child: Icon(
              Icons.edit_location_alt_outlined,
              color: kInkMuted,
              size: 20,
            ),
          ),
          onTap: () => _openMapPicker(
            title: 'Qayerdan',
            initial: pickup != null ? LatLng(pickup.lat, pickup.lng) : null,
            onPicked: provider.setPendingPickup,
          ),
        );
      },
    );
  }

  /// Shows the intermediate stops already added to this order (via
  /// [OrderProvider.addWaypoint]), each with a remove icon wired to
  /// [OrderProvider.removeWaypoint]. Sits directly under the pickup row in
  /// the route card so the whole route reads as one column. Hidden entirely
  /// once there are no waypoints.
  Widget _buildWaypointsList() {
    return Consumer<OrderProvider>(
      builder: (context, provider, _) {
        final waypoints = provider.pendingWaypoints;
        if (waypoints.isEmpty) return const SizedBox.shrink();

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < waypoints.length; i++) ...[
              const _RouteDivider(),
              _RouteRow(
                // `kInk` KVADRAT — to'xtash. Boshlanish doirasi bilan hech
                // qachon bir xil glif emas; ichidagi raqam esa marshrutdagi
                // o'rnini beradi (olinish nuqtasi — 1, ya'ni birinchi
                // to'xtash — 2).
                glyph: _StopGlyph(order: i + 2),
                title: waypoints[i].address,
                caption: "To'xtash",
                // Qator o'zi bosilmaydi (faqat o'chirish tugmasi bor),
                // shuning uchun matn semantikasi o'z holicha o'qiladi.
                trailing: IconButton(
                  icon: const Icon(
                    Icons.close_rounded,
                    color: kInkMuted,
                    size: 20,
                  ),
                  tooltip: "To'xtashni olib tashlash",
                  constraints: const BoxConstraints(
                    minWidth: kMinTapTarget,
                    minHeight: kMinTapTarget,
                  ),
                  onPressed: () => provider.removeWaypoint(i),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  /// Qidiruv maydoni — ekranning asosiy kirish nuqtasi.
  ///
  /// Chegara `kLineInteractive` (`kLine` EMAS): oq maydon `kSurface2` fonda
  /// atigi 1.12:1, ya'ni to'ldirish yolg'iz boshqaruv chegarasini ko'rsata
  /// olmaydi. WCAG 1.4.11 boshqaruvni ANIQLASH uchun 3:1 talab qiladi;
  /// `kLine` (1.22:1) bezak ajratkichi, `kLineInteractive` esa 3.67:1.
  Widget _buildSearchField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, 0),
      // Matn kiritilganda "tozalash" tugmasi, fokus olinganda esa chegara
      // rangi o'zgarishi kerak — ikkala manba ham shu yerda tinglanadi.
      child: AnimatedBuilder(
        animation: Listenable.merge([_focusNode, _searchController]),
        builder: (context, _) {
          final focused = _focusNode.hasFocus;
          return Container(
            constraints: const BoxConstraints(minHeight: kControlHeight),
            padding: const EdgeInsets.symmetric(horizontal: kSpace3),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRadiusMd),
              // Qalinlik fokusda ham o'zgarmaydi — faqat rang: aks holda
              // ichkari o'lcham 1dp ga o'zgarib, matn "sakrab" ketardi.
              border: Border.all(
                color: focused ? kPrimary : kLineInteractive,
                width: _kBorderWidth,
              ),
            ),
            child: Row(
              children: [
                const ExcludeSemantics(
                  child: Icon(Icons.search_rounded, color: kInkMuted, size: 20),
                ),
                const SizedBox(width: kSpace3),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    focusNode: _focusNode,
                    style: TextStyle(
                      fontSize: context.fs(kFontBodyLg),
                      color: kInk,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Ko\'cha, mahalla, joy nomi...',
                      // Ko'rsatma matni KICHIK — `kInkSubtle` (3.67:1) AA
                      // dan past, shuning uchun `kInkMuted` (5.47:1).
                      hintStyle: TextStyle(
                        fontSize: context.fs(kFontBodyLg),
                        color: kInkMuted,
                      ),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.search,
                    onChanged: _onSearchChanged,
                  ),
                ),
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear, color: kInkMuted),
                    tooltip: 'Tozalash',
                    constraints: const BoxConstraints(
                      minWidth: kMinTapTarget,
                      minHeight: kMinTapTarget,
                    ),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _suggestions = [];
                        _searchError = null;
                      });
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// "Xaritadan tanlash" va "To'xtash qo'shish" — bir darajadagi ikki
  /// muqobil kirish usuli, shuning uchun `AgActionRow` da TENG KENGLIKDA
  /// yonma-yon turadi.
  ///
  /// Ilgari ikkalasi ikki qatorli `ListTile` edi (~144dp). Bu ekranda
  /// klaviatura DOIM ochiq (`initState` fokus so'raydi), ya'ni ro'yxatga
  /// qoladigan joy juda tor — qator 52dp ga tushib, ~90dp natijalar
  /// ro'yxatiga qaytdi. Yo'qolgan izoh matnlari ("Manzilni xaritada
  /// belgilang") ortiqcha edi: ular yorliqdagi ma'noni takrorlardi.
  Widget _buildActions() {
    return Consumer<OrderProvider>(
      builder: (context, provider, _) {
        final pickup = provider.pendingPickup;
        final initial =
            pickup != null ? LatLng(pickup.lat, pickup.lng) : null;
        // To'xtash faqat oddiy buyurtma oqimida va limitga yetmaguncha
        // ma'noli — sevimli manzil saqlashda oraliq nuqta yo'q.
        final canAddStop = !widget.isSavingFavorite &&
            provider.pendingWaypoints.length < OrderProvider.maxWaypoints;

        return Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, 0),
          child: AgActionRow(
            items: [
              AgActionItem(
                icon: Icons.map_outlined,
                label: 'Xaritadan tanlash',
                onTap: () => _openMapPicker(
                  title: 'Qayerga',
                  initial: initial,
                  onPicked: _selectLocation,
                ),
              ),
              if (canAddStop)
                AgActionItem(
                  icon: Icons.add_location_alt_outlined,
                  label: "To'xtash qo'shish",
                  onTap: () => _openMapPicker(
                    title: "To'xtash nuqtasi",
                    initial: initial,
                    onPicked: provider.addWaypoint,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  /// Manzil takliflari uch holatga ega: yuklanmoqda (skeleton, spinner
  /// emas) - xato - bo'sh.
  Widget _buildContent(OrderLocation? pickup) {
    if (_isSearching) {
      return const AppSkeletonList(itemCount: 4, lines: 2);
    }

    if (_searchError != null) {
      return AppErrorState(
        message: _searchError!,
        onRetry: () => _onSearchChanged(_searchController.text),
      );
    }

    if (_suggestions.isEmpty && _searchController.text.length >= 3) {
      return const AppEmptyState(
        icon: Icons.search_off_rounded,
        title: 'Natija topilmadi',
      );
    }

    if (_suggestions.isEmpty) {
      return _buildRecentPlaces(pickup);
    }

    return _buildSuggestionsList(pickup);
  }

  Widget _buildSuggestionsList(OrderLocation? pickup) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace4),
      children: [
        AgSurfaceCard(
          padding: EdgeInsets.zero,
          child: _cardRows([
            for (var i = 0; i < _suggestions.length; i++) ...[
              if (i > 0) const _PlaceDivider(),
              _PlaceRow(
                icon: Icons.location_on_outlined,
                iconColor: kInkMuted,
                title: _suggestions[i].address,
                // O'ng chekkadagi javob: bosishdan OLDIN "bu qanchalik
                // uzoq?" savoliga taxminiy javob beriladi.
                trailingLabel: _airDistanceLabel(
                  pickup,
                  _suggestions[i].lat,
                  _suggestions[i].lng,
                ),
                onTap: () => _selectSuggestion(_suggestions[i]),
              ),
            ],
          ]),
        ),
      ],
    );
  }

  Widget _buildRecentPlaces(OrderLocation? pickup) {
    return Consumer<FavoritesProvider>(
      builder: (context, favoritesProvider, _) {
        final favorites = favoritesProvider.favorites;
        if (favorites.isEmpty) {
          return const SizedBox.shrink();
        }

        return ListView(
          padding:
              const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace4),
          children: [
            const Padding(
              padding: EdgeInsets.only(left: kSpace1, bottom: kSpace2),
              child: Text(
                'Saqlangan manzillar',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  // Kichik sarlavha — `kInkSubtle` emas, `kInkMuted`.
                  color: kInkMuted,
                  fontSize: kFontLabel,
                ),
              ),
            ),
            AgSurfaceCard(
              padding: EdgeInsets.zero,
              child: _cardRows([
                for (var i = 0; i < favorites.length; i++) ...[
                  if (i > 0) const _PlaceDivider(),
                  _buildFavoriteRow(favorites[i], pickup),
                ],
              ]),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFavoriteRow(FavoriteAddress favorite, OrderLocation? pickup) {
    return _PlaceRow(
      icon: favorite.icon,
      iconColor: favorite.color,
      title: favorite.label,
      subtitle: favorite.address,
      trailingLabel: _airDistanceLabel(pickup, favorite.lat, favorite.lng),
      onTap: () => _selectSuggestion(
        _AddressSuggestion(
          address: favorite.address,
          lat: favorite.lat,
          lng: favorite.lng,
        ),
      ),
    );
  }
}

/// Karta ICHIDAGI qatorlar ustuni.
///
/// `ClipRRect` bezak emas, MAJBURIY: qator ripple'i to'g'ri to'rtburchak
/// bo'lib tarqaladi (`AppPressable` ga `BorderRadius.zero` beriladi, chunki
/// qator kartaning butun kengligini egallaydi), karta esa `kRadiusMd` (16dp)
/// yumaloq. Kesilmasa birinchi/oxirgi qator bosilganda ripple burchaklardan
/// TASHQARIGA chiqadi va oq karta bir lahzaga kvadrat bo'lib ko'rinadi —
/// `AgRoutePanel` aynan shu sababdan `Clip.antiAlias` ishlatadi. `AgSurfaceCard`
/// o'zi kesmaydi (unga tegilmaydi), shuning uchun kesish shu yerda beriladi.
Widget _cardRows(List<Widget> rows) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(kRadiusMd),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    ),
  );
}

// ---------------------------------------------------------------------------
// MARSHRUT QATORI VA GLIFLARI
//
// `AgRoutePanel` ning glif tili shu yerda takrorlanadi (nega komponentning
// o'zi ishlatilmagani fayl boshidagi izohda). Glif SHAKLI — doira/kvadrat —
// asosiy a11y shartnomasi: rang yolg'iz farq bo'lib qolmaydi.
// ---------------------------------------------------------------------------

/// Bitta marshrut qatori: glif + (manzil / izoh) + ixtiyoriy o'ng element.
class _RouteRow extends StatelessWidget {
  const _RouteRow({
    required this.glyph,
    required this.title,
    required this.caption,
    this.semanticsLabel,
    this.trailing,
    this.onTap,
  });

  final Widget glyph;
  final String title;
  final String caption;

  /// `onTap` berilganda MAJBURIY: qator butunligicha bitta tugmaga
  /// aylanadi va ichki matnlar semantikadan chiqariladi.
  final String? semanticsLabel;

  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = ConstrainedBox(
      // Qat'iy balandlik EMAS: tizim shrifti kattalashtirilganda ikki
      // qatorli matn o'sishga haqli, aks holda u qirqilardi.
      constraints: const BoxConstraints(minHeight: _kRouteRowHeight),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace4,
          vertical: kSpace2,
        ),
        child: Row(
          children: [
            // Glif ustuni qat'iy kenglikda: turli o'lchamdagi gliflar
            // (9dp doira va 18dp kvadrat) bitta vertikal o'qda turadi.
            SizedBox(
              width: _kGlyphColumn,
              child: Center(child: glyph),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    // O'zbekcha manzillar uzun ("Mustaqillik shoh ko'chasi,
                    // 42-uy") — qator hech qachon o'ralmaydi.
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: context.fs(kFontBodyLg),
                      color: kInk,
                      height: 1.2,
                    ),
                  ),
                  Text(
                    caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.fs(kFontCaption),
                      // Kichik yozuv — doim `kInkMuted` (5.47:1).
                      color: kInkMuted,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: kSpace2),
              trailing!,
            ],
          ],
        ),
      ),
    );

    if (onTap == null) return row;

    return AppPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      // Balandlikni o'zimiz berdik (56dp > 48dp) — qo'shimcha cheklov
      // ortiqcha qatlam bo'lardi.
      minTapTarget: false,
      // Karta ICHIDAGI qator masshtablanmaydi — u joyida qotib turishi
      // kerak, aks holda karta "bo'shab" ko'rinadi. Javob ripple bilan.
      pressedScale: 1,
      enableRipple: true,
      borderRadius: BorderRadius.zero,
      child: ExcludeSemantics(
        // Matn `semanticsLabel` ichida rol bilan birga ("Qayerdan: ...")
        // allaqachon bor — ikkinchi marta o'qilishi shovqin bo'lardi.
        child: row,
      ),
    );
  }
}

/// Boshlanish nuqtasi — `kPrimary` DOIRA.
class _FromGlyph extends StatelessWidget {
  const _FromGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _kFromGlyphSize,
      height: _kFromGlyphSize,
      decoration: const BoxDecoration(
        color: kPrimary,
        shape: BoxShape.circle,
      ),
    );
  }
}

/// To'xtash nuqtasi — `kInk` KVADRAT, ichida marshrutdagi tartib raqami.
///
/// Doira EMAS: boshlanish va to'xtash hech qachon bir xil glif bo'lmaydi,
/// aks holda qatorlarni faqat RANG ajratib turardi.
class _StopGlyph extends StatelessWidget {
  const _StopGlyph({required this.order});

  /// Marshrutdagi tartib raqami (olinish nuqtasi — 1).
  final int order;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _kStopGlyphSize,
      height: _kStopGlyphSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: kInk,
        borderRadius: BorderRadius.circular(_kStopGlyphCorner),
      ),
      // Glif o'lchami qat'iy (marshrut ustuni qiyshaymasligi kerak), tizim
      // shrifti esa 2x gacha kattalashishi mumkin — `FittedBox` raqamni
      // kvadrat ichida ushlab qoladi. Raqam ikkinchi darajali ishora:
      // manzil matni to'liq masshtablanadi, tartib esa semantikada ham bor.
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          '$order',
          style: const TextStyle(
            fontSize: kFontMicro,
            fontWeight: FontWeight.w800,
            // `kInk` ustidagi yozuv — `kOnPrimary` (oq, 17.5:1).
            color: kOnPrimary,
            height: 1,
          ),
        ),
      ),
    );
  }
}

/// Marshrut qatorlari orasidagi ajratkich.
///
/// Chapdan glif ustuni kengligicha suriladi: doira va kvadratlar uzluksiz
/// "marshrut ustuni" bo'lib o'qiladi, chiziq esa faqat matnlarni ajratadi.
class _RouteDivider extends StatelessWidget {
  const _RouteDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: _kRouteTextInset, right: kSpace4),
      child: Divider(height: 1, thickness: 1, color: kDivider),
    );
  }
}

// ---------------------------------------------------------------------------
// RO'YXAT QATORI (takliflar / saqlangan manzillar)
// ---------------------------------------------------------------------------

/// 52dp li manzil qatori: ikonka + (nom / manzil) + o'ngda taxminiy masofa.
class _PlaceRow extends StatelessWidget {
  const _PlaceRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailingLabel,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;

  /// O'ng chekkadagi qiymat (taxminiy masofa). `null` bo'lsa qator faqat
  /// matndan iborat bo'ladi — noma'lum masofa o'rniga hech narsa
  /// ko'rsatilmaydi, aks holda yolg'on aniqlik yaratilardi.
  final String? trailingLabel;

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final sub = subtitle;
    final trailing = trailingLabel;

    return AppPressable(
      onTap: onTap,
      semanticsLabel: [
        title,
        if (sub != null) sub,
        if (trailing != null) 'taxminan ${trailing.substring(1)}',
      ].join(', '),
      minTapTarget: false,
      // Ro'yxat qatori — masshtab emas, ripple javob beradi (qo'shni
      // qatorlar orasida siljish sezilib qolardi).
      pressedScale: 1,
      enableRipple: true,
      borderRadius: BorderRadius.zero,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: _kPlaceRowHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: kSpace3,
              vertical: kSpace2,
            ),
            child: Row(
              children: [
                Container(
                  width: _kPlaceIconBox,
                  height: _kPlaceIconBox,
                  decoration: BoxDecoration(
                    color: kSurface2,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(icon, color: iconColor, size: _kPlaceIconSize),
                ),
                const SizedBox(width: kSpace3),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: context.fs(kFontBodyLg),
                          fontWeight:
                              sub == null ? FontWeight.w500 : FontWeight.w600,
                          color: kInk,
                          height: 1.2,
                        ),
                      ),
                      if (sub != null)
                        Text(
                          sub,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.fs(kFontCaption),
                            color: kInkMuted,
                            height: 1.3,
                          ),
                        ),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: kSpace3),
                  Text(
                    trailing,
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: context.fs(kFontLabel),
                      fontWeight: FontWeight.w600,
                      color: kInkMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ro'yxat qatorlari orasidagi ajratkich — matn boshlanishidan suriladi,
/// ikonka ustuni uzluksiz qoladi.
class _PlaceDivider extends StatelessWidget {
  const _PlaceDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: _kPlaceTextInset, right: kSpace3),
      child: Divider(height: 1, thickness: 1, color: kDivider),
    );
  }
}
