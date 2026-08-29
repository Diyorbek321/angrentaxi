import 'dart:async';
import 'dart:io';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/config/map_style.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/location/navigation_engine.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/features/driver/widgets/maneuver_banner.dart';
// `MapCameraInsets` yo'lovchi papkasida yashaydi, lekin u ekranga emas
// TARTIBGA bog'liq — izoh `trip_screen.dart` dagi import ustida.
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart' show AgSurfaceCard;
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
// Xarita kamerasi MapLibre'ning o'z LatLng turini kutadi; ilovaning
// qolgan qismi latlong2 ni ishlatadi, shuning uchun prefiks bilan.
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show CameraUpdate, LatLng, LatLngBounds, MapLibreMapController;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Koordinatada 1e-6 daraja ≈ 10 sm, chetda 1dp — ikkalasi ham ekranda
/// ko'rinmaydi. Aniq tenglik tekshirilsa, o'lchovdagi piksel osti
/// chayqalishi kamerani HAR KADRDA qayta animatsiya qilardi.
const double _kFitCoordEpsilon = 1e-6;
const double _kFitInsetEpsilon = 1;

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  ml.MapLibreMapController? _mapController;
  LatLng _currentLocation = const LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  double? _distanceToPickup;

  /// Pog'onali navigatsiya holati. Marshrut yuklanmaguncha `null` — bunda
  /// ekran eski ko'rinishida (faqat masofa + tashqi navigator) ishlaydi.
  NavigationEngine? _engine;
  NavigationProgress? _progress;

  /// Marshrut chizig'i xaritada.
  List<LatLng> _routePoints = const [];

  final VoiceGuide _voice = sl<VoiceGuide>();
  StreamSubscription<Position>? _positionSubscription;

  /// Sheet kontentining balandligi — kamera paddingi shundan hisoblanadi.
  final GlobalKey _panelContentKey = GlobalKey();
  double? _panelContentHeight;

  /// Ochiq maydonga moslashning oxirgi QO'LLANGAN holati.
  _CameraFit? _lastCameraFit;

  /// Birinchi GPS ping'idan keyin kamera umumiy ko'rinishdan haydovchiga
  /// ERGASHISHGA o'tadi va boshqa orqaga qaytmaydi.
  bool _followingDriver = false;

  /// Ergashishda oxirgi qo'llangan chetlar — sheet balandligi o'zgarmaguncha
  /// kamera qayta hisoblanmaydi.
  MapCameraInsets? _appliedFollowInsets;

  /// Ergashish animatsiyasi ketayotganda kelgan ping o'tkazib yuboriladi.
  ///
  /// NEGA KERAK: `distanceFilter` 5 metr, ya'ni 60 km/soatda sekundiga uchta
  /// ping keladi. Har biriga ikkita kamera animatsiyasi berilsa, xarita
  /// to'xtovsiz sakraydi. Tashlab yuborilgan ping yo'qolmaydi — keyingisi
  /// baribir ENG YANGI joylashuvni olib keladi.
  bool _cameraBusy = false;

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    // Ekran yopilganda gap o'rtasida qolgan ovoz to'xtatiladi — aks holda
    // haydovchi allaqachon boshqa ekranda turib burilish haqida eshitardi.
    _voice.stop();
    super.dispose();
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
      });

      final order = context.read<DriverProvider>().activeOrder;
      if (order != null) {
        final dist = locationService.calculateDistance(
          position.latitude,
          position.longitude,
          order.pickup.lat,
          order.pickup.lng,
        );
        if (mounted) setState(() => _distanceToPickup = dist);
      }

      // Ilgari bu yerda `newLatLngZoom` bor edi — u mashinani ekran
      // MARKAZIGA qo'yardi, markaz esa sheet ostida qoladi.
      _fitCamera();

      await _startGuidance();
    }
  }

  /// Marshrutni yuklab, ovozni tayyorlab, GPS oqimiga ulanadi.
  ///
  /// Har bir bosqich alohida yiqilishi mumkin va yiqilsa ham ekran ishlab
  /// turaveradi: marshrut kelmasa banner ko'rsatilmaydi, ovoz bo'lmasa
  /// banner o'zi qoladi.
  Future<void> _startGuidance() async {
    if (!mounted) return;
    final order = context.read<DriverProvider>().activeOrder;
    if (order == null) return;

    final destination = _nextDestination(order);
    final route = await sl<RouteService>().getRoute(
      _currentLocation,
      LatLng(destination.lat, destination.lng),
    );

    if (!mounted) return;

    if (route != null) {
      setState(() {
        _routePoints = route.points;
        _engine = NavigationEngine(steps: route.steps);
      });
    }

    // Ovoz marshrutdan KEYIN tayyorlanadi: birinchi ko'rsatma marshrut
    // kelmaguncha baribir aytilmaydi, TTS tillarini so'rash esa sekin.
    await _voice.init();

    _listenToPosition();
  }

  /// GPS oqimini navigatsiya dvigateliga ulaydi.
  ///
  /// `distanceFilter` ATAYLAB kichik: navigatsiyada har 5 metr ham muhim,
  /// standart 10 metr esa "hozir buriling" oynasini o'tkazib yuborishi
  /// mumkin. Takrorlanishdan himoya dvigatelda bo'lgani uchun tez-tez
  /// kelayotgan ping xavfsiz.
  void _listenToPosition() {
    try {
      _positionSubscription = sl<LocationService>()
          .getPositionStream(distanceFilter: 5)
          .listen(
            _onPosition,
            // Joylashuv oqimi uzilishi (ruxsat olib qo'yilishi, GPS
            // o'chirilishi) navigatsiyani yiqitmasligi kerak.
            onError: (Object _) {},
            cancelOnError: false,
          );
    } catch (_) {
      // Qurilmada joylashuv oqimi umuman ishlamasa — ekran statik holda
      // qoladi, bu yiqilishdan yaxshi.
    }
  }

  /// Bitta GPS ping'i.
  void _onPosition(Position position) {
    final engine = _engine;
    if (engine == null || !mounted) return;

    final here = LatLng(position.latitude, position.longitude);
    final progress = engine.update(here);

    setState(() {
      _currentLocation = here;
      _progress = progress;
    });

    _followingDriver = true;
    _followDriver();

    // Dvigatel `announcement` ni FAQAT yangi (manevr, bosqich) juftligida
    // qaytaradi — shu sababli bu yerda hech qanday qo'shimcha tekshiruv
    // kerak emas va gap takrorlanmaydi.
    final announcement = progress.announcement;
    if (announcement != null) {
      _voice.speak(announcement.text);
    }
  }

  Future<void> _onArrived() async {
    final provider = context.read<DriverProvider>();
    await provider.arrivedAtPickup();
    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      Navigator.of(context).pushReplacementNamed('/driver/arrived');
    }
  }

  // -------------------------------------------------------------------
  // KAMERA — TO'LDIRILGAN TO'RTBURCHAK (padded-fit)
  //
  // Sheet ekranning pastki qismini doim yopib turadi. Kamera to'liq
  // ekranga moslansa, mashina va oldindagi yo'l aynan sheet ostiga tushadi.
  //
  // Ikki rejim bor va ikkalasi ham yo'lovchi ekranlaridagi ISHLAYOTGAN
  // naqshdan ko'chirilgan:
  //   · GPS oqimi boshlanmaguncha — marshrutni ochiq maydonga sig'dirish
  //     (`newLatLngBounds` + chetlar), naqsh tariff_select_screen.dart;
  //   · birinchi ping'dan keyin — haydovchiga ergashish, lekin mashina
  //     ekran markazida emas, OCHIQ maydon markazida turadi
  //     (`newLatLng` + `scrollBy`), naqsh home_screen._centerOnUser.
  //
  // `AppVectorMap.fitToContent` shu sababdan ATAYLAB o'chirilgan: u
  // paddingni ichkarida qat'iy saqlaydi va sheet balandligini bilmaydi.
  // -------------------------------------------------------------------

  MapCameraInsets _insets() => MapCameraInsets.forPanel(
        context,
        panelContentHeight: _panelContentHeight,
      );

  void _onMapCreated(ml.MapLibreMapController controller) {
    _mapController = controller;
    _fitCamera();
  }

  /// Sheetni o'lchaydi va kerak bo'lsa kamerani qayta moslaydi.
  void _syncCamera() {
    if (!mounted) return;
    final renderObject = _panelContentKey.currentContext?.findRenderObject();
    if (renderObject is RenderBox && renderObject.hasSize) {
      _panelContentHeight = renderObject.size.height;
    }

    if (!_followingDriver) {
      _fitCamera();
      return;
    }

    // Ergashish rejimida kamera ping'da yangilanadi; bu yerda faqat sheet
    // balandligi o'zgargan bo'lsa aralashamiz (masofa qatori paydo bo'ldi,
    // yuklanish holati kirdi).
    final applied = _appliedFollowInsets;
    if (applied == null || _insetsDiffer(_insets(), applied)) {
      _followDriver();
    }
  }

  /// Xaritada CHIZILGAN nuqtalar — kamera aynan shularni sig'diradi.
  /// Ro'yxat `_buildMap` chizadigan narsa bilan bir xil bo'lishi kerak.
  List<LatLng> _mapPoints(Order order) => <LatLng>[
        _currentLocation,
        ..._routePoints,
        LatLng(order.pickup.lat, order.pickup.lng),
      ];

  void _fitCamera() {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    final order = context.read<DriverProvider>().activeOrder;
    if (order == null) return;

    final points = _mapPoints(order);
    if (points.length < 2) return;

    var minLat = points.first.latitude, maxLat = minLat;
    var minLng = points.first.longitude, maxLng = minLng;
    for (final p in points) {
      minLat = p.latitude < minLat ? p.latitude : minLat;
      maxLat = p.latitude > maxLat ? p.latitude : maxLat;
      minLng = p.longitude < minLng ? p.longitude : minLng;
      maxLng = p.longitude > maxLng ? p.longitude : maxLng;
    }

    final fit = _CameraFit(
      minLat: minLat,
      minLng: minLng,
      maxLat: maxLat,
      maxLng: maxLng,
      insets: _insets(),
    );
    final last = _lastCameraFit;
    if (last != null && !fit.differsFrom(last)) return;
    _lastCameraFit = fit;

    controller.animateCamera(
      ml.CameraUpdate.newLatLngBounds(
        ml.LatLngBounds(
          southwest: ml.LatLng(minLat, minLng),
          northeast: ml.LatLng(maxLat, maxLng),
        ),
        left: fit.insets.left,
        top: fit.insets.top,
        right: fit.insets.right,
        bottom: fit.insets.bottom,
      ),
    );
  }

  /// Kamerani haydovchiga qaratadi va uni sheet USTIGA chiqaradi.
  ///
  /// ⚠️ NEGA IKKI QADAM. `newLatLng` nuqtani ekran MARKAZIGA qo'yadi, markaz
  /// esa sheet ostida qoladi. Chegara paddingi bitta nuqta uchun ishlamaydi
  /// — hech qanday to'rtburchak yo'q — shuning uchun nuqta qo'yilgandan
  /// keyin kamera ochiq maydon markaziga suriladi. Siljish ishorasi
  /// `MapCameraInsets.centeringScroll` da tushuntirilgan.
  Future<void> _followDriver() async {
    final controller = _mapController;
    if (controller == null || !mounted || _cameraBusy) return;

    _cameraBusy = true;
    try {
      final insets = _insets();
      _appliedFollowInsets = insets;

      await controller.animateCamera(
        ml.CameraUpdate.newLatLng(
          ml.LatLng(_currentLocation.latitude, _currentLocation.longitude),
        ),
      );
      if (!mounted) return;

      final scroll = insets.centeringScroll;
      // 1dp dan kichik siljish sezilmaydi — ortiqcha animatsiya qilmaymiz.
      if (scroll.dx.abs() < 1 && scroll.dy.abs() < 1) return;
      await controller.animateCamera(
        ml.CameraUpdate.scrollBy(scroll.dx, scroll.dy),
      );
    } finally {
      _cameraBusy = false;
    }
  }

  bool _insetsDiffer(MapCameraInsets a, MapCameraInsets b) =>
      (a.left - b.left).abs() > _kFitInsetEpsilon ||
      (a.top - b.top).abs() > _kFitInsetEpsilon ||
      (a.right - b.right).abs() > _kFitInsetEpsilon ||
      (a.bottom - b.bottom).abs() > _kFitInsetEpsilon;

  /// This screen only shows before the passenger is picked up (see
  /// app.dart / home_screen.dart#_navigateToActiveOrder — driverAssigned and
  /// driverEnRoute route here, driverArrived/inProgress route to the
  /// arrived/trip screens instead). It still checks the order's status
  /// defensively so navigation always points at whichever leg is actually
  /// next if that assumption ever changes.
  OrderLocation _nextDestination(Order order) {
    return order.status == OrderStatus.inProgress
        ? order.dropoff
        : order.pickup;
  }

  /// Opens the device's default navigation app with turn-by-turn directions
  /// to [destination]. Uses a generic `geo:` URI on Android/others, which the
  /// OS resolves to whichever maps app is installed (Google Maps, Yandex
  /// Maps, etc.), prompting a chooser if more than one handles it. `geo:` is
  /// not supported on iOS, so Apple Maps' web deep link is used there
  /// instead — Google Maps also handles that same URL as a fallback if it's
  /// installed. Follows the same canLaunchUrl/launchUrl guard-and-snackbar
  /// pattern as _callDriver in
  /// lib/features/passenger/screens/home_screen.dart.
  Future<void> _openNavigation(OrderLocation destination) async {
    final label = Uri.encodeComponent(destination.address);
    final uri = Platform.isIOS
        ? Uri.parse(
            'https://maps.apple.com/?daddr=${destination.lat},${destination.lng}',
          )
        : Uri.parse(
            'geo:0,0?q=${destination.lat},${destination.lng}($label)',
          );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Navigatsiya ilovasi topilmadi')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            return const Center(child: CircularProgressIndicator());
          }

          // Ovqat buyurtmasida bu ekran restoranga olib boradi, taksida —
          // yo'lovchiga. Matn farqi bitta joydan keladi.
          final wording = order.wording;

          // Sheet balandligi kontentga qarab o'zgaradi (masofa qatori
          // keldi, yuklanish holati kirdi), kamera esa shunga bog'liq.
          WidgetsBinding.instance.addPostFrameCallback((_) => _syncCamera());

          return Stack(
            children: [
              _buildMap(order),
              _buildPanel(order, provider, wording),
              // Manevr banneri ENG USTIDA va TEPAGA QADALGAN: u sheetdan
              // keyin quriladi, ya'ni panel unga hech qachon chiqa olmaydi.
              _buildTopBar(wording),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(Order order) {
    return AppVectorMap(
      initialCenter: _currentLocation,
      initialZoom: 15,
      onMapCreated: _onMapCreated,
      markers: [
        AppMapMarker(point: _currentLocation, icon: AppMapIcon.car),
        AppMapMarker(
          point: LatLng(order.pickup.lat, order.pickup.lng),
          icon: AppMapIcon.pickup,
        ),
      ],
      // Haqiqiy yo'l chizig'i — to'g'ri chiziq emas.
      route: _routePoints,
      // Kamerani O'ZIMIZ boshqaramiz — yuqoridagi "TO'LDIRILGAN
      // TO'RTBURCHAK" izohiga qarang.
      fitToContent: false,
      // Navigatsiyada egilgan kamera — oldinda yotgan yo'l ko'proq
      // ko'rinadi va uch o'lchamli his beradi (Yandex/Google navigatoridagi
      // kabi). Boshqa ekranlarda xarita tekis qoladi.
      tilt: 45,
      // Kechasi qora xarita. Faqat shu ekranda: haydovchi navigatsiyaga
      // uzoq qaraydi va qorong'ida oq ekran ko'zni qamashtirib, yo'lga
      // qarab qaytganda ko'rishni sekinlashtiradi. Joylashuv yangilanishi
      // ekranni qayta qurgani uchun uslub tun kirganda o'zi almashadi.
      style: MapStyleLoader.styleForNow(),
    );
  }

  Widget _buildTopBar(DriverServiceWording wording) {
    // ⚠️ 720dp dan keng ekranda `AdaptiveMapPanel` pastdagi sheet emas,
    // CHAPDAGI yon panel bo'ladi. Manevr banneri o'sha panel ustiga
    // tushmasligi kerak — shuning uchun chap chet panel kengligiga suriladi.
    // Telefonda panel pastda, banner tepada: ular kesishmaydi.
    final side = context.canSplitMapPanel;
    final left = side
        ? context.gutter * 2 + context.sidePanelWidth
        : kSpace4;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(left, kSpace4, kSpace4, kSpace4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              button: true,
              label: 'Orqaga',
              child: Container(
                // Haydovchi ikkilamchi nishoni — `kMinTapTargetDriver` (56),
                // yo'lovchi 48dp emas: harakatdagi qo'l uchun pol shu.
                constraints: const BoxConstraints(
                  minHeight: kMinTapTargetDriver,
                  minWidth: kMinTapTargetDriver,
                ),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCard,
                ),
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: kInk),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(child: _buildGuidanceHeader(wording)),
          ],
        ),
      ),
    );
  }

  /// Manevr paneli, yoki marshrut hali yo'q bo'lsa oddiy sarlavha.
  ///
  /// Marshrut kelmasligi normal holat: OSRM javob bermasligi yoki `steps`
  /// yubormasligi mumkin. Bunday paytda ekran eski, ishonchli ko'rinishida
  /// qoladi — tashqi navigator tugmasi baribir joyida.
  Widget _buildGuidanceHeader(DriverServiceWording wording) {
    final progress = _progress;
    final step = progress?.step;

    if (progress == null || step == null) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace4,
          vertical: kSpace3,
        ),
        constraints: const BoxConstraints(minHeight: kMinTapTargetDriver),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusMd),
          boxShadow: kShadowCard,
        ),
        child: Row(
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.navigation, color: kPrimary, size: 20),
            ),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Text(
                wording.routeHeader,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: kFontBodyLg,
                  color: kInk,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return ManeuverBanner(
      step: step,
      instruction: progress.instruction,
      distanceMeters: progress.distanceToManeuverMeters,
    );
  }

  /// Qatlamli sheet: foni `kSurface2`, ichidagi bloklar oq `AgSurfaceCard`.
  ///
  /// Kontent ATAYLAB qisqa: olish nuqtasi, masofa va ikkita amal. Bu ekranda
  /// haydovchi nigohi bannerda bo'lishi kerak, sheet esa faqat "keyingi
  /// qadam" ni ushlab turadi — u qanchalik past bo'lsa, xarita va banner
  /// shuncha ko'p joy oladi.
  Widget _buildPanel(
    Order order,
    DriverProvider provider,
    DriverServiceWording wording,
  ) {
    return AdaptiveMapPanel(
      layered: true,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      child: Column(
        key: _panelContentKey,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildPickupInfo(order, wording),
          const SizedBox(height: kSpace4),
          AppOutlinedButton(
            label: 'Navigatsiyani ochish',
            onPressed: () => _openNavigation(_nextDestination(order)),
            // Ikkilamchi amal — haydovchi poli `kMinTapTargetDriver` (56).
            height: kMinTapTargetDriver,
            // Tanlangan/urg'uli chegara — kPrimary (mint yorug' fonda
            // 2.12:1 va chegara sifatida ko'rinmaydi).
            borderColor: kPrimary,
            textColor: kInk,
            icon: const Icon(Icons.navigation, color: kInk),
          ),
          // 12dp — ikkilamchi tugma bilan asosiy amal orasida (o'lcham
          // qoidasi: asosiy amal yonida 12dp).
          const SizedBox(height: kSpace3),
          AppButton(
            label: 'Yetib keldim',
            onPressed: _onArrived,
            isLoading: provider.state == DriverProviderState.loading,
            // Haydovchi ASOSIY amali — 64dp.
            height: kControlHeightDriver,
            // Oldin kSuccess (mint) + oq matn = 2.12:1 edi.
            icon: const Icon(Icons.check, color: kOnPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildPickupInfo(Order order, DriverServiceWording wording) {
    return AgSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: kMintTint,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.radio_button_checked,
                      color: kPrimary,
                      size: 20,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      wording.pickupTitle,
                      style: const TextStyle(
                        color: kInkMuted,
                        fontSize: kFontMicro,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      order.pickup.address,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        // Manzil — bu ekrandagi eng ko'p o'qiladigan matn.
                        fontSize: kFontBodyLg,
                        color: kInk,
                      ),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
            ],
          ),
          // Masofa AYNI shu karta ichida: u manzilning xossasi, alohida
          // blok emas — sheet bir qator pasayadi va xaritaga joy qoladi.
          if (_distanceToPickup != null) ...[
            const SizedBox(height: kSpace3),
            Row(
              children: [
                const ExcludeSemantics(
                  child: Icon(
                    Icons.directions_car,
                    color: kInkMuted,
                    size: 18,
                  ),
                ),
                const SizedBox(width: kSpace2),
                Expanded(
                  child: Text(
                    '${wording.distanceToPickupLabel}: '
                    '${Formatters.formatDistance(_distanceToPickup!)}',
                    style: const TextStyle(
                      color: kInkMuted,
                      fontSize: kFontBody,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Kameraga qo'llangan moslash — chegara va chetlar birgalikda.
///
/// `tariff_select_screen.dart` va `trip_screen.dart` dagi bir xil nomli
/// yordamchining nusxasi: hammasi xususiy (`_`) va o'z ekranining ichki
/// hisobi. Umumiy haqiqat manbai — `map_camera_insets.dart`.
@immutable
class _CameraFit {
  const _CameraFit({
    required this.minLat,
    required this.minLng,
    required this.maxLat,
    required this.maxLng,
    required this.insets,
  });

  final double minLat;
  final double minLng;
  final double maxLat;
  final double maxLng;
  final MapCameraInsets insets;

  bool differsFrom(_CameraFit other) =>
      (minLat - other.minLat).abs() > _kFitCoordEpsilon ||
      (minLng - other.minLng).abs() > _kFitCoordEpsilon ||
      (maxLat - other.maxLat).abs() > _kFitCoordEpsilon ||
      (maxLng - other.maxLng).abs() > _kFitCoordEpsilon ||
      (insets.left - other.insets.left).abs() > _kFitInsetEpsilon ||
      (insets.top - other.insets.top).abs() > _kFitInsetEpsilon ||
      (insets.right - other.insets.right).abs() > _kFitInsetEpsilon ||
      (insets.bottom - other.insets.bottom).abs() > _kFitInsetEpsilon;
}
