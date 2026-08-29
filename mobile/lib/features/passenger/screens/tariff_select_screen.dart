import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/widgets/coverage_notice.dart';
import 'package:angren_taxi/features/passenger/widgets/schedule_ride_sheet.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/ag_option_chips.dart';
import 'package:angren_taxi/shared/widgets/ag_route_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_tariff_card.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:latlong2/latlong.dart';
// Kamera MapLibre'ning O'Z LatLng turini kutadi; ilovaning qolgan qismi
// latlong2 ni ishlatadi, shuning uchun bu yerda prefiks bilan.
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show CameraUpdate, LatLng, LatLngBounds, MapLibreMapController;
import 'package:provider/provider.dart';

// ---------------------------------------------------------------------------
// EKRAN GEOMETRIYASI
//
// Bu o'lchamlar dizayn shkalasida yo'q (`kSpace*` ga tushmaydi) — ular
// aynan shu ekranning tartibi, shuning uchun `app_theme.dart` ga emas,
// shu yerga yoziladi.
// ---------------------------------------------------------------------------

/// Bitta tarif kartasining kengligi.
///
/// 112dp — 360dp li eng tor telefonda uchta karta bir vaqtda ko'rinadi
/// (3×112 + 2×12 oraliq = 360). Kengroq karta qilinsa foydalanuvchi
/// tanlovning borligini bilish uchun ham skroll qilishga majbur bo'lardi.
const double _kTariffCardWidth = 112;

/// Talab (surge) nishonining karta burchagidan ichkariligi. `AgTariffCard`
/// o'z nishonini xuddi shu masofada chizadi — ikkalasi bir xil bo'lishi
/// kerak, aks holda nishon "boshqa joydan" kelgandek ko'rinadi.
const double _kSurgeBadgeInset = 6;

/// Suzuvchi marshrut panelining eng katta kengligi. Planshetda panel
/// ekran bo'ylab cho'zilsa manzil qatori o'qib bo'lmas darajada uzayadi.
const double _kRoutePanelMaxWidth = 520;

/// `AgTariffCard` ustunining qat'iy (matnga bog'liq bo'lmagan) qismi:
/// 22dp tepa padding + 12dp past padding + ikkita 2dp oraliq + tanlangan
/// kartaning 2dp chegarasi (tepa va past).
const double _kTariffCardChrome = 42;

/// Uch qatorli matnning haqiqiy balandligi shrift o'lchamidan katta —
/// shriftning o'z leading'i qo'shiladi. Loyiha shriftida (Google Fonts)
/// bu koeffitsient o'lchangan holda ~1.44; 1.5 zaxira bilan olinadi,
/// chunki shrift almashsa metrikasi ham o'zgaradi.
const double _kTariffLineFactor = 1.5;

/// Variant chiplarining barqaror kalitlari.
///
/// `'cash'` va `'card'` ATAYLAB `_paymentMethod` ning qiymatlari bilan bir
/// xil: chip bosilganda qiymat to'g'ridan-to'g'ri o'tadi va oradagi
/// xaritalash (ya'ni xato qilish mumkin bo'lgan joy) umuman qolmaydi.
const String _kOptionCash = 'cash';
const String _kOptionCard = 'card';
const String _kOptionSchedule = 'schedule';

/// Tarif → mashina rasmi. Kalit so'zlar ro'yxati, `switch` EMAS.
///
/// Server tarif nomlarini o'zi belgilaydi va yangisini istalgan payt
/// qo'shishi mumkin ("Premium", "Yuk taksi"). Qattiq kodlangan ro'yxat
/// bo'lsa, yangi tarif rasmsiz (yoki eng yomoni, xato bilan) qolardi —
/// shuning uchun mos keladigani topilmasa `car_econom` ga tushamiz.
///
/// Tartib MUHIM: "Komfort+ biznes" kabi qo'shma nom birinchi mos kelgan
/// kalit bo'yicha hal qilinadi, shuning uchun torroq ma'noli kalitlar
/// (yuk, biznes) kengroqlaridan (komfort) oldinda turadi.
const Map<String, String> _kTariffArtKeywords = <String, String>{
  'van': 'assets/tariffs/car_van.svg',
  'miniven': 'assets/tariffs/car_van.svg',
  'minivan': 'assets/tariffs/car_van.svg',
  'yuk': 'assets/tariffs/car_van.svg',
  'cargo': 'assets/tariffs/car_van.svg',
  'business': 'assets/tariffs/car_business.svg',
  'biznes': 'assets/tariffs/car_business.svg',
  'premium': 'assets/tariffs/car_business.svg',
  'vip': 'assets/tariffs/car_business.svg',
  'lux': 'assets/tariffs/car_business.svg',
  'comfort': 'assets/tariffs/car_comfort.svg',
  'komfort': 'assets/tariffs/car_comfort.svg',
  'standart': 'assets/tariffs/car_comfort.svg',
  'standard': 'assets/tariffs/car_comfort.svg',
};

/// Noma'lum tarif shu rasmga tushadi.
const String _kTariffArtFallback = 'assets/tariffs/car_econom.svg';

/// Kamerani qayta ishga tushirish uchun eng kichik sezilarli farq.
///
/// Koordinatada 1e-6 daraja ≈ 10 sm, chetda 1dp — ikkalasi ham ekranda
/// ko'rinmaydi. Aniq tenglik tekshirilsa, o'lchovdagi piksel osti
/// chayqalishi kamerani HAR KADRDA qayta animatsiya qilardi va xarita
/// foydalanuvchining qo'lidan chiqib ketardi.
const double _kFitCoordEpsilon = 1e-6;
const double _kFitInsetEpsilon = 1;

/// Rasm yo'li → vaqtinchalik ikonka silueti.
///
/// ⚠️ `flutter_svg` loyiha bog'liqliklarida YO'Q va uni qo'shish bu
/// vazifaning doirasidan tashqarida. SVG yo'li rastr dekoderga berilsa
/// karta har qayta chizishda xato yozardi, shuning uchun `AgTariffCard`
/// ga `imageBuilder` beriladi va u tarifga MOS SVG mashinani chizadi — kartalar
/// baribir bir-biridan siluet bilan farq qiladi. Paket qo'shilgan kunda
/// faqat shu jadval `SvgPicture.asset` ga almashadi, tarif → rasm
/// moslashtiruvi esa o'zgarmaydi.
/// Tarifga mos mashina rasmining yo'li.
///
/// Serverning `iconName` maslahati va tarif nomi birga tekshiriladi —
/// server aniq ishora bergan bo'lsa (`"car_van"`), nomni taxmin qilish
/// shart emas.
///
/// Kalit SO'Z BOSHIDAN qidiriladi, satr ichidan emas: "Advance" ichida
/// "van" bor, lekin u miniven emas. So'z boshi esa "Van", "Vanlar",
/// "car_van" ni ham, "Komfort+" ni ham to'g'ri tutadi.
@visibleForTesting
String tariffArtAsset(Tariff tariff) {
  final words = '${tariff.iconName ?? ''} ${tariff.name}'
      .toLowerCase()
      .split(RegExp('[^a-z0-9]+'));
  for (final entry in _kTariffArtKeywords.entries) {
    if (words.any((w) => w.startsWith(entry.key))) return entry.value;
  }
  return _kTariffArtFallback;
}

/// Yandex Go-style tariff screen: route map on top, horizontal tariff cards
/// and a full-width primary order button in a bottom sheet.
class TariffSelectScreen extends StatefulWidget {
  const TariffSelectScreen({
    super.key,
    this.paymentService,
    this.openPaymentCheckout,
  });

  /// Injectable for tests — defaults to a [PaymentService] built from the
  /// real [ApiClient] in the service locator.
  final PaymentService? paymentService;

  /// Injectable for tests — defaults to pushing [PaymentWebViewScreen].
  final OpenPaymentCheckout? openPaymentCheckout;

  @override
  State<TariffSelectScreen> createState() => _TariffSelectScreenState();
}

class _TariffSelectScreenState extends State<TariffSelectScreen> {
  String _paymentMethod = 'cash';
  bool _payingByCard = false;
  bool _routeLoading = false;

  ml.MapLibreMapController? _mapController;

  /// Sheet kontentining balandligini o'lchash uchun — kamera paddingi
  /// shundan hisoblanadi (`map_camera_insets.dart` dagi izohga qarang).
  final GlobalKey _panelContentKey = GlobalKey();

  /// Oxirgi o'lchangan sheet kontenti balandligi. Faqat kameraga ta'sir
  /// qiladi, vidjet daraxtiga emas — shuning uchun `setState` yo'q.
  double? _panelContentHeight;

  /// Kameraga oxirgi QO'LLANGAN moslash. Har kadrda qayta hisoblanadi,
  /// lekin kamera faqat natija o'zgarganda qo'zg'atiladi.
  _CameraFit? _lastCameraFit;

  PaymentService get _paymentService =>
      widget.paymentService ?? PaymentService(apiClient: sl<ApiClient>());

  RouteService get _routeService => sl<RouteService>();

  Future<bool?> _openPaymentCheckout(
    BuildContext context,
    PaymentInitiateResult result,
  ) {
    if (widget.openPaymentCheckout != null) {
      return widget.openPaymentCheckout!(context, result);
    }
    return Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => PaymentWebViewScreen(result: result),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<OrderProvider>();
      provider.loadTariffs();
      // Qamrov ro'yxati bosh ekranda allaqachon so'ralgan bo'lishi mumkin —
      // `loadCities` takrorini o'zi to'xtatadi. Bu yerda ham chaqiriladi,
      // chunki tarif ekraniga saqlangan manzil orqali TO'G'RIDAN-TO'G'RI
      // kelish mumkin va u holda bosh ekran umuman ochilmagan bo'ladi.
      provider.loadCities();
      _loadRoute(provider);
    });
  }

  /// Fetches the real driving route (for the map line) and, from its
  /// distance/duration, the price estimate — the backend has no routing
  /// engine of its own, so distanceKm/durationMin must come from the client.
  Future<void> _loadRoute(OrderProvider provider) async {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    if (pickup == null || dropoff == null) return;

    setState(() => _routeLoading = true);
    final route = await _routeService.getRoute(
      LatLng(pickup.lat, pickup.lng),
      LatLng(dropoff.lat, dropoff.lng),
      waypoints:
          provider.pendingWaypoints.map((w) => LatLng(w.lat, w.lng)).toList(),
    );
    if (!mounted) return;
    setState(() => _routeLoading = false);

    if (route != null) {
      provider.setRoute(
        points: route.points,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      );
    }

    _estimateIfReady(provider);
  }

  void _estimateIfReady(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    if (pickup == null || dropoff == null) return;
    if (provider.tariffs.isEmpty) return;

    final tariff = provider.selectedTariff ?? provider.tariffs.first;
    // Straight-line Haversine fallback if OSRM didn't return a route, so
    // price estimation still works (less accurate than the real route, but
    // better than not estimating at all).
    final distanceKm = provider.routeDistanceKm ??
        (const Distance().as(LengthUnit.Kilometer,
            LatLng(pickup.lat, pickup.lng), LatLng(dropoff.lat, dropoff.lng)));
    final durationMin = provider.routeDurationMin ?? (distanceKm / 30 * 60);

    provider.estimatePrice(
      distanceKm: distanceKm,
      durationMin: durationMin,
      tariffId: tariff.id,
    );
  }

  Future<void> _onConfirmOrder() async {
    final provider = context.read<OrderProvider>();
    if (provider.selectedTariff == null && provider.tariffs.isNotEmpty) {
      provider.selectTariff(provider.tariffs.first);
    }
    // `createOrder` muvaffaqiyatda tanlovni tozalaydi, shuning uchun
    // shoxlanish qarori UNDAN OLDIN olinadi.
    final wasScheduled = provider.isScheduledBooking;
    final success = await provider.createOrder();
    if (!mounted) return;
    if (!success) return;

    // Rejalashtirilgan safarda karta to'lovi bloki BUTUNLAY o'tkazib
    // yuboriladi: `POST /payments/initiate` buyurtma COMPLETED bo'lishini
    // talab qiladi (quyidagi izohga qarang), va rejalashtirilgan safar
    // hali boshlanmagan ham — foydalanuvchiga keraksiz xato ko'rsatilardi.
    if (wasScheduled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Safar rejalashtirildi')),
      );
      Navigator.of(context).pushNamedAndRemoveUntil(
        '/passenger/scheduled',
        (route) => route.settings.name == '/passenger/home',
      );
      return;
    }

    // Order placed. If the passenger chose card, try the real online
    // checkout for it.
    //
    // NOTE — real backend business rule: `POST /payments/initiate`
    // (backend/src/modules/payments/payments.service.ts) only accepts an
    // order once its status is COMPLETED — i.e. after the ride has actually
    // happened, not at order-creation time. A brand-new order (status
    // 'created'/'searching') will be rejected with
    // `400 Order must be completed before payment`. That's expected here,
    // not a client bug: card rides are still fully bookable, the actual
    // charge for them just has to happen post-trip (e.g. from the trip
    // summary once the driver marks it complete) rather than right after
    // tapping "Buyurtma". We still surface the call/response below so the
    // wiring is real and ready to use the moment an order does qualify —
    // and so passengers get a clear message instead of silent failure if a
    // charge attempt is made too early.
    if (_paymentMethod == 'card' && provider.activeOrder != null) {
      setState(() => _payingByCard = true);
      try {
        final result = await _paymentService.initiate(
          orderId: provider.activeOrder!.id,
        );
        if (!mounted) return;
        await _openPaymentCheckout(context, result);
      } on PaymentException catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "To'lovni hozir boshlab bo'lmadi: ${e.message}. "
              "Buyurtma qabul qilindi, safar oxirida to'lov amalga oshiriladi.",
            ),
          ),
        );
      } finally {
        if (mounted) setState(() => _payingByCard = false);
      }
    }

    if (!mounted) return;
    Navigator.of(context)
        .pushNamedAndRemoveUntil('/passenger/home', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          // Sheet balandligi kontentga qarab o'zgaradi (surge banneri
          // chiqdi, rejalashtirish izohi qo'shildi, xato yo'qoldi), kamera
          // esa shu balandlikka bog'liq. Har kadrdan keyin o'lchaymiz va
          // O'ZGARGANDA marshrutni ochiq maydonga qayta moslaymiz.
          //
          // Ro'yxatga olish `Consumer` ICHIDA: provider xabar berganda
          // (marshrut keldi, safar rejalashtirildi) tashqi `build` qayta
          // ishlamaydi — faqat shu quruvchi. Tashqarida yozilsa, kamera
          // aynan o'sha o'zgarishlarni sezmay qolardi.
          WidgetsBinding.instance.addPostFrameCallback((_) => _syncCamera());

          return Stack(
            children: [
              _buildRouteMap(provider),
              // Xarita ustidagi suzuvchi tugma — sheet bilan bir xil
              // yuzada emas, o'z qatlamida turadi.
              SafeArea(
                child: Padding(
                  padding: EdgeInsets.all(context.gutter),
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: AgMapFab(
                      icon: Icons.arrow_back_rounded,
                      semanticsLabel: 'Orqaga',
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ),
                ),
              ),
              _buildFloatingRoutePanel(provider),
              // Telefonda pastdagi sheet, 720dp+ ekranda chap yon panel —
              // xarita marshrutni to'liq ko'rsatib turadi.
              _buildBottomPanel(provider),
            ],
          );
        },
      ),
    );
  }

  /// Manzillar sheet ICHIDAN chiqarilib, xarita USTIDA suzadi.
  ///
  /// Sabab: ilgari "qayerdan → qayerga" pastdagi sheetning birinchi bloki
  /// edi va sheet balandligining uchdan birini yeb qo'yardi. Endi sheet
  /// faqat QARORni (tarif, to'lov, tugma) tashiydi, marshrut esa xarita
  /// bilan bir qatlamda — u doim ko'rinadi va sheet pasayganda ham
  /// yo'qolmaydi.
  Widget _buildFloatingRoutePanel(OrderProvider provider) {
    final gutter = context.gutter;
    final side = context.canSplitMapPanel;
    final distanceKm = provider.routeDistanceKm;

    return Positioned(
      // Telefonda panel orqaga tugmasi OSTIDA turadi; keng ekranda tugma
      // yon panel ustunida qolgani uchun panel u bilan bir sathda boshlanadi.
      top: MediaQuery.paddingOf(context).top +
          gutter +
          (side ? 0 : kMinTapTarget + kSpace3),
      // Yon panel rejimida panel chapdagi ustunni yopib qo'ymasligi kerak.
      left: side ? context.sidePanelWidth + gutter * 2 : gutter,
      right: gutter,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _kRoutePanelMaxWidth),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AgRoutePanel(
                from: provider.pendingPickup?.address ?? 'Joylashuv',
                to: provider.pendingDropoff?.address ?? 'Manzil',
                // Masofa allaqachon hisoblangan (`_loadRoute` → OSRM, yoki
                // Haversine zaxirasi) — panel uni ko'rsatadi, qayta
                // hisoblamaydi.
                distanceLabel: distanceKm == null
                    ? null
                    : Formatters.formatDistance(distanceKm * 1000),
                // Almashtirish tugmasi YO'Q va bu ataylab: bu ekranda
                // marshrut allaqachon qat'iy — narx aynan shu yo'nalish
                // bo'yicha baholangan. Yo'nalishni teskari qilish qayta
                // yo'l qurish va qayta baholashni talab qiladi, ya'ni bu
                // vizual emas, MANTIQIY o'zgarish bo'lardi.
                showSwap: false,
              ),
              // Yuklanish belgisi panel OSTIDA, qat'iy koordinatada emas:
              // panel balandligi manzil uzunligiga qarab o'zgarsa ham
              // ular ustma-ust tushmaydi.
              if (_routeLoading) ...[
                const SizedBox(height: kSpace3),
                const Center(child: _RouteLoadingPill()),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // KAMERA — TO'LDIRILGAN TO'RTBURCHAK (padded-fit)
  //
  // Sheet ekranning pastki qismini doim yopib turadi. Marshrut BUTUN
  // ekranga moslansa, uning markazi sheet ostida qoladi va yo'lovchi
  // safarini ko'rish uchun sheetni pastga surishga majbur bo'ladi.
  // Shuning uchun kamera ochiq maydonga moslanadi: chetlar
  // `MapCameraInsets` da hisoblanadi (ikkala yo'lovchi xarita ekrani —
  // bosh ekran va faol safar — xuddi shu qoidaga bo'ysunadi).
  //
  // `AppVectorMap.fitToContent` shu sababdan ATAYLAB o'chirilgan: u
  // paddingni ichkarida qat'iy saqlaydi (left/right 48, top 96,
  // bottom 260) va sheet balandligini bilmaydi.
  // -------------------------------------------------------------------

  /// Olish nuqtasi. Zaxira markaz — birinchi faol shaharning markazi,
  /// qattiq kodlangan koordinata EMAS: ikkinchi shahar qo'shilganda bu
  /// yerga qaytib tegish kerak bo'lmasin. Shaharlar hali yuklanmagan
  /// bo'lsa `AppConfig` dagi qiymat zaxira bo'lib qoladi — ilova
  /// koordinatasiz xaritani umuman ocha olmaydi.
  LatLng _pickupPoint(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    return pickup != null
        ? LatLng(pickup.lat, pickup.lng)
        : provider.coverage.fallbackCenter;
  }

  /// Tushish nuqtasi — zaxirasi [_pickupPoint] bilan bir xil.
  LatLng _dropoffPoint(OrderProvider provider) {
    final dropoff = provider.pendingDropoff;
    return dropoff != null
        ? LatLng(dropoff.lat, dropoff.lng)
        : provider.coverage.fallbackCenter;
  }

  /// Xaritada CHIZILGAN barcha nuqtalar — kamera aynan shularni sig'diradi.
  /// Ro'yxat `_buildRouteMap` chizadigan narsa bilan bir xil bo'lishi
  /// kerak, aks holda kamera ko'rinmaydigan nuqtaga ham joy ajratadi.
  List<LatLng> _mapPoints(OrderProvider provider) {
    final p = _pickupPoint(provider);
    final d = _dropoffPoint(provider);
    return <LatLng>[
      ...(provider.routePoints.isNotEmpty
          ? provider.routePoints
          : <LatLng>[p, d]),
      p,
      for (final w in provider.pendingWaypoints) LatLng(w.lat, w.lng),
      d,
    ];
  }

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
    _fitCamera();
  }

  void _fitCamera() {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    final points = _mapPoints(context.read<OrderProvider>());
    // Bitta nuqtaning "chegarasi" yo'q — `newLatLngBounds` unga
    // qo'llanmaydi va boshlang'ich markaz/zoom o'z holicha qoladi.
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
      insets: MapCameraInsets.forPanel(
        context,
        panelContentHeight: _panelContentHeight,
      ),
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

  Widget _buildRouteMap(OrderProvider provider) {
    final p = _pickupPoint(provider);
    final d = _dropoffPoint(provider);
    final center =
        LatLng((p.latitude + d.latitude) / 2, (p.longitude + d.longitude) / 2);

    // Real road route from OSRM when available; a straight line is only a
    // fallback for when the route fetch fails (offline, OSRM unreachable).
    final routePoints =
        provider.routePoints.isNotEmpty ? provider.routePoints : [p, d];

    return AppVectorMap(
      initialCenter: center,
      initialZoom: 13.5,
      // ATAYLAB SAQLANADI: marshrut chizig'i minti — sof dekorativ brend
      // aksenti, ma'no matn orqali beriladi.
      route: routePoints,
      markers: [
        AppMapMarker(point: p, icon: AppMapIcon.pickup),
        // Oraliq to'xtashlar borish tartibida — destination_screen'dagi
        // ro'yxat raqamlanishi bilan bir xil.
        for (final waypoint in provider.pendingWaypoints)
          AppMapMarker(
            point: LatLng(waypoint.lat, waypoint.lng),
            icon: AppMapIcon.waypoint,
          ),
        AppMapMarker(point: d, icon: AppMapIcon.dropoff),
      ],
      // Kamerani O'ZIMIZ boshqaramiz — yuqoridagi "TO'LDIRILGAN
      // TO'RTBURCHAK" izohiga qarang.
      fitToContent: false,
      onMapCreated: _onMapCreated,
    );
  }

  Widget _buildBottomPanel(OrderProvider provider) {
    // Ro'yxat yuklanayotganda spinner emas, skeleton — kontent kelganda
    // panel sakramaydi.
    if (provider.state == OrderProviderState.loading &&
        provider.tariffs.isEmpty) {
      return AdaptiveMapPanel(
        layered: true,
        child: AgSurfaceCard(
          // Skeleton ham O'LCHANADI: kamera sheet balandligini shu kalit
          // orqali biladi va kontent kelguncha ham marshrut ochiq
          // maydonda turadi.
          key: _panelContentKey,
          child: const SizedBox(
            height: 200,
            child: AppSkeletonList(itemCount: 2, lines: 2, hasTrailing: true),
          ),
        ),
      );
    }

    final selected = provider.selectedTariff ??
        (provider.tariffs.isNotEmpty ? provider.tariffs.first : null);
    final price = provider.estimatedPrice;
    // Olish nuqtasi xizmat hududidan tashqarida bo'lsa tugma o'chiriladi —
    // sabab esa uning USTIDA yoziladi. Ishlamaydigan tugma sababsiz
    // qoldirilsa, odam ilova buzilgan deb o'ylaydi.
    final coverageWarning = provider.coverageWarning;
    final canOrder = selected != null &&
        coverageWarning == null &&
        provider.state != OrderProviderState.loading &&
        !_payingByCard;

    return AdaptiveMapPanel(
      // QATLAMLI YUZA: panel foni kSurface2, ichidagi bloklar oq. Chuqurlik
      // chegaradan emas, ikki yuzaning farqidan keladi.
      layered: true,
      child: Column(
        // Kamera shu ustunning balandligini o'lchaydi — `_syncCamera`.
        key: _panelContentKey,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTariffRow(provider, selected: selected, price: price),
          const SizedBox(height: kSpace3),
          _buildOptionsRow(provider),
          // Kutish qoidasi BOSISHDAN OLDIN aytiladi. Aytilmagan haq
          // buyurtmadan keyin "meni aldashdi" degan xulosaga olib keladi —
          // bu esa bekor qilish va e'tirozning eng arzon sababi.
          if (selected != null) ...[
            const SizedBox(height: kSpace2),
            _buildWaitingNote(selected),
          ],
          const SizedBox(height: kSpace4),
          // Narx odatdagidan yuqori bo'lsa, sababini aytamiz. Tushuntirilmagan
          // qimmatlashuv o'zboshimchalik bo'lib ko'rinadi va ishonchni yo'qotadi.
          if (provider.isSurging) _buildSurgeNotice(provider.surgeMultiplier),
          if (coverageWarning != null) CoverageNotice(message: coverageWarning),
          if (provider.isScheduledBooking) _buildScheduleNotice(),
          // Serverning oxirgi so'zi ham SHU YERDA ko'rinadi: `POST /orders`
          // 400 bilan "Bu hududda hozircha xizmat ko'rsatilmaymiz" qaytarsa,
          // `createOrder` uni `error` ga yozadi va yo'lovchi sababni o'qiydi
          // (ikki qatlamli himoya: mobil oldindan tekshiradi, server
          // yakuniy qarorni aytadi).
          if (provider.state == OrderProviderState.error &&
              provider.error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: kSpace3),
              child: InlineErrorWidget(message: provider.error!),
            ),
          // Asosiy CTA — to'q yashil gradient, ustida OQ matn (5.38:1).
          Semantics(
            button: true,
            enabled: canOrder,
            child: AppPressable(
              onTap: canOrder ? _onConfirmOrder : null,
              haptic: AppHapticLevel.impact,
              pressedScale: 0.98,
              minTapTarget: false,
              child: Container(
                width: double.infinity,
                height: kControlHeight,
                decoration: BoxDecoration(
                  gradient: kGradientCta,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCta,
                ),
                alignment: Alignment.center,
                child: provider.state == OrderProviderState.loading ||
                        _payingByCard
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(kOnPrimary),
                        ),
                      )
                    // NIMAGA `FittedBox`, `Flexible` EMAS.
                    //
                    // Tugmada ikkita matn bor va IKKALASI ham to'liq
                    // o'qilishi kerak: yozuv qaysi amal ekanini, narx esa
                    // qanchaga ekanini aytadi. `Flexible` + ellipsis
                    // ulardan birini kesardi — "Rejalashtiri…" yoki
                    // "12 500 s…" (kesilgan narx esa shunchaki yolg'on).
                    //
                    // Tizim shrifti 2x ga ko'tarilganda bu qator 320dp li
                    // ekranda 33px, 360dp da 1.3px, yon panelda 17px toshib
                    // ketardi — ya'ni kontent KO'RINMAY qolardi. `scaleDown`
                    // faqat sig'magan holatda kichraytiradi: odatiy
                    // shkalada tugma piksel-pikselgacha o'sha-o'sha.
                    : FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              provider.isScheduledBooking
                                  ? 'Rejalashtirish'
                                  : 'Buyurtma',
                              maxLines: 1,
                              style: const TextStyle(
                                fontSize: kFontH3,
                                fontWeight: FontWeight.w800,
                                color: kOnPrimary,
                              ),
                            ),
                            if (price != null) ...[
                              const SizedBox(width: kSpace2),
                              ExcludeSemantics(
                                child: Container(
                                  width: 5,
                                  height: 5,
                                  decoration: BoxDecoration(
                                    color: kOnPrimary.withValues(alpha: 0.7),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                              const SizedBox(width: kSpace2),
                              // Tarif almashtirilganda narx sakramaydi —
                              // eskisi o'chib, yangisi paydo bo'ladi.
                              AnimatedSwitcher(
                                duration: kDurationBase,
                                transitionBuilder: (child, anim) =>
                                    FadeTransition(
                                  opacity: anim,
                                  child: SizeTransition(
                                    sizeFactor: anim,
                                    axis: Axis.horizontal,
                                    child: child,
                                  ),
                                ),
                                child: Text(
                                  Formatters.formatPrice(price),
                                  key: ValueKey(price),
                                  maxLines: 1,
                                  style: const TextStyle(
                                    fontSize: kFontH3,
                                    fontWeight: FontWeight.w800,
                                    color: kOnPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Gorizontal tarif kartalari — ekranning imzo bloki.
  ///
  /// Kartalar `AgSurfaceCard` ga O'RALMAYDI: `AgTariffCard` ning o'zi oq
  /// karta, panel esa `kSurface2`. Oq kartani yana oq karta ichiga solish
  /// qatlamni yo'q qilardi (oq ustidagi oq ajralmaydi).
  Widget _buildTariffRow(
    OrderProvider provider, {
    required Tariff? selected,
    required double? price,
  }) {
    if (provider.tariffs.isEmpty) {
      return const AgSurfaceCard(
        // Bo'sh holat o'z ichki bo'shlig'ini o'zi beradi — karta padding'i
        // ustiga qo'shilsa blok ikki barobar balandlashardi.
        //
        // Balandlik ham QAT'IY BERILMAYDI: ilgari bu blok kartalar qatori
        // bilan bitta `SizedBox` ni bo'lishardi va o'sha yerdagi 140/152dp
        // 360dp li ekranda ikonka+sarlavha ustunini toshirib yuborardi
        // (RenderFlex overflow). `AppEmptyState` o'z o'lchamini o'zi biladi.
        padding: EdgeInsets.zero,
        child: AppEmptyState(
          icon: Icons.local_taxi_outlined,
          title: 'Tariflar mavjud emas',
          compact: true,
        ),
      );
    }

    return SizedBox(
      height: _tariffRowHeight(context),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        // Mashina rasmi karta tepasidan `artOverhang` chiqadi, `ListView`
        // esa o'z ko'rish maydonini KESADI — joy padding bilan ochilmasa
        // siluetning yuqori qismi qirqilib qolardi.
        padding: const EdgeInsets.only(top: AgTariffCard.artOverhang),
        itemCount: provider.tariffs.length,
        separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
        itemBuilder: (context, i) {
          final t = provider.tariffs[i];
          final isSel = selected?.id == t.id;
          final surging = t.surgeMultiplier > 1.0;

          return SizedBox(
            width: _kTariffCardWidth,
            // Vaqtincha o'chirilgan tarif (`isActive: false`) YASHIRILMAYDI —
            // foydalanuvchi variant BORLIGINI bilsin. Lekin u bosilmasligi
            // ko'rinib ham turishi kerak: `AgTariffCard` da o'chirilgan
            // holat yo'q, shuning uchun butun karta xiralashtiriladi.
            // O'chirilgan boshqaruvga WCAG kontrast talabi qo'yilmaydi.
            child: Opacity(
              opacity: t.isAvailable ? 1 : 0.45,
              child: Stack(
                // Nishon karta burchagida, rasm esa tepasidan tashqarida —
                // ikkalasi ham kesilmasligi kerak.
                clipBehavior: Clip.none,
                children: [
                  AgTariffCard(
                    name: t.name,
                    // Valyuta yozuvi ("UZS") kartada TAKRORLANMAYDI: u
                    // pastdagi CTA da to'liq ko'rinadi, kartada esa 112dp
                    // kenglikda raqamni ellipsisga tushirib yuborardi.
                    priceLabel: isSel && price != null
                        ? Formatters.formatAmount(price)
                        : '~${Formatters.formatAmount(t.minFare)}',
                    // Uchinchi qatorda kelish vaqti yo'q — server buni
                    // bermaydi va uni o'ylab topish yaramaydi. O'rniga
                    // tarifga xos haqiqiy ma'lumot: talab yuqori bo'lsa
                    // ogohlantirish, aks holda sig'im.
                    etaLabel:
                        surging ? 'Talab yuqori' : "${t.maxPassengers} o'rin",
                    assetPath: tariffArtAsset(t),
                    imageBuilder: _buildTariffArt,
                    selected: isSel,
                    onTap: t.isAvailable
                        ? () {
                            // Haptikani `AgTariffCard` o'zi beradi
                            // (`AppHapticLevel.select`) — bu yerda takror
                            // chaqirilsa ikki marta titrardi.
                            provider.selectTariff(t);
                            _estimateIfReady(provider);
                          }
                        : null,
                  ),
                  if (surging)
                    Positioned(
                      top: _kSurgeBadgeInset,
                      right: _kSurgeBadgeInset,
                      // `AgTariffCard.badge` ISHLATILMAYDI: uning nishoni
                      // mint (aksent/chegirma ma'nosi), talab oshishi esa
                      // OGOHLANTIRISH — amber. Rangni almashtirish nishonning
                      // ma'nosini teskarisiga o'girardi.
                      child: IgnorePointer(
                        // Nishon kartaning tegish maydonini teshib
                        // qo'ymasligi kerak; ma'nosi ("Talab yuqori")
                        // ekran o'quvchiga karta yorlig'i orqali yetadi.
                        child: ExcludeSemantics(
                          child: _SurgeBadge(t.surgeMultiplier),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(delay: (i * 70).ms, duration: 350.ms)
              .slideX(begin: 0.2, curve: Curves.easeOut);
        },
      ),
    );
  }

  /// Tarif qatorining balandligi matn shkalasiga ergashadi.
  ///
  /// Qat'iy raqam yozilsa, tizim shrifti kattalashtirilgan qurilmada
  /// karta ichidagi ustun toshib ketardi (RenderFlex overflow). Karta
  /// ustuni uch qatordan iborat — nom (12.5), narx (`kFontTitle`) va
  /// izoh (10.5); o'lchamlar `AgTariffCard` ning o'zidan olingan.
  double _tariffRowHeight(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final lines =
        scaler.scale(12.5) + scaler.scale(kFontTitle) + scaler.scale(10.5);
    // 4dp — yaxlitlash uchun zaxira.
    return AgTariffCard.artOverhang +
        _kTariffCardChrome +
        lines * _kTariffLineFactor +
        4;
  }

  /// Tarif mashinasi — kartaning tepa chekkasidan chiqib turadigan rasm.
  ///
  /// `AgTariffCard` ataylab `flutter_svg` ga bog'lanmagan (rasm formati
  /// chaqiruvchining qarori), shuning uchun vektor chizish shu yerda.
  ///
  /// ⚠️ Rasm DEKORATIV: ma'no kartaning matnida (nom, narx, ETA), shuning
  /// uchun ekran o'quvchidan yashiriladi — aks holda har tarifda ortiqcha
  /// "rasm" e'loni o'qiladi.
  Widget _buildTariffArt(BuildContext context, String assetPath) {
    return ExcludeSemantics(
      child: SvgPicture.asset(
        assetPath,
        width: 82,
        height: 38,
        fit: BoxFit.contain,
        // Asset yo'q yoki buzuq bo'lsa karta bo'sh joy bilan qolmaydi.
        placeholderBuilder: (_) => const Icon(
          Icons.local_taxi_rounded,
          size: 34,
          color: kInkSubtle,
        ),
      ),
    );
  }

  /// Talab yuqori bo'lgan paytdagi narx oshishi haqida ochiq xabar.
  ///
  /// Koeffitsient serverdan keladi (SurgeService) va hududdagi buyurtma /
  /// bo'sh haydovchi nisbatidan hisoblanadi. Foydalanuvchiga raqamni ham
  /// ko'rsatamiz — "1.5x" mavhum "narx yuqori" dan ancha halolroq.
  Widget _buildSurgeNotice(double multiplier) {
    return Container(
      margin: const EdgeInsets.only(bottom: kSpace3),
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace3,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const ExcludeSemantics(
            child:
                Icon(Icons.trending_up_rounded, color: kWarningDeep, size: 20),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Text(
              'Hozir talab yuqori — narx ${multiplier.toStringAsFixed(1)}x. '
              'Bir necha daqiqadan keyin arzonlashishi mumkin.',
              style: const TextStyle(
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
                color: kWarningDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Kutish haqi — YAGONA qator, ko'rsatilgan narxdan tashqarida.
  ///
  /// ⚠️ FAQAT MATN: qiymatlar tanlangan tarifdan o'qiladi
  /// (`GET /tariffs` → `freeWaitMinutes`, `waitingPricePerMinute`), bu yerda
  /// hech narsa hisoblanmaydi. Narxni ham, kutish haqini ham server
  /// hisoblaydi — mobil tomonda takror hisob ikki xil raqam berardi.
  ///
  /// Ogohlantirish emas, IZOH ohangida: bu odatiy qoida, favqulodda hol
  /// emas. Amber quti har buyurtmada chiqsa, u tez orada ko'rinmay qoladi
  /// va haqiqiy ogohlantirishlarning (talab yuqori) kuchini ham yeydi.
  Widget _buildWaitingNote(Tariff tariff) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: kSpace1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ikonka DEKORATIV — ma'no matnda. Rang kInkSubtle: qoida bo'yicha
          // u faqat ikonka va chegara uchun.
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: ExcludeSemantics(
              child: Icon(Icons.timer_outlined, size: 15, color: kInkSubtle),
            ),
          ),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              'Haydovchi kelgach ${tariff.freeWaitMinutes} daqiqa kutish '
              'bepul, keyin har boshlangan daqiqa uchun '
              '${Formatters.formatSom(tariff.waitingPricePerMinute)}. '
              "Bu haq ko'rsatilgan narxdan alohida qo'shiladi.",
              style: const TextStyle(
                fontSize: kFontCaption,
                fontWeight: FontWeight.w600,
                // Yozuvda kInkMuted — kInkSubtle matn uchun juda och.
                color: kInkMuted,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// To'lov usuli va safar vaqti — bitta ixcham chiplar qatorida.
  ///
  /// Bu blok `AgSurfaceCard` ga o'raladi: chiplar `kSurface2` fonli panel
  /// ustida yolg'iz turganda "sochilib ketgan" ko'rinadi, oq karta esa
  /// ularni bitta qaror guruhiga bog'laydi.
  Widget _buildOptionsRow(OrderProvider provider) {
    final scheduledAt = provider.scheduledAt;
    final scheduleLabel = scheduledAt == null
        ? 'Hozir'
        : Formatters.formatScheduleLabel(scheduledAt);

    return AgSurfaceCard(
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace3,
        vertical: kSpace2,
      ),
      // Qator gorizontal skrollga o'ralgan (`AgOptionChips` ichida) —
      // uchinchi chip tor ekranda (360dp) toshib ketmasligi uchun.
      child: AgOptionChips(
        items: [
          AgOptionChipItem(
            id: _kOptionCash,
            label: 'Naqd',
            icon: Icons.payments_rounded,
            active: _paymentMethod == _kOptionCash,
          ),
          AgOptionChipItem(
            id: _kOptionCard,
            label: 'Karta',
            icon: Icons.credit_card_rounded,
            active: _paymentMethod == _kOptionCard,
          ),
          AgOptionChipItem(
            id: _kOptionSchedule,
            label: scheduleLabel,
            icon: Icons.schedule_rounded,
            active: provider.isScheduledBooking,
            // "14:30" yolg'iz o'zi nimani anglatishini aytmaydi.
            semanticsLabel: 'Safar vaqti: $scheduleLabel',
          ),
        ],
        onTap: (id) => _onOptionTap(id, provider),
      ),
    );
  }

  /// Chip bosilishi. MANTIQ o'zgarmaydi: `cash`/`card` — `_paymentMethod`
  /// ning ayni o'sha qiymatlari (`_onConfirmOrder` shu satrni o'qiydi),
  /// uchinchisi esa avvalgidek rejalashtirish sheetini ochadi.
  void _onOptionTap(String id, OrderProvider provider) {
    switch (id) {
      case _kOptionCash:
      case _kOptionCard:
        setState(() => _paymentMethod = id);
      case _kOptionSchedule:
        _pickScheduleTime(provider);
    }
  }

  Future<void> _pickScheduleTime(OrderProvider provider) async {
    final picked = await ScheduleRideSheet.show(
      context,
      initialValue: provider.scheduledAt,
    );
    if (!mounted) return;
    // `null` — foydalanuvchi "Hozir buyurtma qilaman" ni tanladi yoki
    // sheetni yopdi. Ikkalasi ham rejalashtirishni bekor qiladi.
    provider.setScheduledAt(picked);
  }

  /// Rejalashtirilgan safarda narx nima uchun o'zgarmasligini aytadi.
  ///
  /// Bu `_buildSurgeNotice` bilan bir xil falsafa: yo'lovchi narx haqidagi
  /// qoidani OLDINDAN bilishi kerak, aks holda u kutilmagan narsa kutadi.
  ///
  /// ⚠️ VA'DA ANIQLASHTIRILDI. Ilgari bu yerda "narx qotiriladi va
  /// o'zgarmaydi" deb yozilgan edi — endi bu to'liq rost emas: kutish haqi
  /// qat'iy narx kafolatidan TASHQARIDA undiriladi
  /// (`orders-completion.service.ts`). Matn o'zgartirilmasa, chekdagi
  /// kutish qatori va'dani buzgandek ko'rinardi.
  Widget _buildScheduleNotice() {
    return Container(
      margin: const EdgeInsets.only(bottom: kSpace3),
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace3,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        color: kInfoLight,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: const Row(
        children: [
          ExcludeSemantics(
            child: Icon(Icons.lock_clock_rounded, color: kInfoDeep, size: 20),
          ),
          SizedBox(width: kSpace3),
          Expanded(
            child: Text(
              "Narx hozir qotiriladi va safar kunida o'zgarmaydi — "
              'kutish haqi bundan tashqari. Haydovchi belgilangan vaqtdan '
              '10 daqiqa oldin qidiriladi.',
              style: TextStyle(
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
                color: kInfoDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small amber chip shown on a tariff card when demand-surge pricing is
/// active (backend's `surgeMultiplier` on GET /tariffs is > 1.0), e.g. "x1.5".
class _SurgeBadge extends StatelessWidget {
  const _SurgeBadge(this.surgeMultiplier);

  final double surgeMultiplier;

  @override
  Widget build(BuildContext context) {
    final label = surgeMultiplier == surgeMultiplier.roundToDouble()
        ? 'x${surgeMultiplier.toStringAsFixed(0)}'
        : 'x${surgeMultiplier.toStringAsFixed(1)}';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusXs),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: kFontMicro,
          fontWeight: FontWeight.w800,
          color: kWarningDeep,
        ),
      ),
    );
  }
}

/// Kameraga qo'llangan moslash — chegara va chetlar birgalikda.
///
/// Ikkalasi BIRGA saqlanadi, chunki kamera ikkalasidan ham o'zgaradi:
/// marshrut yangilanganda chegara, sheet o'sganda esa chetlar.
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

  /// Kamerani qayta qo'zg'atishga arziydigan farq bormi.
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

class _RouteLoadingPill extends StatelessWidget {
  const _RouteLoadingPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusFull),
        boxShadow: kShadowPop,
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
          ),
          SizedBox(width: kSpace2),
          Text(
            "Yo'nalish yuklanmoqda...",
            style: TextStyle(
              fontSize: kFontCaption,
              fontWeight: FontWeight.w600,
              color: kInk,
            ),
          ),
        ],
      ),
    );
  }
}
