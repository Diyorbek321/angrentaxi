import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/active_order_view.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
import 'package:angren_taxi/features/passenger/screens/rate_driver_screen.dart';
import 'package:angren_taxi/features/passenger/widgets/coverage_notice.dart';
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/service_catalog.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/ag_service_chips.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:latlong2/latlong.dart';
// Xarita kamerasi MapLibre'ning o'z LatLng turini kutadi; ilovaning qolgan
// qismi latlong2 ni ishlatadi, shuning uchun bu yerda prefiks bilan.
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show MapLibreMapController, CameraUpdate, LatLng;
import 'package:provider/provider.dart';

class PassengerHomeScreen extends StatefulWidget {
  const PassengerHomeScreen({super.key, this.sosService});

  /// Injectable for tests — o'zgarishsiz [ActiveOrderView] ga uzatiladi,
  /// u esa `null` bo'lsa xizmatni service locator'dan quradi (same pattern
  /// as CheckoutScreen.paymentService).
  final SosService? sosService;

  @override
  State<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}

class _PassengerHomeScreenState extends State<PassengerHomeScreen> {
  ml.MapLibreMapController? _mapController;
  LatLng _currentLocation = const LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  bool _locationLoading = true;

  /// Haqiqiy GPS fiksi olindimi. `_locationLoading` yetarli emas — ruxsat
  /// berilmaganda ham u `false` bo'ladi, native joylashuv nuqtasini esa
  /// ruxsatsiz yoqib bo'lmaydi.
  bool _hasLocationFix = false;

  /// Sheet kontentining balandligini o'lchash uchun — kamera shu balandlikni
  /// hisobga olib joylashadi (`map_camera_insets.dart`).
  final GlobalKey _sheetContentKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _initLocation();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderProvider>().checkActiveOrder();
      // Rejalashtirilgan safarlar `checkActiveOrder` ga KIRMAYDI (ular
      // `isActive` emas), shuning uchun alohida o'qiladi — aks holda
      // yo'lovchi o'z rejasi borligini bosh ekranda umuman bilmasdi.
      context.read<OrderProvider>().loadScheduledOrders();
      // Xizmat hududlari (`GET /cities`) — yo'lovchi buyurtma qurishdan
      // OLDIN qamrov tashqarisida ekanini bilishi uchun. So'rov yiqilsa
      // yoki bo'sh qaytsa hech narsa bloklanmaydi (`CityCoverage`).
      context.read<OrderProvider>().loadCities();
      context.read<FavoritesProvider>().loadFavorites();
    });
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
        _locationLoading = false;
        _hasLocationFix = true;
      });
      // Xarita allaqachon qurilgan bo'lsa kamerani surib qo'yamiz; hali
      // qurilmagan bo'lsa buni `onMapCreated` bajaradi (ikki marta emas —
      // o'sha paytda `_hasLocationFix` hali `false` bo'ladi).
      if (_mapController != null) {
        // Sheet o'lchanishi uchun kadr tugashini kutamiz.
        WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnUser());
      }
    } else {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  /// Kamerani foydalanuvchiga qaratadi va uni sheet USTIGA chiqaradi.
  ///
  /// ⚠️ NEGA IKKI QADAM. `newLatLngZoom` nuqtani ekran MARKAZIGA qo'yadi,
  /// markaz esa sheet ostida qoladi. Chegara (`newLatLngBounds`) paddingi
  /// bitta nuqta uchun ishlamaydi — hech qanday to'rtburchak yo'q — shuning
  /// uchun nuqta qo'yilgandan keyin kamera ochiq maydon markaziga suriladi.
  /// Siljish ishorasi `MapCameraInsets.centeringScroll` da tushuntirilgan.
  Future<void> _centerOnUser() async {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    await controller.animateCamera(
      ml.CameraUpdate.newLatLngZoom(
        ml.LatLng(_currentLocation.latitude, _currentLocation.longitude),
        15,
      ),
    );
    if (!mounted) return;

    final insets = MapCameraInsets.forPanel(
      context,
      panelContentHeight: _sheetContentHeight(),
    );
    final scroll = insets.centeringScroll;
    // 1dp dan kichik siljish sezilmaydi — ortiqcha animatsiya qilmaymiz.
    if (scroll.dx.abs() < 1 && scroll.dy.abs() < 1) return;
    await controller.animateCamera(
      ml.CameraUpdate.scrollBy(scroll.dx, scroll.dy),
    );
  }

  double? _sheetContentHeight() {
    final renderObject = _sheetContentKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) return null;
    return renderObject.size.height;
  }

  void _onWhereToTap() {
    final orderProvider = context.read<OrderProvider>();
    orderProvider.setPendingPickup(
      OrderLocation(
        address: 'Joylashuv aniqlanmoqda...',
        lat: _currentLocation.latitude,
        lng: _currentLocation.longitude,
      ),
    );
    Navigator.of(context).pushNamed('/passenger/destination');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<OrderProvider>(
        builder: (context, orderProvider, _) {
          // After a trip completes the provider flags a pending rating. Present
          // the rating screen as a modal over the home view, once.
          if (orderProvider.pendingRatingOrderId != null) {
            final orderId = orderProvider.pendingRatingOrderId!;
            final driverName =
                orderProvider.pendingRatingDriverName ?? 'Haydovchi';
            WidgetsBinding.instance.addPostFrameCallback((_) {
              orderProvider.clearPendingRating();
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  fullscreenDialog: true,
                  builder: (_) => RateDriverScreen(
                    orderId: orderId,
                    driverName: driverName,
                  ),
                ),
              );
            });
          }
          if (orderProvider.noDriversFoundMessage != null) {
            final message = orderProvider.noDriversFoundMessage!;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              orderProvider.clearNoDriversFoundMessage();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(message), backgroundColor: kErrorDeep),
              );
            });
          }
          if (orderProvider.hasActiveOrder) {
            return _buildActiveOrderView(orderProvider);
          }
          return _buildSearchView(orderProvider);
        },
      ),
    );
  }

  Widget _buildSearchView(OrderProvider orderProvider) {
    return Stack(
      children: [
        _buildMap(orderProvider),
        _buildTopBar(),
        if (_locationLoading) const LoadingWidget(),
        _buildBottomSheet(orderProvider),
      ],
    );
  }

  /// Faol safar butunligicha alohida ko'rinishda yashaydi
  /// (`active_order_view.dart`) — bosh ekran unga faqat holat va
  /// callbacklarni uzatadi.
  Widget _buildActiveOrderView(OrderProvider orderProvider) {
    return ActiveOrderView(
      order: orderProvider.activeOrder!,
      driverLocation: orderProvider.driverLocationListenable,
      isBusy: orderProvider.state == OrderProviderState.loading,
      onCancel: (reason) => orderProvider.cancelOrder(reason: reason),
      // Dangasa: `ActiveOrderView` uni faqat SOS bosilganda quradi.
      sosService: widget.sosService,
      fallbackLocation: _currentLocation,
      topBar: _buildTopBar(),
    );
  }

  /// Joriy joylashuv bo'yicha qamrov ogohlantirishi (yo'q bo'lsa `null`).
  ///
  /// ⚠️ GPS fiksi BO'LMASA hech qachon ogohlantirilmaydi: fiks yo'q paytda
  /// [_currentLocation] shunchaki zaxira koordinata bo'lib qoladi, ya'ni u
  /// haqidagi xulosa foydalanuvchi haqida emas. Noma'lum ma'lumot asosida
  /// buyurtmani to'sish — qamrov tekshiruvi qilishi mumkin bo'lgan eng
  /// yomon xato.
  String? _coverageWarning(OrderProvider orderProvider) {
    if (!_hasLocationFix) return null;
    return orderProvider.coverageWarningFor(
      _currentLocation.latitude,
      _currentLocation.longitude,
    );
  }

  Widget _buildMap(OrderProvider orderProvider) {
    return AppVectorMap(
      // Fiks bo'lmaguncha xarita birinchi faol shahar markazida turadi —
      // ilgari bu `AppConfig` dagi qattiq qiymat edi va yangi shahar
      // qo'shilganda ham o'zgarmasdi. Ro'yxat yuklanmagan bo'lsa
      // `fallbackCenter` o'sha eski qiymatga qaytadi.
      initialCenter: _hasLocationFix
          ? _currentLocation
          : orderProvider.coverage.fallbackCenter,
      initialZoom: 15,
      onMapCreated: (controller) {
        _mapController = controller;
        // Fiks xarita qurilishidan OLDIN kelgan bo'lsa, kamerani shu yerda
        // sheet ustiga chiqaramiz — aks holda foydalanuvchi nuqtasi ekran
        // markazida, ya'ni sheet ostida qolardi.
        if (_hasLocationFix) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnUser());
        }
      },
      // Statik marker o'rniga native joylashuv nuqtasi: u GPS bilan
      // uzluksiz yangilanadi, ilgari esa marker faqat ekran ochilganda
      // bir marta qo'yilardi va foydalanuvchi yurganda joyida qolardi.
      showUserLocation: _hasLocationFix,
    );
  }

  // --------------------------------------------------------------------
  // YUQORI PANEL — xarita ustidagi suzuvchi boshqaruvlar.
  //
  // Doira tugma endi `AgMapFab`: xarita foni oldindan noma'lum bo'lgani
  // uchun u yuzani soya BILAN BIRGA `kLineInteractive` chegarasi orqali
  // ajratadi. Ilgari bu yerda `BackdropFilter` bilan yarim shaffof "muzli
  // shisha" ishlatilardi — yorqin xarita ustida uning cheti ham, ichidagi
  // ikonka ham yo'qolib ketardi.
  // --------------------------------------------------------------------
  Widget _buildTopBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(kSpace4),
        child: Row(
          children: [
            Consumer<AuthProvider>(
              builder: (context, auth, _) => AgMapFab(
                icon: Icons.menu_rounded,
                semanticsLabel: 'Menyu',
                onTap: () => _showMenu(context, auth),
              ),
            ),
            const SizedBox(width: kSpace3),
            const Expanded(child: _LocationPill()),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .slideY(begin: -0.4, curve: Curves.easeOut);
  }

  // --------------------------------------------------------------------
  // SHEET — QATLAMLI YUZA.
  //
  // Panel foni `kSurface2` (`layered: true`), ichidagi bloklar esa oq
  // `AgSurfaceCard`. Ikkalasi BIRGA ishlatilishi shart: oq panel ustidagi
  // oq karta ajralmaydi. Chuqurlik shu ikki yuza FARQIDAN keladi, shuning
  // uchun kartalar chegarasiz — bitta sheetda uchta karta bo'lganda
  // ramkalar ko'zni kontentdan chalg'itardi.
  // --------------------------------------------------------------------
  Widget _buildBottomSheet(OrderProvider orderProvider) {
    final coverageWarning = _coverageWarning(orderProvider);
    final blocked = coverageWarning != null;

    // Telefonda pastdagi sheet, 720dp+ ekranda chap yon panel —
    // `AdaptiveMapPanel` ikkalasini ham o'zi hal qiladi.
    return AdaptiveMapPanel(
      layered: true,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      child: Column(
        key: _sheetContentKey,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildServiceChips(orderProvider),
          const SizedBox(height: kSpace4),
          AgSurfaceCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Qayoqqa boramiz?',
                  style: TextStyle(
                    fontSize: kFontH1,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: kSpace4),
                // Sabab tugmadan YUQORIDA turadi: odam avval nima uchun
                // bosilmasligini o'qiydi, keyin o'chirilgan tugmani ko'radi.
                if (coverageWarning != null)
                  CoverageNotice(message: coverageWarning),
                _buildSearchField(blocked: blocked),
              ],
            ),
          ),
          const SizedBox(height: kSpace2),
          AgSurfaceCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Saqlangan joylar',
                  style: TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w700,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: kSpace3),
                _buildSavedPlaces(blocked: blocked),
              ],
            ),
          ),
          _buildScheduledBanner(),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------
  // XIZMAT CHIPLARI.
  //
  // ⚠️ RO'YXAT QATTIQ KODLANMAGAN: yorliq va ikonka `service_wording.dart`
  // dan olinadi — loyihada xizmat nomi uchun yagona manba shu. (Fayl
  // haydovchi papkasida yotadi, lekin `typeLabel`/`icon` roldan qat'i
  // nazar bir xil ma'lumot; yangi vertikal qo'shilganda faqat o'sha fayl
  // yangilanadi va bu qator o'zi ergashadi.)
  //
  // ⚠️ YANGI OQIM O'YLAB TOPILMADI. Bosh ekran taksi VA yuk buyurtmasini
  // quradi (`cargo_screen.dart` shu ekranga o'tadi), shuning uchun tanlov
  // `OrderProvider.serviceType` dan o'qiladi. Ovqat va market esa butunlay
  // boshqa oqimlar — chip ularning MAVJUD ekranlariga o'tkazadi, xuddi
  // superapp bosh sahifasidagi plitkalar kabi.
  // --------------------------------------------------------------------
  /// ⚠️ Ilgari bu ro'yxat `DriverServiceWording` dan olinardi. U HAYDOVCHI
  /// matnlari: "Yuk tashish", "Ovqat yetkazish" — haydovchining ishini
  /// tasvirlaydi va chip qatoriga ikki barobar keng tushadi. Yo'lovchi
  /// xizmatni sotib oladi, bajarmaydi.
  static const List<ServiceCatalogEntry> _services = ServiceCatalogEntry.all;

  Widget _buildServiceChips(OrderProvider orderProvider) {
    return AgServiceChips(
      // Panel allaqachon gutter qo'ygan — chiplar ikkinchi marta
      // suriladigan bo'lsa qator ekran o'rtasidan boshlanib qolardi.
      padding: EdgeInsets.zero,
      selectedId: orderProvider.serviceType,
      items: [
        for (final service in _services)
          AgServiceChipItem(
            id: service.serviceType,
            label: service.label,
            icon: service.icon,
          ),
      ],
      onSelect: _onServiceSelected,
    );
  }

  void _onServiceSelected(String id) {
    final orderProvider = context.read<OrderProvider>();
    switch (id) {
      case kServiceTypeTaxi:
        // Bu ekranning O'ZI taksi buyurtma oqimi — hech qayerga o'tmaymiz.
        // Tur allaqachon taksi bo'lsa `setServiceType` chaqirilmaydi: u
        // tanlangan tarif va narx hisobini tozalaydi, ya'ni tekin
        // chaqiruv foydalanuvchining ishini yo'qotardi.
        if (orderProvider.serviceType != kServiceTypeTaxi) {
          orderProvider.setServiceType(kServiceTypeTaxi);
        }
      case kServiceTypeCargo:
        // Yuk oqimi transport turini tanlashdan boshlanadi va `CargoScreen`
        // o'zi `setServiceType('cargo', cargoVehicle: ...)` ni chaqiradi.
        // Turni bu yerda qo'lda qo'yish transport turini bo'sh qoldirardi.
        _push(const CargoScreen());
      case kServiceTypeFood:
        _push(const FoodListScreen());
      case kServiceTypeMarket:
        _push(const MarketScreen());
    }
  }

  void _push(Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  Widget _buildSearchField({required bool blocked}) {
    return AppPressable(
      onTap: blocked ? null : _onWhereToTap,
      semanticsLabel: 'Manzilni qidiring',
      haptic: AppHapticLevel.impact,
      pressedScale: 0.98,
      minTapTarget: false,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace4),
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                // O'chirilgan holatda gradient olib tashlanadi — rang
                // yagona signal emas: yozuv ham, semantika ham
                // (`AppPressable` `onTap: null` da tugma rolini
                // o'chiradi) shu haqda gapiradi.
                gradient: blocked ? null : kGradientCta,
                color: blocked ? kSurface3 : null,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(Icons.search_rounded,
                  color: blocked ? kInkSubtle : kOnPrimary, size: 22),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Text(
                blocked
                    ? 'Xizmat hududidan tashqarida'
                    : 'Manzilni qidiring...',
                // O'chirilgan holatda ham `kInkMuted`: `kInkSubtle` oq
                // ustida 3.67:1 — chegara va ikonka uchun yetadi, YOZUV
                // uchun emas (AA 4.5:1). O'chirilganini matnning O'ZI
                // ("Xizmat hududidan tashqarida"), ikonkasi va
                // `AppPressable` ning o'chirilgan semantikasi aytadi —
                // rang bu yerda ortiqcha signal edi.
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontTitle,
                ),
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: blocked ? kInkSubtle : kInkMuted),
          ],
        ),
      ),
    );
  }

  /// Kelgusi reja haqida eslatma — ro'yxat ekraniga o'tish nuqtasi.
  ///
  /// Reja bo'lmasa hech narsa chizilmaydi: bo'sh joy egallamasligi kerak.
  Widget _buildScheduledBanner() {
    return Consumer<OrderProvider>(
      builder: (context, provider, _) {
        final orders = provider.scheduledOrders;
        if (orders.isEmpty) return const SizedBox.shrink();

        final next = orders.first;
        final when = next.scheduledAt;

        return Padding(
          padding: const EdgeInsets.only(top: kSpace2),
          child: AppPressable(
            onTap: () =>
                Navigator.of(context).pushNamed('/passenger/scheduled'),
            semanticsLabel: 'Rejalashtirilgan safarlar',
            pressedScale: 0.98,
            minTapTarget: false,
            child: Container(
              padding: const EdgeInsets.all(kSpace3),
              constraints: const BoxConstraints(minHeight: kMinTapTarget),
              decoration: BoxDecoration(
                color: kMintTint,
                borderRadius: BorderRadius.circular(kRadiusMd),
              ),
              child: Row(
                children: [
                  const ExcludeSemantics(
                    child: Icon(Icons.schedule_rounded,
                        size: 20, color: kPrimary),
                  ),
                  const SizedBox(width: kSpace3),
                  Expanded(
                    child: Text(
                      when != null
                          ? 'Kelgusi safar: ${Formatters.formatScheduleLabel(when)}'
                          : 'Rejalashtirilgan safar bor',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w700,
                        color: kPrimary,
                      ),
                    ),
                  ),
                  if (orders.length > 1)
                    Text(
                      '+${orders.length - 1}',
                      style: const TextStyle(
                        fontSize: kFontLabel,
                        fontWeight: FontWeight.w700,
                        color: kPrimary,
                      ),
                    ),
                  const ExcludeSemantics(
                    child: Icon(Icons.chevron_right_rounded,
                        size: 20, color: kPrimary),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Sends the passenger straight to tariff selection with both ends of the
  /// trip already known — the "Qo'shish" tile is the only saved-places tile
  /// that still goes through [_onWhereToTap]'s search flow.
  void _onFavoriteTap(FavoriteAddress favorite) {
    final orderProvider = context.read<OrderProvider>();
    orderProvider.setPendingPickup(
      OrderLocation(
        address: 'Joriy joylashuv',
        lat: _currentLocation.latitude,
        lng: _currentLocation.longitude,
      ),
    );
    orderProvider.setPendingDropoff(
      OrderLocation(
        address: favorite.address,
        lat: favorite.lat,
        lng: favorite.lng,
      ),
    );
    Navigator.of(context).pushNamed('/passenger/tariff');
  }

  /// Opens the destination search in "pick a location to save" mode instead
  /// of the normal search-and-order flow.
  void _onAddFavoriteTap() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const DestinationScreen(isSavingFavorite: true),
      ),
    );
  }

  /// [blocked] — qamrov tashqarisida: saqlangan joy plitkasi buyurtmani
  /// TO'G'RIDAN-TO'G'RI tarif ekraniga olib boradi, shuning uchun u ham
  /// qidiruv maydoni bilan bir xil darvozadan o'tadi. "Qo'shish" plitkasi
  /// esa ochiq qoladi — manzil saqlash buyurtma emas.
  Widget _buildSavedPlaces({required bool blocked}) {
    return Consumer<FavoritesProvider>(
      builder: (context, favoritesProvider, _) {
        final favorites = favoritesProvider.favorites;
        final itemCount = favorites.length + 1; // + trailing "Qo'shish" tile

        return SizedBox(
          // 96 was too tight for the icon + label column below (42 + 8
          // spacing + label text + 24 vertical padding), overflowing by
          // ~12px once a test actually settles this view; 108 gives the
          // label enough room.
          height: 108,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: itemCount,
            separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
            itemBuilder: (context, i) {
              if (i == favorites.length) {
                return _buildSavedPlaceTile(
                  index: i,
                  label: "Qo'shish",
                  icon: Icons.add_rounded,
                  color: kInkMuted,
                  onTap: _onAddFavoriteTap,
                );
              }
              final favorite = favorites[i];
              return _buildSavedPlaceTile(
                index: i,
                label: favorite.label,
                icon: favorite.icon,
                color: favorite.color,
                onTap: blocked ? null : () => _onFavoriteTap(favorite),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildSavedPlaceTile({
    required int index,
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback? onTap,
  }) {
    final enabled = onTap != null;
    return Semantics(
      button: enabled,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: AppPressable(
        onTap: onTap,
        pressedScale: 0.93,
        minTapTarget: false,
        child: Container(
          width: 80,
          padding: const EdgeInsets.all(kSpace3),
          decoration: BoxDecoration(
            color: kSurface2,
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color:
                        (enabled ? color : kInkSubtle).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child:
                      Icon(icon, color: enabled ? color : kInkSubtle, size: 22),
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: kFontCaption,
                  fontWeight: FontWeight.w600,
                  // O'chirilgan yorliq `kInkMuted` (5.47:1), `kInkSubtle`
                  // EMAS — u oq ustida 3.67:1 va kichik yozuv uchun AA dan
                  // past. Faol/o'chirilgan farqi `kInk` ↔ `kInkMuted` da
                  // baribir ko'rinadi, ikonka esa `kInkSubtle` da qoladi
                  // (ikonka uchun 3:1 yetarli).
                  color: enabled ? kInk : kInkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: (200 + index * 80).ms, duration: 350.ms)
        .slideX(begin: 0.3, curve: Curves.easeOut);
  }

  void _showMenu(BuildContext context, AuthProvider auth) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const ExcludeSemantics(
                child: CircleAvatar(
                  backgroundColor: kSurface2,
                  child: Icon(Icons.person, color: kInk),
                ),
              ),
              title: Text(auth.currentUser?.displayName ?? 'Foydalanuvchi'),
              subtitle: Text(auth.currentUser?.phone ?? ''),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.history),
              title: const Text('Sayohat tarixi'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/passenger/history');
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profil'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/passenger/profile');
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: kErrorDeep),
              title: const Text('Chiqish', style: TextStyle(color: kErrorDeep)),
              onTap: () {
                Navigator.of(ctx).pop();
                auth.logout();
              },
            ),
            const SizedBox(height: kSpace2),
          ],
        ),
      ),
    );
  }
}

/// Xarita ustidagi "Joriy joylashuv" yozuvi.
///
/// Interaktiv EMAS — shuning uchun tugma semantikasi yo'q. Lekin u ham
/// `AgMapFab` bilan bir xil yuza tilida chiziladi: to'ldirilgan `kSurface`,
/// `kLineInteractive` chegara va `kShadowPop`. Sabab bir xil — xarita foni
/// oldindan noma'lum, faqat soya yorqin fonda ko'rinmay qoladi.
class _LocationPill extends StatelessWidget {
  const _LocationPill();

  /// `AgMapFab` ning vizual diametri — yonma-yon turgan ikki element bir
  /// chiziqda o'qilishi uchun balandlik ham shunga tenglashtirilgan.
  static const double _height = 44;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: _height,
      padding: const EdgeInsets.symmetric(horizontal: kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusFull),
        border: Border.all(color: kLineInteractive),
        boxShadow: kShadowPop,
      ),
      child: const Row(
        children: [
          ExcludeSemantics(
            child: Icon(Icons.my_location_rounded, color: kPrimary, size: 20),
          ),
          SizedBox(width: kSpace3),
          Expanded(
            child: Text(
              'Joriy joylashuv',
              style: TextStyle(
                color: kInk,
                fontSize: kFontBody,
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
