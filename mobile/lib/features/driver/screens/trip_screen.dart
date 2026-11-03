import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/config/map_style.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/navigation/follow_camera.dart';
import 'package:angren_taxi/features/driver/navigation/speed_camera_controller.dart';
import 'package:angren_taxi/features/driver/navigation/turn_by_turn_guidance.dart';
import 'package:angren_taxi/features/driver/screens/rate_passenger_screen.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/widgets/delivery_info_card.dart';
import 'package:angren_taxi/features/driver/widgets/dropoff_incident_panel.dart';
import 'package:angren_taxi/features/driver/widgets/maneuver_banner.dart';
import 'package:angren_taxi/features/driver/widgets/parcel_info_card.dart';
import 'package:angren_taxi/features/driver/widgets/parcel_pin_dialog.dart';
// `MapCameraInsets` yo'lovchi papkasida yashaydi, lekin u ekranga emas
// TARTIBGA bog'liq: sheet ostida qolgan maydonni hisoblaydi. Haydovchi
// xarita ekranlari ham xuddi shu qoidaga bo'ysunishi kerak, aks holda
// ikkita turli "sheet ostida markazlashish" xatosi paydo bo'ladi.
import 'package:angren_taxi/features/driver/widgets/speed_camera_banner.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/features/safety/call_relay.dart';
import 'package:angren_taxi/features/trip/meter/live_meter_card.dart';
import 'package:angren_taxi/features/trip/meter/meter_service.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart' show PublicSettings;
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_action_row.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart' show AgSurfaceCard;
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
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
/// (Naqsh `passenger/screens/tariff_select_screen.dart` dan.)
const double _kFitCoordEpsilon = 1e-6;
const double _kFitInsetEpsilon = 1;

class TripScreen extends StatefulWidget {
  const TripScreen({super.key, this.sosService, this.meterService, this.guidance});

  /// Injectable for tests — defaults to a [SosService] built from the real
  /// [ApiClient] in the service locator (same pattern as
  /// PassengerHomeScreen.sosService).
  final SosService? sosService;

  /// Taksometr kartasi uchun — testlarda almashtiriladi.
  final MeterService? meterService;

  /// Ilova ichidagi navigatsiya — testlarda almashtiriladi. `null` bo'lsa
  /// service locator'dan quriladi.
  final TurnByTurnGuidance? guidance;

  @override
  State<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  ml.MapLibreMapController? _mapController;
  /// Haydovchining joyi. ⚠️ `setState` EMAS: GPS 5 metrda bir keladi va
  /// ilgari har biri butun ekranni (panel, tugmalar, barcha markerlar)
  /// qayta qurardi. Endi faqat xarita va manevr banneri tinglaydi.
  final ValueNotifier<LatLng> _location = ValueNotifier(
    const LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
  );
  LatLng get _currentLocation => _location.value;
  /// Safar soati shu paytdan sanaydi. Soniya sanog'i [_TripClock] ichida:
  /// ilgari bu yerdagi `Timer` har soniyada `setState` chaqirib, butun
  /// ekranni (xarita, panel, kartalar) qayta qurardi.
  final DateTime _tripStartedAt = DateTime.now();

  /// Sheet kontentining balandligini o'lchash uchun — kamera paddingi
  /// shundan hisoblanadi (`map_camera_insets.dart` dagi izohga qarang).
  final GlobalKey _panelContentKey = GlobalKey();

  /// Sheet yig'ilgan — xarita deyarli butun ekranda, pastda faqat
  /// "yakunlash" qoladi (haydovchi yo'lni ko'rishi kerak, kartalarni emas).
  bool _panelCollapsed = false;

  /// Oxirgi o'lchangan sheet kontenti balandligi. Faqat kameraga ta'sir
  /// qiladi, vidjet daraxtiga emas — shuning uchun `setState` yo'q.
  double? _panelContentHeight;

  /// Kameraga oxirgi QO'LLANGAN moslash — natija o'zgarmasa qayta
  /// animatsiya qilinmaydi.
  _CameraFit? _lastCameraFit;

  /// Birinchi GPS ping'idan keyin kamera umumiy ko'rinishdan haydovchiga
  /// ERGASHISHGA o'tadi (navigator rejimi) — `navigation_screen.dart` bilan
  /// bir xil xulq.
  bool _followingDriver = false;

  /// Navigator kamerasi — `follow_camera.dart` dagi izohga qarang.
  final FollowCamera _camera = FollowCamera();

  MeterService get _meterService =>
      widget.meterService ?? MeterService(sl<ApiClient>());

  SosService get _sosService =>
      widget.sosService ?? SosService(apiClient: sl<ApiClient>());

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _speedCameras?.dispose();
    _location.dispose();
    // Ovoz ham to'xtaydi — safar tugagan ekranda burilish haqida gapirmasin.
    _guidance?.dispose();
    _returnSync?.cancel();
    super.dispose();
  }

  // -------------------------------------------------------------------
  // ILOVA ICHIDAGI NAVIGATSIYA — yo'lovchi bilan manzilgacha.
  //
  // Ilgari bu bosqichda faqat "Navigatorda ochish" bor edi: haydovchi
  // ilovadan chiqib ketardi. Endi olishga borishdagi bilan AYNAN bir xil
  // banner, ovoz ("100 metrdan keyin o'ngga buriling") va chetga chiqqanda
  // qayta qurish. Taksometrda manzil yo'q — navigatsiya ham yo'q.
  // -------------------------------------------------------------------
  TurnByTurnGuidance? _guidance;
  StreamSubscription<Position>? _positionSubscription;

  /// Tezlik kameralari haqida ogohlantirish. Birinchi GPS'da yaratiladi —
  /// ovoz servisi bo'lmagan muhitda (testlar) umuman ishlamaydi.
  SpeedCameraController? _speedCameras;

  void _feedSpeedCameras(Position position) {
    if (_speedCameras == null) {
      if (!sl.isRegistered<VoiceGuide>()) return;
      setState(() => _speedCameras = SpeedCameraController(voice: sl<VoiceGuide>()));
    }
    _speedCameras!.onPosition(position);
  }

  Widget _buildSpeedCameraBanner() {
    final cameras = _speedCameras;
    if (cameras == null) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: cameras,
      builder: (context, _) {
        final alert = cameras.alert;
        if (alert == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: kSpace2),
          child: SpeedCameraBanner(alert: alert),
        );
      },
    );
  }

  /// Haqiqiy GPS kelganmi. Kelmaguncha mashina CHIZILMAYDI va marshrut
  /// so'ralmaydi — aks holda ikkalasi ham shahar markazidagi standart
  /// nuqtadan boshlanardi.
  bool _hasFix = false;

  /// Marshrutni yuklab, ovozni tayyorlaydi. Marshrut kelmasa
  /// [TurnByTurnGuidance] keyingi ping'larda o'zi qayta so'raydi.
  Future<void> _startGuidance(Order order) async {
    if (order.isMetered || _guidance != null || !_hasFix) return;
    final guidance = widget.guidance ??
        TurnByTurnGuidance(routes: sl<RouteService>(), voice: sl<VoiceGuide>());
    // Banner va marshrut chizig'i yo'l-yo'riqni o'zlari tinglaydi
    // (`ListenableBuilder`); bu yerda faqat bir marta — ular paydo bo'lsin.
    setState(() => _guidance = guidance);
    _guidanceToPickup = order.isReturning;
    await guidance.start(
      _currentLocation,
      _navTarget(order),
      waypoints: order.isReturning
          ? const []
          : [for (final w in order.waypoints) LatLng(w.lat, w.lng)],
    );
  }

  // -------------------------------------------------------------------
  // QAYTARISH YO'LI (docs/INCIDENT-POLICY.md §2)
  //
  // "Yetkazib bo'lmadi" dan keyin safar `in_progress` qoladi, lekin manzil
  // OLISH NUQTASIGA (restoran/do'kon/yuboruvchi) almashadi: navigatsiya,
  // marker va kamera shu nuqtaga. Safarni kuryer emas, qabul qiluvchi
  // tomon yopadi — `order:returned` kelguncha ekran shu holatda turadi.
  // -------------------------------------------------------------------

  /// Navigatsiya hozir olish nuqtasiga (qaytarish) qurilganmi.
  bool? _guidanceToPickup;

  /// Qaytarish yo'lida socket yo'qolsa ham tasdiq sezilsin — zaxira.
  Timer? _returnSync;
  static const Duration _returnSyncInterval = Duration(seconds: 30);

  LatLng _navTarget(Order order) => order.isReturning
      ? LatLng(order.pickup.lat, order.pickup.lng)
      : LatLng(order.dropoff.lat, order.dropoff.lng);

  /// Holat qaytarishga o'tganda navigatsiyani qayta quradi va zaxira
  /// sinxronlashni yoqadi/o'chiradi. Har `build` dan keyin chaqiriladi.
  void _syncReturnState(Order order) {
    if (!mounted) return;
    final returning = order.isReturning;
    final guidance = _guidance;
    if (guidance != null && _guidanceToPickup != returning) {
      _guidanceToPickup = returning;
      _lastCameraFit = null;
      unawaited(guidance.start(_currentLocation, _navTarget(order)));
      _fitCamera();
    }
    if (returning && _returnSync == null) {
      final provider = context.read<DriverProvider>();
      _returnSync = Timer.periodic(_returnSyncInterval, (_) => provider.resyncActiveTrip());
    } else if (!returning && _returnSync != null) {
      _returnSync?.cancel();
      _returnSync = null;
    }
  }

  /// Topshirish manzilidagi bepul kutish (`dropoffFreeWaitMinutes`).
  /// Hamyon provayderi bo'lmagan muhitda (eski testlar) — standart qiymat.
  int get _dropoffFreeWaitMinutes =>
      Provider.of<DriverWalletProvider?>(context, listen: false)
          ?.settings
          .dropoffFreeWaitMinutes ??
      PublicSettings.kDefaultDropoffFreeWaitMinutes;

  Future<void> _onDropoffArrived() async {
    final provider = context.read<DriverProvider>();
    final ok = await provider.markDropoffArrived();
    if (!mounted || ok) return;
    _showError(provider.error);
  }

  Future<void> _onDeliveryFailed() async {
    final reason = await showDeliveryFailureReasonSheet(context);
    if (reason == null || !mounted) return;
    final provider = context.read<DriverProvider>();
    final ok = await provider.markDeliveryFailed(reason);
    if (!mounted || ok) return;
    _showError(provider.error);
  }

  void _showError(String? message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message ?? context.l10n.drvCompleteFailed)),
    );
  }

  /// `order:returned` keldi — safar yopildi. Oyna bir marta ko'rsatiladi.
  void _handleReturnedTrip(DriverProvider provider) {
    final returned = provider.returnedTrip;
    if (returned == null || _returnedShown) return;
    _returnedShown = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      provider.consumeReturnedTrip();
      _showFinishedDialog(context.l10n.drvReturnedSuccess, onContinue: () {
        Navigator.of(context).pushNamedAndRemoveUntil('/driver/home', (route) => false);
      });
    });
  }

  bool _returnedShown = false;

  /// GPS oqimi HAR safarda ulanadi. Ilgari u faqat navigatsiya bilan birga
  /// ulanardi va taksometr safarida (manzil yo'q) mashina butun safar
  /// davomida bir joyda qotib turardi.
  void _listenToPosition() {
    try {
      // 5 m — "hozir buriling" oynasini o'tkazib yubormaslik uchun
      // (navigation_screen bilan bir xil sabab).
      _positionSubscription = sl<LocationService>()
          .getPositionStream(distanceFilter: 5)
          .listen(_onPosition, onError: (Object _) {}, cancelOnError: false);
    } catch (_) {
      // Joylashuv oqimi yo'q — ekran statik qoladi, yiqilmaydi.
    }
  }

  void _onPosition(Position position) {
    if (!mounted) return;
    final here = LatLng(position.latitude, position.longitude);
    _hasFix = true;
    _location.value = here;
    final guidance = _guidance;
    if (guidance != null) {
      guidance.onPosition(here);
    } else {
      final order = context.read<DriverProvider>().activeOrder;
      if (order != null) _startGuidance(order);
    }
    _camera.onPosition(position);
    _feedSpeedCameras(position);
    _followingDriver = true;
    _followDriver();
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (!mounted) return;
    if (position != null) {
      _hasFix = true;
      _location.value = LatLng(position.latitude, position.longitude);
      // Ilgari bu yerda `newLatLngZoom` bor edi — u mashinani ekran
      // MARKAZIGA qo'yardi, markaz esa sheet ostida qoladi. Endi kamera
      // ochiq maydonga moslanadi (pastdagi "TO'LDIRILGAN TO'RTBURCHAK").
      _fitCamera();
      final order = context.read<DriverProvider>().activeOrder;
      if (order != null) _startGuidance(order);
    }
    _listenToPosition();
  }

  // -------------------------------------------------------------------
  // KAMERA — TO'LDIRILGAN TO'RTBURCHAK (padded-fit)
  //
  // Sheet ekranning pastki qismini doim yopib turadi. Manzil BUTUN ekranga
  // moslansa, uning markazi sheet ostida qoladi va haydovchi safarini
  // ko'rish uchun ekranni surishga majbur bo'ladi — HARAKATDA bu ikki qo'l
  // va bir necha soniya nigoh degani.
  //
  // Naqsh `passenger/screens/tariff_select_screen.dart` dan ko'chirilgan:
  // sheet balandligi `GlobalKey` bilan o'lchanadi, chetlar
  // `MapCameraInsets` da hisoblanadi, oxirgi qo'llangan moslash saqlanadi.
  //
  // `AppVectorMap.fitToContent` shu sababdan ATAYLAB o'chirilgan: u
  // paddingni ichkarida qat'iy saqlaydi va sheet balandligini bilmaydi.
  // -------------------------------------------------------------------

  /// Xaritada CHIZILGAN nuqtalar — kamera aynan shularni sig'diradi.
  /// Ro'yxat `_buildMap` chizadigan markerlar bilan bir xil bo'lishi kerak.
  List<LatLng> _mapPoints(Order order) => order.isMetered
      // Taksometr: manzil yo'q — mashina atrofidagi ~800 m.
      ? <LatLng>[
          LatLng(_currentLocation.latitude - 0.004, _currentLocation.longitude - 0.004),
          LatLng(_currentLocation.latitude + 0.004, _currentLocation.longitude + 0.004),
        ]
      : <LatLng>[
          _currentLocation,
          _navTarget(order),
        ];

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
    // Ergashishda kamera ping'da yangilanadi; bu yerda faqat sheet
    // balandligi o'zgargan bo'lsa aralashamiz.
    if (_camera.insetsChanged(_followInsets())) _followDriver();
  }

  MapCameraInsets _followInsets() => MapCameraInsets.forPanel(
        context,
        panelContentHeight: _panelContentHeight,
      );

  Future<void> _followDriver() async {
    final controller = _mapController;
    if (controller == null || !mounted) return;
    await _camera.follow(controller, _currentLocation, _followInsets());
  }

  void _fitCamera() {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    final order = context.read<DriverProvider>().activeOrder;
    if (order == null) return;

    final points = _mapPoints(order);
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

  // -------------------------------------------------------------------
  // AMALLAR
  // -------------------------------------------------------------------

  /// Safarni yakunlaydi.
  ///
  /// ⚠️ TASDIQ DIALOGI OLIB TASHLANDI. Ilgari bu yerda `AlertDialog`
  /// ("Yakunlaysizmi? [Bekor qilish] [Yakunlash]") turardi. Harakatdagi
  /// avtomobilda modal himoya bermaydi — u ekranni (xarita, manzil, SOS)
  /// yopadi va tasodifiy teginish baribir "Yakunlash" ga tushishi mumkin.
  /// Himoya endi JESTDA: `AgSlideAction` uzun, yo'naltirilgan surish talab
  /// qiladi, uni tebranish yoki tasodifiy teginish hosil qila olmaydi.
  /// Sabab to'liq `shared/widgets/ag_slide_action.dart` boshida yozilgan.
  ///
  /// Chaqiruvlar ketma-ketligi O'ZGARMADI: `completeTrip()` → muvaffaqiyat
  /// oynasi → baholash ekrani.
  Future<void> _onCompleteTrip(Order order, DriverServiceWording wording) async {
    final provider = context.read<DriverProvider>();
    // Posilka faqat qabul qiluvchi aytgan PIN bilan topshiriladi. Bekor
    // qilinsa hech narsa yuborilmaydi — haydovchi qayta surib urinadi.
    // Ovqat/market ham faqat mijoz aytgan topshirish kodi bilan
    // (docs/INCIDENT-POLICY.md §2). Noto'g'ri kodda server qolgan urinishlar
    // sonini, 5 tadan keyin esa "dispetcherga murojaat" ni aytadi — matn
    // pastdagi xabarda.
    String? deliveryPin;
    if (order.requiresHandoverCode) {
      deliveryPin = order.isParcel
          ? await showParcelPinDialog(context)
          : await showParcelPinDialog(
              context,
              title: context.l10n.drvHandoverCodeTitle,
              hint: context.l10n.drvHandoverCodeHint,
            );
      if (deliveryPin == null || !mounted) return;
    }
    await provider.completeTrip(deliveryPin: deliveryPin);

    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      _showSuccessAndNavigate(order, wording);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? context.l10n.drvCompleteFailed),
          // Kod xatosi/urinishlar soni — o'qib ulgurilsin.
          duration: const Duration(seconds: 6),
        ),
      );
    }
  }

  void _showSuccessAndNavigate(Order order, DriverServiceWording wording) {
    _showFinishedDialog(wording.completeSuccessMessage, onContinue: () {
      // Land on /driver/home first (clearing the trip stack beneath
      // it), then push the rating screen on top — its own
      // submit/skip just calls Navigator.pop(), which then correctly
      // reveals home instead of stale navigation/arrived screens.
      Navigator.of(context).pushNamedAndRemoveUntil(
        '/driver/home',
        (route) => false,
      );
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => RatePassengerScreen(
            orderId: order.id,
            passengerPhone: order.passengerName ?? order.passengerPhone ?? '',
            clientLabel: wording.clientLabel,
          ),
        ),
      );
    });
  }

  void _showFinishedDialog(String message, {required VoidCallback onContinue}) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusLg),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Yorug' fonda ma'noli yashil — kPrimary (mint 2.12:1).
            const ExcludeSemantics(
              child: Icon(Icons.check_circle, color: kPrimary, size: 64),
            ),
            const SizedBox(height: kSpace4),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: kFontTitle,
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onContinue();
            },
            child: Text(context.l10n.drvContinue),
          ),
        ],
      ),
    );
  }

  void _openChat(Order order) {
    final currentUserId = context.read<AuthProvider>().currentUser?.id;
    if (currentUserId == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TripChatScreen(
          orderId: order.id,
          currentUserId: currentUserId,
        ),
      ),
    );
  }

  // Emergency services number (Uzbekistan combined police/fire line). The
  // sheet also mentions 103 (ambulance) in its label, but tel: only accepts
  // a single number to dial. Mirrors PassengerHomeScreen._callEmergency.
  static const String _emergencyPhoneNumber = '102';

  Future<void> _callEmergency() => _dial(_emergencyPhoneNumber);

  /// Mijozga ilova orqali qo'ng'iroq — raqam serverdan (§4).
  Future<void> _callClient(Order order) => callViaRelay(context, order.id);

  /// Yagona `tel:` yo'li — `canLaunchUrl` qo'riqchisi va xato xabari bir
  /// joyda (naqsh `passenger/screens/home_screen.dart#_callDriver` dan).
  Future<void> _dial(String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.drvCallFailed)),
      );
    }
  }

  Future<void> _alertDispatchers(String orderId) async {
    // Reuses the position DriverProvider is already streaming from
    // Geolocator (via goOnline's location subscription) instead of
    // requesting a fresh fix, falling back to the last position the map
    // centered on if the stream hasn't produced one yet.
    final lastKnown = context.read<DriverProvider>().lastKnownPosition;
    final lat = lastKnown?.latitude ?? _currentLocation.latitude;
    final lng = lastKnown?.longitude ?? _currentLocation.longitude;
    try {
      await _sosService.reportSos(orderId: orderId, lat: lat, lng: lng);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            // Oq snackbar matni mint fonda 2.12:1 edi — kPrimary 5.38:1.
            content: Text(context.l10n.drvDispatchersNotified),
            backgroundColor: kPrimary,
          ),
        );
      }
    } on SosException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  void _showSosSheet(Order order) {
    showModalBottomSheet<void>(
      context: context,
      // Katta shriftda kontent standart 9/16 balandlikka sig'maydi.
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              kSpace4,
              kSpace5,
              kSpace4,
              kSpace6,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  context.l10n.drvEmergencyHelp,
                  style: const TextStyle(
                    fontSize: kFontH2,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: kSpace1 + 2),
                Text(
                  context.l10n.drvSafetyNote,
                  style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
                ),
                const SizedBox(height: kSpace5),
                AppButton(
                  label: context.l10n.drvEmergencyCall,
                  // kError + oq matn 3.91:1 (AA emas) → kErrorDeep 6.47:1.
                  backgroundColor: kErrorDeep,
                  foregroundColor: kOnPrimary,
                  // Haydovchi asosiy amali — harakatdagi qo'l uchun 64dp.
                  height: kControlHeightDriver,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _callEmergency();
                  },
                ),
                const SizedBox(height: kSpace3),
                AppButton(
                  label: context.l10n.drvNotifyDispatchers,
                  height: kControlHeightDriver,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _alertDispatchers(order.id);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Kam ishlatiladigan amallar menyusi.
  ///
  /// ⚠️ NEGA MENYU BOR. `AgActionRow` da faqat UCHTA nishon bor va ular
  /// TENG vaznda turadi. Kamdan-kam kerak bo'ladigan amal shu qatorda
  /// turса, u eng ko'p bosiladigan amal ("Qo'ng'iroq") bilan yonma-yon
  /// bo'lib qoladi va harakatdagi qo'l bittasini bosmoqchi bo'lib
  /// ikkinchisiga tegadi. Shuning uchun ular bir qadam ichkarida —
  /// asosiy `AgSlideAction` yonida EMAS.
  void _showTripMenu(Order order) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            kSpace4,
            kSpace5,
            kSpace4,
            kSpace6,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                context.l10n.drvMoreActions,
                style: const TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace5),
              _buildMenuAction(
                icon: Icons.sos_rounded,
                label: context.l10n.drvEmergencySos,
                // kErrorDeep oq ustida 6.47:1 — ikonka ham, yozuv ham.
                foreground: kErrorDeep,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _showSosSheet(order);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Menyudagi bitta qator.
  ///
  /// NEGA TO'LIQ KENGLIKDAGI TUGMA EMAS: `AppButton` oilasidagi yozuv
  /// `Expanded` siz, ya'ni tabiiy kengligida chiziladi. Uzun yorliq
  /// ("Favqulodda yordam (SOS)") tizim shrifti kattalashtirilganda qatordan
  /// toshib ketadi. Bu yerda yozuv `Expanded` ichida — u qisqaradi, tugma
  /// esa buzilmaydi.
  ///
  /// Balandlik `kControlHeightDriver` (64): menyu ochilgan payt haydovchi
  /// baribir harakatda bo'lishi mumkin.
  Widget _buildMenuAction({
    required IconData icon,
    required String label,
    required Color foreground,
    required VoidCallback onTap,
  }) {
    return AppPressable(
      onTap: onTap,
      semanticsLabel: label,
      // O'z balandligimiz (64) allaqachon 48dp dan katta.
      minTapTarget: false,
      child: Container(
        constraints: const BoxConstraints(minHeight: kControlHeightDriver),
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace4,
          vertical: kSpace3,
        ),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusMd),
          // Oq qator oq sheet ustida ko'rinmaydi — WCAG 1.4.11 boshqaruvni
          // ANIQLASH uchun 3:1 talab qiladi, `kLineInteractive` 3.67:1.
          border: Border.all(color: kLineInteractive, width: 1.5),
        ),
        child: ExcludeSemantics(
          child: Row(
            children: [
              Icon(icon, color: foreground, size: 22),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w700,
                    color: foreground,
                  ),
                ),
              ),
              // kInkSubtle FAQAT ikonkada — yozuvda hech qachon.
              const Icon(
                Icons.chevron_right_rounded,
                color: kInkSubtle,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // TARTIB
  // -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            _handleReturnedTrip(provider);
            return const Center(child: CircularProgressIndicator());
          }

          // Ovqat/market buyurtmasida bu "safar" emas, YETKAZISH — matnni
          // bitta jadval hal qiladi.
          final wording = order.wording;

          // Sheet balandligi kontentga qarab o'zgaradi (xato yo'qoldi,
          // yuklanish holati kirdi), kamera esa shu balandlikka bog'liq.
          // Ro'yxatga olish `Consumer` ICHIDA: provider xabar berganda
          // tashqi `build` qayta ishlamaydi, faqat shu quruvchi.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _syncReturnState(order);
            _syncCamera();
          });

          return Stack(
            children: [
              RepaintBoundary(child: _buildMap(order)),
              _buildTopBar(order, wording),
              _buildPanel(order, provider, wording),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(Order order) {
    final guidance = _guidance;
    // Markerlar safar davomida o'zgarmaydi — GPS kelganda xarita ularni
    // qayta chizmaydi (`AppVectorMap._sameMarkers`), faqat mashina suriladi.
    final markers = [
      for (final w in order.waypoints)
        AppMapMarker(point: LatLng(w.lat, w.lng), icon: AppMapIcon.waypoint),
      // Taksometrda `dropoff` = olish nuqtasi — manzil belgisi chizilmaydi.
      // Qaytarish yo'lida belgi — olish nuqtasi (restoran/do'kon/yuboruvchi).
      if (order.isReturning)
        AppMapMarker(point: _navTarget(order), icon: AppMapIcon.pickup)
      else if (!order.isMetered)
        AppMapMarker(
          point: LatLng(order.dropoff.lat, order.dropoff.lng),
          icon: AppMapIcon.dropoff,
        ),
    ];
    return ListenableBuilder(
      listenable: Listenable.merge([_location, if (guidance != null) guidance]),
      builder: (context, _) => AppVectorMap(
        initialCenter: _currentLocation,
        initialZoom: 15,
        onMapCreated: _onMapCreated,
        // O'z mashinasi — silliq suriladi va yo'nalish bo'yicha buriladi
        // (statik marker har GPS'da "sakrardi").
        carLocation: _hasFix ? _currentLocation : null,
        markers: markers,
        // Haqiqiy yo'l chizig'i (ilova ichidagi navigatsiya yuklagan).
        route: guidance?.routePoints ?? const [],
        // Kamerani O'ZIMIZ boshqaramiz — yuqoridagi "TO'LDIRILGAN
        // TO'RTBURCHAK" izohiga qarang.
        fitToContent: false,
        // Navigator ko'rinishi — olib ketishga borishdagi ekran bilan bir xil:
        // egilgan kamera va tunda qora xarita (`navigation_screen.dart`).
        tilt: 45,
        style: MapStyleLoader.styleForNow(),
      ),
    );
  }

  Widget _buildTopBar(Order order, DriverServiceWording wording) {
    // ⚠️ 720dp dan keng ekranda `AdaptiveMapPanel` pastdagi sheet emas,
    // CHAPDAGI yon panel bo'ladi va u `Stack` da shu qatordan KEYIN
    // chiziladi — ya'ni holat paneli va SOS ustiga tushadi. Past landshaft
    // ekranda (masalan 800x360) panel yuqoriga ko'tarilib holat panelining
    // pastki chetini yopib qo'yadi. Chap chet panel kengligiga suriladi,
    // naqsh `navigation_screen.dart#_buildTopBar` bilan bir xil.
    // Telefonda `side` false — chet o'sha kSpace4 bo'lib qoladi.
    final side = context.canSplitMapPanel;
    final left = side
        ? context.gutter * 2 + context.sidePanelWidth
        : kSpace4;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(left, kSpace4, kSpace4, kSpace4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: kSpace4,
                  vertical: kSpace3,
                ),
                decoration: BoxDecoration(
                  // Mint TO'LDIRISH — ustidagi matn/ikona kOnMint (7.84:1),
                  // hech qachon oq.
                  color: kMint,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCard,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Row(
                        children: [
                          ExcludeSemantics(
                            child: Icon(
                              wording.icon,
                              color: kOnMint,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: kSpace1 + 2),
                          Flexible(
                            child: Text(
                              wording.activeTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: kFontBody,
                                color: kOnMint,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: kSpace3,
                        vertical: kSpace1,
                      ),
                      decoration: BoxDecoration(
                        color: kOnMint.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(kRadiusXs),
                      ),
                      child: _TripClock(
                        startedAt: _tripStartedAt,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: kFontBody,
                          color: kOnMint,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // 12dp — SOS qaytarib bo'lmaydigan amal, holat panelidan
            // ataylab uzoqroq (o'lcham qoidasi: buzg'unchi amal yonida 12dp).
            const SizedBox(width: kSpace3),
            _buildSosButton(order),
          ],
        ),
            // Navigatsiya ko'rsatmasi — holat qatori OSTIDA, haydovchi nigohi
            // tushadigan joyda (olishga borish ekranidagi bilan bir xil).
            if (_guidance case final guidance?)
              ListenableBuilder(
                listenable: guidance,
                builder: (context, _) {
                  final progress = guidance.progress;
                  final step = progress?.step;
                  if (progress == null || step == null) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: kSpace2),
                    child: ManeuverBanner(
                      step: step,
                      instruction: progress.instruction,
                      distanceMeters: progress.distanceToManeuverMeters,
                    ),
                  );
                },
              ),
            _buildSpeedCameraBanner(),
          ],
        ),
      ),
    );
  }

  /// Small red circular SOS button next to the trip status bar. Opens
  /// [_showSosSheet] with emergency-call and dispatcher-alert options.
  /// Mirrors PassengerHomeScreen._buildSosButton for UI consistency.
  ///
  /// O'lcham `kMinTapTargetDriver` (56): yo'lovchi 48dp nishoni harakatdagi
  /// qo'l uchun kichik, SOS esa birinchi urinishda tushishi shart.
  Widget _buildSosButton(Order order) {
    return Semantics(
      button: true,
      label: context.l10n.drvSosSem,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _showSosSheet(order),
        child: Container(
          width: kMinTapTargetDriver,
          height: kMinTapTargetDriver,
          decoration: BoxDecoration(
            color: kError,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: kError.withValues(alpha: 0.4),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(Icons.sos_rounded, color: kOnPrimary, size: 24),
        ),
      ),
    );
  }

  /// Qatlamli sheet: foni `kSurface2`, ichidagi bloklar oq `AgSurfaceCard`.
  /// Chuqurlik shu ikki yuza FARQIDAN keladi, chegaradan emas — shuning
  /// uchun ikkalasi doim birga ishlatiladi.
  ///
  /// TARTIB 1.5 SONIYALIK QARASHGA qurilgan: yuqorida MANZIL (haydovchi
  /// ekranga qaraganda birinchi navbatda "qayerga" ni qidiradi), keyin
  /// mijoz, keyin pul, eng pastda — bosh barmoq yetadigan joyda — amallar.
  Widget _buildPanel(
    Order order,
    DriverProvider provider,
    DriverServiceWording wording,
  ) {
    final busy = provider.state == DriverProviderState.loading;

    return AdaptiveMapPanel(
      layered: true,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      collapsed: _panelCollapsed,
      onCollapsedChanged: (value) => setState(() => _panelCollapsed = value),
      child: _panelCollapsed
          ? Column(
              key: _panelContentKey,
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [_buildCompleteAction(order, wording, busy)],
            )
          : Column(
              key: _panelContentKey,
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildDestinationCard(order, wording),
                const SizedBox(height: kSpace2),
                _buildClientCard(order, wording),
                const SizedBox(height: kSpace2),
                // Kuryer: eshik oldida qancha naqd olinishi — topshirishdan
                // oldingi eng muhim raqam, daromad kartasidan yuqorida.
                if (order.delivery != null) ...[
                  DeliveryInfoCard(
                    delivery: order.delivery!,
                    stage: DeliveryCardStage.dropoff,
                    orderId: order.id,
                  ),
                  const SizedBox(height: kSpace2),
                ],
                // Posilka: kimga topshiriladi — PIN kodni haydovchi undan so'raydi.
                if (order.parcel != null) ...[
                  ParcelInfoCard(
                    parcel: order.parcel!,
                    stage: DeliveryCardStage.dropoff,
                  ),
                  const SizedBox(height: kSpace2),
                ],
                // Taksometr: oldindan hisoblangan daromad yo'q — o'rnida jonli
                // hisoblagich (yo'lovchi ham aynan shu sonni ko'radi).
                if (order.isMetered)
                  LiveMeterCard(
                    orderId: order.id,
                    service: _meterService,
                    minFare: order.estimatedPrice,
                  )
                else
                  _buildEarningsCard(order),
                // Manzilga yetib keldim / kutish / yetkazib bo'lmadi /
                // qaytarish banneri — posilka, ovqat, market.
                if (order.requiresHandoverCode) ...[
                  const SizedBox(height: kSpace2),
                  DropoffIncidentPanel(
                    order: order,
                    freeWaitMinutes: _dropoffFreeWaitMinutes,
                    busy: busy,
                    onArrived: _onDropoffArrived,
                    onFailed: _onDeliveryFailed,
                  ),
                ],
                const SizedBox(height: kSpace4),
                _buildActionRow(order, wording),
                // 12dp — ikkilamchi qator bilan QAYTARIB BO'LMAYDIGAN amal
                // orasidagi bo'shliq (o'lcham qoidasi).
                const SizedBox(height: kSpace3),
                _buildCompleteAction(order, wording, busy),
              ],
            ),
    );
  }

  Widget _buildCompleteAction(
    Order order,
    DriverServiceWording wording,
    bool busy,
  ) {
    // Qaytarish yo'lida yakunlash YO'Q — uni sotuvchi/yuboruvchi tasdiqlaydi.
    // Yig'ilgan panelda ham kuryer nima qilishini ko'rsin.
    if (order.isReturning) {
      return _panelCollapsed ? ReturnTripBanner(order: order) : const SizedBox.shrink();
    }
    if (busy) {
      // Surish bajarildi, so'rov yo'lda. Balandlik AYNAN o'sha (64) —
      // panel sakramaydi, ya'ni kamera ham qayta hisoblanmaydi.
      return AppButton(
        label: wording.completeActionLabel,
        onPressed: null,
        isLoading: true,
        height: kControlHeightDriver,
      );
    }
    return AgSlideAction(
      label: wording.completeActionLabel,
      onCompleted: () => _onCompleteTrip(order, wording),
    );
  }

  /// Qo'ng'iroq / xabar / menyu — teng vaznli ikkilamchi amallar.
  ///
  /// ⚠️ BEKOR QILISH BU YERDA YO'Q va bo'lmasligi ham kerak: qaytarib
  /// bo'lmaydigan amal eng ko'p bosiladigan nishon yonida turmaydi.
  /// Bu ekranda umuman bekor qilish yo'q; kelajakda kerak bo'lsa, u
  /// `_showTripMenu` ichiga tushadi.
  Widget _buildActionRow(Order order, DriverServiceWording wording) {
    return AgActionRow(
      // 60dp — `kMinTapTargetDriver` (56) dan yuqori.
      driver: true,
      items: [
        AgActionItem(
          icon: Icons.call_rounded,
          label: context.l10n.drvCall,
          // Raqam kelmagan buyurtmada tugma o'z o'rnida qoladi, lekin
          // bosilmaydi — yo'qolib qolsa qolgan nishonlar siljib ketardi va
          // haydovchi mushak xotirasiga tayanib boshqasini bosardi.
          onTap: order.callRelayOpen ? () => _callClient(order) : null,
        ),
        AgActionItem(
          icon: Icons.chat_bubble_outline_rounded,
          label: context.l10n.drvMessage,
          onTap: () => _openChat(order),
        ),
        AgActionItem(
          icon: Icons.more_horiz_rounded,
          label: context.l10n.drvMenu,
          onTap: () => _showTripMenu(order),
        ),
      ],
    );
  }

  Widget _buildDestinationCard(Order order, DriverServiceWording wording) {
    return AgSurfaceCard(
      child: Row(
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.location_on, color: kError, size: 24),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.isReturning
                      ? context.l10n.drvReturnDestination
                      : wording.dropoffTitle,
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                  ),
                ),
                Text(
                  order.isReturning ? order.pickup.address : order.dropoffLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    // Manzil — bu ekrandagi eng ko'p o'qiladigan matn;
                    // kFontBody (14) harakatda kichik.
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
    );
  }

  Widget _buildClientCard(Order order, DriverServiceWording wording) {
    // Ismi kelmagan bo'lsa turga mos umumiy nom: taksida "Yo'lovchi",
    // yetkazishda "Mijoz".
    final clientName = order.passengerName?.isNotEmpty == true
        ? order.passengerName!
        : wording.clientLabel;
    return AgSurfaceCard(
      child: Row(
        children: [
          const ExcludeSemantics(
            child: CircleAvatar(
              radius: 20,
              backgroundColor: kSurface2,
              child: Icon(Icons.person_rounded, color: kInkMuted),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  wording.clientLabel,
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                  ),
                ),
                Text(
                  clientName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontBody,
                    color: kInk,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Daromad — haydovchining ASOSIY raqami.
  ///
  /// ⚠️ NEGA SIYOH FON, oq karta emas. Eski izoh "oq fonda mint 2.12:1 edi
  /// → kPrimary 5.38:1" deb yozilgan va o'sha qaror KONTRAST uchun qilingan.
  /// Sabab o'zgarmaydi, faqat kuchayadi: haydovchi bu raqamni QUYOSH
  /// AKSIDA, bir ko'z tashlashda o'qishi kerak, 5.38:1 esa buning uchun
  /// past. Siyoh gradient ustida `kMintSoft` 11.22:1 beradi — bu ilovada
  /// daromad raqami uchun allaqachon tanlangan yuza
  /// (`driver/screens/home_screen.dart` dagi kunlik daromad hero'si).
  Widget _buildEarningsCard(Order order) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        gradient: kGradientInk,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              context.l10n.drvEstimatedEarnings,
              style: const TextStyle(
                // Siyoh ustida kMintSoft 11.22:1.
                color: kMintSoft,
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            Formatters.formatPrice(order.estimatedPrice),
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: kFontH2,
              // Oq siyoh ustida 17.5:1 — ekrandagi eng kuchli kontrast,
              // ataylab eng muhim raqamga berilgan.
              color: kOnPrimary,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Kameraga qo'llangan moslash — chegara va chetlar birgalikda.
///
/// `tariff_select_screen.dart` dagi bir xil nomli yordamchining nusxasi:
/// ikkalasi ham xususiy (`_`) va o'z ekranining ichki hisobi. Umumiy
/// haqiqat manbai — `map_camera_insets.dart`, bu esa faqat "qayta
/// animatsiya qilishga arziydimi" qo'riqchisi.
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

/// Safar davomiyligini "MM:SS" ko'rinishida chizadi. Taymer faqat shu
/// kichik vidjetni qayta quradi; vaqt har safar [startedAt] dan hisoblanadi,
/// shuning uchun vidjet qayta yaratilsa ham sanoq nolga qaytmaydi.
class _TripClock extends StatefulWidget {
  const _TripClock({required this.startedAt, required this.style});

  final DateTime startedAt;
  final TextStyle style;

  @override
  State<_TripClock> createState() => _TripClockState();
}

class _TripClockState extends State<_TripClock> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = DateTime.now().difference(widget.startedAt).inSeconds;
    final mins = elapsed ~/ 60;
    final secs = elapsed % 60;
    return Text(
      '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}',
      style: widget.style,
    );
  }
}
