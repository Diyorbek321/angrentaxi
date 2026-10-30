import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/config/map_style.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/location/marker_animation.dart';
import 'package:angren_taxi/core/observability/crash_reporting.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:geolocator/geolocator.dart' show Position;
import 'package:latlong2/latlong.dart';
import 'package:maplibre_gl/maplibre_gl.dart' as ml;

/// Xaritada ko'rsatiladigan marker turlari. Har biriga `assets/map/` dagi
/// tayyor ikona mos keladi — MapLibre markerlarni GPU'da chizadi, shuning
/// uchun ular Flutter vidjeti emas, rasm bo'lishi kerak.
enum AppMapIcon { me, pickup, dropoff, waypoint, car }

class AppMapMarker {
  const AppMapMarker({required this.point, required this.icon});

  final LatLng point;
  final AppMapIcon icon;
}

/// Xarita ustidagi to'ldirilgan poligon qatlami — talab (surge) zonalari
/// kabi maydonlar uchun.
///
/// Nega marker emas: zona bu nuqta emas, MAYDON. Uni yuzlab markerlar bilan
/// taqlid qilish native tomonni bo'g'adi va shaklni ko'rsatmaydi. GeoJSON
/// manba + bitta `fill` qatlam esa GPU'da bir marta chiziladi.
///
/// [fillColor] va [fillOpacity] MapLibre ifodasi bo'lishi mumkin — masalan
/// `['match', ['get', 'level'], 'high', '#E5484D', '#F59E0B']`. Ranglarni
/// [mapLibreHex] bilan tayyorlang (tema tokenlari `Color`, MapLibre esa CSS
/// hex satrini kutadi).
///
/// ⚠️ Bo'yoq (paint) xossalari qatlam qo'shilganda BIR MARTA o'qiladi —
/// ular doimiy dizayn tokenlari deb hisoblanadi. Yangilanishda faqat
/// [geoJson] almashadi.
class AppMapFillOverlay {
  const AppMapFillOverlay({
    required this.geoJson,
    required this.fillColor,
    required this.fillOpacity,
    this.outlineColor,
  });

  /// `FeatureCollection`. Xarita yangi ma'lumotni AYNI SHU obyekt
  /// almashganidan biladi (`identical`), shuning uchun uni har `build` da
  /// qaytadan qurmang — bir marta qurib saqlang.
  final Map<String, dynamic> geoJson;

  final Object fillColor;
  final Object fillOpacity;

  /// Kontur. Rang yagona signal bo'lmasligi uchun foydali: to'ldirish
  /// och bo'lsa ham, chegara shaklni ko'rsatadi.
  final Object? outlineColor;
}

/// MapLibre ranglarni CSS hex satri sifatida kutadi (ifodalar ichida ham).
String mapLibreHex(Color color) =>
    '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';

/// Ilovaning yagona xaritasi — MapTiler vektor plitkalari, MapLibre orqali,
/// Angren Taxi'ning O'Z uslubida (`assets/map/style_*.json`).
///
/// Nega vektor: ilgari xarita `flutter_map` bilan tayyor PNG plitkalardan
/// chizilardi — Flutter tomonida, protsessorda. Yorliqlar burilmasdi, zumda
/// xiralashardi, uslubni o'zgartirib bo'lmasdi. MapLibre butun renderingni
/// native dvigatelga (GPU) topshiradi: silliq zum, burish, egish va aniq
/// yozuvlar — "Yandex hissi"ning texnik asosi shu.
///
/// Haydovchi markeri [carLocation] orqali beriladi va ichkarida
/// interpolyatsiya qilinadi: vidjet daraxti qayta qurilmaydi, faqat bitta
/// simvol yangilanadi.
class AppVectorMap extends StatefulWidget {
  const AppVectorMap({
    super.key,
    required this.initialCenter,
    this.initialZoom = 15,
    this.markers = const [],
    this.route = const [],
    this.fillOverlay,
    this.carLocation,
    this.onMapCreated,
    this.onCameraIdle,
    this.trackCameraPosition = false,
    this.interactive = true,
    this.fitToContent = false,
    this.showUserLocation = false,
    this.showZoomControls,
    this.tilt = 0,
    this.style = AppMapStyle.light,
  });

  final LatLng initialCenter;
  final double initialZoom;
  final List<AppMapMarker> markers;

  /// Marshrut chizig'i (OSRM geometriyasi). Bo'sh bo'lsa chizilmaydi.
  final List<LatLng> route;

  /// Xarita ustidagi poligon qatlami (talab zonalari). `null` — qatlam yo'q.
  final AppMapFillOverlay? fillOverlay;

  /// Haydovchi mashinasining oxirgi ma'lum joyi. Har yangilanishda marker
  /// sakramay, silliq suriladi va harakat yo'nalishi bo'yicha buriladi.
  final LatLng? carLocation;

  final void Function(ml.MapLibreMapController controller)? onMapCreated;

  /// Foydalanuvchi xaritani surib bo'lgach chaqiriladi (markazdagi nuqta
  /// bilan) — pin-drop ekranlari uchun.
  final void Function(LatLng center)? onCameraIdle;

  final bool trackCameraPosition;
  final bool interactive;

  /// Ochilishda barcha markerlar va marshrut ko'rinadigan qilib masshtablash.
  final bool fitToContent;

  /// Foydalanuvchining joyi (ko'k nuqta), GPS bilan uzluksiz yangilanadi.
  ///
  /// ⚠️ Plaginning o'z nuqtasi (`myLocationEnabled`) ISHLATILMAYDI: u
  /// Android'da "balanced" rejimda ishlaydi, ya'ni ko'pincha minora/Wi-Fi
  /// bo'yicha — nuqta olish pinidan yuzlab metr nariga tushardi. Endi nuqta
  /// ilovaning o'z [LocationService] oqimidan (yuqori aniqlik, sifat
  /// filtri bilan) chiziladi — pin bilan BITTA manba.
  /// Joylashuvga ruxsat berilgandan keyin yoqiladi.
  final bool showUserLocation;

  /// +/− tugmalari. Standart — xarita interaktiv bo'lsa ko'rsatiladi.
  ///
  /// Barmoq bilan chimchilash bir qo'lda (haydovchi rulda, yo'lovchi sumka
  /// ushlagan) noqulay; ikki marta bosish esa ko'pchilikka ma'lum emas.
  final bool? showZoomControls;

  /// Kamera egilishi (gradus). Navigatsiya ekranida 45° — oldinda yotgan
  /// yo'l ko'proq ko'rinadi va uch o'lchamli his beradi.
  final double tilt;

  /// Kunduzgi yoki tungi uslub. Tungi variant faqat navigatsiya ekranida
  /// kerak bo'ladi — u yerda haydovchi xaritaga uzoq qaraydi.
  final AppMapStyle style;

  @override
  State<AppVectorMap> createState() => _AppVectorMapState();
}

/// `style_light.json` dagi `background` qatlami bilan BIR XIL — uslub
/// yuklangunicha va qoplama so'nayotganda rang sakramasin.
const Color _mapBackgroundLight = Color(0xFFE7EBEE);

class _AppVectorMapState extends State<AppVectorMap>
    with SingleTickerProviderStateMixin {
  static const _iconAssets = <AppMapIcon, String>{
    AppMapIcon.me: 'assets/map/marker_me.png',
    AppMapIcon.pickup: 'assets/map/marker_pickup.png',
    AppMapIcon.dropoff: 'assets/map/marker_dropoff.png',
    AppMapIcon.waypoint: 'assets/map/marker_waypoint.png',
    AppMapIcon.car: 'assets/map/marker_car.png',
  };

  /// Marker platformaga har 40 ms dan tez-tez yuborilmaydi (~25 kadr/s).
  /// Ko'z uchun silliq, kanal uchun arzon — 60 kadr/s da har bir kadr uchun
  /// platforma chaqiruvi ortiqcha yuk bo'lardi.
  static const _pushInterval = Duration(milliseconds: 40);

  ml.MapLibreMapController? _controller;
  bool _styleReady = false;

  /// Uslub birinchi marta yuklandimi. Ungacha xarita platform view'i
  /// ustida ilova fonidagi qoplama turadi: Android'da GL yuzasi birinchi
  /// kadrni chizgunicha QORA bo'ladi va taksi bo'limiga o'tishda ekran
  /// qorayib ochilgandek ko'rinardi.
  bool _mapVisible = false;

  /// Xarita birinchi marta to'liq chizildimi (`onMapIdle` — barcha
  /// ko'rinadigan tile'lar yuklandi).
  bool _tilesLoaded = false;

  /// [_loadTimeout] ichida chizilmadi — "Qayta urinish" ko'rsatiladi.
  /// Ilgari sekin tarmoqda foydalanuvchi cheksiz kulrang fonga qarab turardi.
  bool _loadFailed = false;
  Timer? _loadTimer;
  static const Duration _loadTimeout = Duration(seconds: 12);

  /// Qayta urinishda xarita platform view'i NOLDAN quriladi (yangi kalit).
  int _mapGeneration = 0;

  /// Uslub hujjati assetdan o'qilgunicha xarita qurilmaydi — aks holda
  /// MapLibre'ga bo'sh `styleString` beriladi.
  String? _styleDocument;

  /// Marshrut qatlamlari uslubga bir marta qo'shiladi; keyingi
  /// yangilanishlarda faqat manba ma'lumoti almashadi.
  static const String _routeSourceId = 'angren-route';

  /// Poligon qatlami uchun manba. Marshrutdan OLDIN qo'shiladi, shunda
  /// marshrut va markerlar zonalar USTIDA qoladi (ikkalasi ham
  /// `label-road` dan pastga qo'yiladi va keyingi qo'shilgan yuqorida
  /// turadi).
  static const String _fillSourceId = 'angren-fill-overlay';
  static const String _fillLayerId = 'angren-fill-overlay-layer';

  static const Map<String, dynamic> _emptyCollection = {
    'type': 'FeatureCollection',
    'features': <dynamic>[],
  };

  /// Uslubdagi BIRINCHI yozuv qatlami (`style_light.json` /
  /// `style_dark.json`). Marshrut shundan pastga qo'yiladi, shunda u
  /// yo'llarni bosadi, lekin yozuvlarni bosmaydi.
  static const String _firstLabelLayerId = 'label-road';

  final List<ml.Symbol> _markerSymbols = [];
  ml.Symbol? _carSymbol;

  /// Mashina simvoli qo'shilayotgan payt. `_onStyleLoaded` va
  /// `didUpdateWidget` ikkalasi ham `_carSymbol == null` ni ko'rib, ikkita
  /// simvol qo'shardi — ikkinchisi xaritada qotib qolgan "arvoh" mashina
  /// bo'lib qolardi. Endi ikkinchi chaqiruv shu so'rovni kutadi.
  Future<ml.Symbol>? _carSymbolPending;

  /// Foydalanuvchi nuqtasi — [AppVectorMap.showUserLocation] dagi izohga
  /// qarang. Mashina simvolidagi poyga himoyasi bu yerda ham.
  StreamSubscription<Position>? _userSubscription;
  LatLng? _userPoint;
  ml.Symbol? _userSymbol;
  Future<ml.Symbol>? _userSymbolPending;

  /// Ko'k nuqta uchun masofa filtri — piyoda yurganda ham ergashsin.
  static const int _userDistanceFilter = 5;
  bool _routeLayersAdded = false;
  bool _fillLayerAdded = false;

  Ticker? _ticker;
  MarkerAnimation? _carAnimation;
  Duration _lastTick = Duration.zero;
  Duration _sinceLastPush = Duration.zero;

  @override
  void initState() {
    super.initState();
    if (widget.carLocation != null) {
      _carAnimation = MarkerAnimation(
        start: widget.carLocation!,
        clock: DateTime.now,
      );
    }
    _syncUserTracking();
  }

  /// Uslub ilova tiliga bog'liq (yorliqlar yozuvi) — til
  /// `Localizations` dan olinadi, u `initState` da hali o'qilmaydi.
  String? _languageCode;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Localizations'siz (widget testlari) — o'zbekcha.
    final languageCode = Localizations.maybeLocaleOf(context)?.languageCode ?? 'uz';
    if (languageCode == _languageCode) return;
    final first = _languageCode == null;
    _languageCode = languageCode;
    // Til ilova ishlab turganda almashsa — uslub almashgandagidek.
    if (!first) _resetAnnotations();
    _loadStyle();
  }

  Future<void> _loadStyle() async {
    final document = await MapStyleLoader.load(
      widget.style,
      languageCode: _languageCode ?? 'uz',
    );
    if (!mounted) return;
    setState(() => _styleDocument = document);
  }

  @override
  void dispose() {
    _loadTimer?.cancel();
    _userSubscription?.cancel();
    _ticker?.dispose();
    super.dispose();
  }

  Future<void> _onMapCreated(ml.MapLibreMapController controller) async {
    _controller = controller;
    controller.addListener(_onCameraChanged);
    widget.onMapCreated?.call(controller);
    // Zaxira: uslub yuklanmasa ham (tarmoq, plagin xatosi) qoplama abadiy
    // turib qolmasin.
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (mounted && !_mapVisible) setState(() => _mapVisible = true);
    });
    _loadTimer?.cancel();
    _loadTimer = Timer(_loadTimeout, () {
      if (mounted && !_tilesLoaded) setState(() => _loadFailed = true);
    });
  }

  void _onMapIdle() {
    _loadTimer?.cancel();
    if (_tilesLoaded && !_loadFailed) return;
    _tilesLoaded = true;
    if (_loadFailed && mounted) setState(() => _loadFailed = false);
  }

  /// Xaritani yangi platform view bilan qayta quradi. Eski annotatsiya
  /// havolalari yangi xaritada yo'q — ular uslub almashgandagidek tozalanadi.
  void _retryLoad() {
    _resetAnnotations();
    _controller = null;
    setState(() {
      _mapGeneration++;
      _loadFailed = false;
      _tilesLoaded = false;
      _mapVisible = false;
    });
  }

  void _resetAnnotations() {
    _styleReady = false;
    _markerSymbols.clear();
    _carSymbol = null;
    _carSymbolPending = null;
    _userSymbol = null;
    _userSymbolPending = null;
    _routeLayersAdded = false;
    _fillLayerAdded = false;
  }

  /// Simvollar faqat uslub yuklangandan keyin qo'shilishi mumkin — plagin
  /// hujjatlaridagi shart. Ikonalar ham shu yerda ro'yxatdan o'tkaziladi.
  Future<void> _onStyleLoaded() async {
    if (!_mapVisible && mounted) setState(() => _mapVisible = true);
    final controller = _controller;
    if (controller == null) return;

    for (final entry in _iconAssets.entries) {
      // Bitta ikona yiqilsa qolganlari, marshrut va markerlar baribir
      // chizilsin — ilgari birinchi xato butun xaritani bo'sh qoldirardi.
      try {
        final bytes = await rootBundle.load(entry.value);
        await controller.addImage(
          entry.key.name,
          // Offset/uzunlik bilan kesamiz: `buffer.asUint8List()` o'zi butun
          // bufferni oladi va asset bufer boshidan boshlanmasa, ikona
          // buzilgan baytlar bilan ro'yxatdan o'tadi.
          bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
        );
      } catch (e, st) {
        CrashReporting.reportHandled(e, st, 'AppVectorMap.addImage ${entry.key.name}');
      }
    }

    if (!mounted) return;
    _styleReady = true;

    await _syncFillOverlay();
    await _syncRoute();
    await _syncMarkers();
    await _syncUser();
    await _syncCar();

    if (widget.fitToContent) await _fitToContent();
  }

  @override
  void didUpdateWidget(AppVectorMap oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Uslub almashganda (kunduzgi ↔ tungi) MapLibre butun uslubni qaytadan
    // yuklaydi va u bilan birga BARCHA qo'shilgan ikona va annotatsiyalarni
    // tashlab yuboradi. Eski `Symbol`/`Line` havolalari endi mavjud bo'lmagan
    // obyektlarga ishora qiladi — ularni tozalamasak, keyingi `remove...`
    // chaqiruvi platformada xato beradi. `_onStyleLoaded` hammasini
    // noldan qayta qo'shadi.
    if (widget.style != oldWidget.style) {
      _resetAnnotations();
      _loadStyle();
      return;
    }

    if (widget.showUserLocation != oldWidget.showUserLocation) {
      _syncUserTracking();
    }

    if (!_styleReady) return;

    // Ma'lumot almashganini obyekt identifikatoridan bilamiz: zonalar
    // ro'yxati o'nlab poligondan iborat, uni har `build` da chuqur
    // solishtirish yangilashning o'zidan qimmatroq.
    if (!identical(oldWidget.fillOverlay?.geoJson, widget.fillOverlay?.geoJson)) {
      _syncFillOverlay();
    }
    if (!_sameMarkers(oldWidget.markers, widget.markers)) {
      _syncMarkers();
    }
    if (!_samePoints(oldWidget.route, widget.route)) {
      _syncRoute().then((_) {
        if (widget.fitToContent) _fitToContent();
      });
    }
    if (widget.carLocation != oldWidget.carLocation) {
      _syncCar();
    }
  }

  static bool _sameMarkers(List<AppMapMarker> a, List<AppMapMarker> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].icon != b[i].icon || !_samePoint(a[i].point, b[i].point)) {
        return false;
      }
    }
    return true;
  }

  static bool _samePoints(List<LatLng> a, List<LatLng> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!_samePoint(a[i], b[i])) return false;
    }
    return true;
  }

  static bool _samePoint(LatLng a, LatLng b) =>
      a.latitude == b.latitude && a.longitude == b.longitude;

  /// Ilova bo'ylab `latlong2.LatLng` ishlatiladi (provayderlar, OSRM, modellar).
  /// MapLibre'ning o'z turi shu vidjetdan tashqariga chiqmaydi.
  static ml.LatLng _ml(LatLng p) => ml.LatLng(p.latitude, p.longitude);

  bool _markerSyncRunning = false;
  bool _markerSyncPending = false;

  /// Markerlarni ketma-ket yangilaydi. Ikki sinxronlash ustma-ust tushsa
  /// (birinchisi hali `addSymbol` kutayotganda yangi markerlar keldi),
  /// eski simvollar yetim qolib xaritada "arvoh" ikonalar paydo bo'lardi.
  Future<void> _syncMarkers() async {
    if (_markerSyncRunning) {
      _markerSyncPending = true;
      return;
    }
    _markerSyncRunning = true;
    try {
      do {
        _markerSyncPending = false;
        await _syncMarkersOnce();
      } while (_markerSyncPending && mounted);
    } finally {
      _markerSyncRunning = false;
    }
  }

  Future<void> _syncMarkersOnce() async {
    final controller = _controller;
    if (controller == null) return;

    if (_markerSymbols.isNotEmpty) {
      await controller.removeSymbols(List.of(_markerSymbols));
      _markerSymbols.clear();
    }

    for (final marker in widget.markers) {
      final symbol = await controller.addSymbol(
        ml.SymbolOptions(
          geometry: _ml(marker.point),
          iconImage: marker.icon.name,
          iconSize: _iconSize,
          // Manzil pini uchi bilan nuqtani ko'rsatadi; qolgan ikonalar
          // markazi bo'yicha joylashadi.
          iconAnchor: marker.icon == AppMapIcon.dropoff ? 'bottom' : 'center',
        ),
      );
      _markerSymbols.add(symbol);
    }
  }

  static String _hex(Color color) => mapLibreHex(color);

  /// Poligon qatlamini uslubga qo'shadi yoki ma'lumotini yangilaydi.
  ///
  /// Qatlam bir marta quriladi va hech qachon o'chirilmaydi: overlay olib
  /// tashlansa, manbaga bo'sh `FeatureCollection` yoziladi. Sabab — qatlamni
  /// o'chirib qayta qo'shish uslubdagi tartibni (marshrut/yozuvlar bilan kim
  /// kimning ustida turishini) buzadi va MapLibre'da ancha qimmat.
  Future<void> _syncFillOverlay() async {
    final controller = _controller;
    if (controller == null) return;

    final overlay = widget.fillOverlay;
    final data = overlay?.geoJson ?? _emptyCollection;

    if (_fillLayerAdded) {
      await controller.setGeoJsonSource(_fillSourceId, data);
      return;
    }

    // Overlay hali berilmagan bo'lsa, bo'sh qatlam qurmaymiz — xaritada
    // hech qachon zona ko'rsatmaydigan ekranlar (safar, navigatsiya)
    // ortiqcha manba/qatlam olmasin.
    if (overlay == null) return;

    await controller.addGeoJsonSource(_fillSourceId, data);
    await controller.addFillLayer(
      _fillSourceId,
      _fillLayerId,
      ml.FillLayerProperties(
        fillColor: overlay.fillColor,
        fillOpacity: overlay.fillOpacity,
        fillOutlineColor: overlay.outlineColor,
      ),
      belowLayerId: _firstLabelLayerId,
      enableInteraction: false,
    );

    _fillLayerAdded = true;
  }

  Map<String, dynamic> _routeGeoJson() => {
        'type': 'FeatureCollection',
        'features': widget.route.length < 2
            ? const []
            : [
                {
                  'type': 'Feature',
                  'properties': const <String, dynamic>{},
                  'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                      for (final p in widget.route) [p.longitude, p.latitude],
                    ],
                  },
                },
              ],
      };

  /// Marshrut — annotatsiya emas, uslubning haqiqiy qatlami.
  ///
  /// Nega shunday: `addLine` annotatsiyalari uslubning ENG TEPASIGA
  /// qo'yiladi va shahar/ko'cha yozuvlarini yopib qo'yadi — safar davomida
  /// yo'lovchi ham, haydovchi ham marshrut ostidagi ko'cha nomini o'qiy
  /// olmaydi. Qatlam sifatida qo'yilganda uni `label-road` dan PASTGA
  /// joylashtira olamiz: marshrut yo'llar ustida, lekin yozuvlar ostida.
  ///
  /// Qo'shimcha yutuq: yangilanishda qatlamlar qayta qurilmaydi, faqat
  /// manba ma'lumoti almashadi (`setGeoJsonSource`) — bir chaqiruv.
  Future<void> _syncRoute() async {
    final controller = _controller;
    if (controller == null) return;

    if (_routeLayersAdded) {
      await controller.setGeoJsonSource(_routeSourceId, _routeGeoJson());
      return;
    }

    await controller.addGeoJsonSource(_routeSourceId, _routeGeoJson());

    // Marshrut IKKI chiziqdan iborat: ostida to'q yashil "kant", ustida
    // mint o'zak. Yagona mint chiziq och yuzalarda (oq yo'l, mint park)
    // yo'qolib ketardi — kant unga har qanday fonda aniq chegara beradi va
    // chiziqni xarita ustida "yotgan lenta" kabi ko'rsatadi.
    //
    // Ikkalasi ham `label-road` dan pastga qo'yiladi. Ikkinchi qo'shilgan
    // qatlam aynan `label-road` dan oldin turadi — ya'ni kantning USTIDA.
    await controller.addLineLayer(
      _routeSourceId,
      'angren-route-casing',
      ml.LineLayerProperties(
        lineColor: _hex(kPrimary),
        // Qalinlik zumga bog'liq: uzoqdan ingichka, yaqindan qalin —
        // qat'iy piksel qiymati z12 da bo'g'iq, z18 da ipdek ko'rinardi.
        lineWidth: [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          4.0,
          14,
          9.0,
          18,
          16.0,
        ],
        lineCap: 'round',
        lineJoin: 'round',
      ),
      belowLayerId: _firstLabelLayerId,
      enableInteraction: false,
    );

    await controller.addLineLayer(
      _routeSourceId,
      'angren-route-fill',
      ml.LineLayerProperties(
        lineColor: _hex(kMint),
        lineWidth: [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          2.5,
          14,
          5.5,
          18,
          11.0,
        ],
        lineCap: 'round',
        lineJoin: 'round',
      ),
      belowLayerId: _firstLabelLayerId,
      enableInteraction: false,
    );

    _routeLayersAdded = true;
  }

  /// Ikona o'lchami. Ikonalar 3x zichlikda chizilgan (1 dp = 3 px,
  /// `tool/generate_map_markers.py`). Android plagini rasmni EKRAN
  /// zichligida qabul qiladi, shuning uchun ko'rinadigan dp = px × o'lcham
  /// ÷ zichlik — o'lcham zichlik/3 bo'lsa, har telefonda bir xil dp.
  /// iOS rasmni 1x deb oladi.
  double get _iconSize => defaultTargetPlatform == TargetPlatform.iOS
      ? 1 / 3
      : MediaQuery.devicePixelRatioOf(context) / 3;

  /// GPS oqimiga [AppVectorMap.showUserLocation] bo'yicha ulanadi/uziladi.
  void _syncUserTracking() {
    if (widget.showUserLocation) {
      // Testlarda va demo rejimida xizmat ro'yxatdan o'tmagan bo'lishi
      // mumkin — unda nuqta shunchaki chizilmaydi.
      if (_userSubscription != null || !sl.isRegistered<LocationService>()) {
        return;
      }
      _userSubscription = sl<LocationService>()
          .getPositionStream(distanceFilter: _userDistanceFilter)
          .listen(
        (position) {
          _userPoint = LatLng(position.latitude, position.longitude);
          _syncUser();
        },
        // Oqim uzilishi (ruxsat olib qo'yildi) xaritani yiqitmasin.
        onError: (Object _) {},
      );
    } else {
      _userSubscription?.cancel();
      _userSubscription = null;
      _userPoint = null;
      _syncUser();
    }
  }

  Future<void> _syncUser() async {
    final controller = _controller;
    if (controller == null || !_styleReady) return;
    final point = _userPoint;

    if (point == null) {
      final symbol = _userSymbol;
      _userSymbol = null;
      if (symbol != null) await controller.removeSymbol(symbol);
      return;
    }

    final existing = _userSymbol;
    if (existing != null) {
      await controller.updateSymbol(
        existing,
        ml.SymbolOptions(geometry: _ml(point)),
      );
      return;
    }

    final pending = _userSymbolPending ??= controller.addSymbol(
      ml.SymbolOptions(
        geometry: _ml(point),
        iconImage: AppMapIcon.me.name,
        iconSize: _iconSize,
      ),
    );
    final symbol = await pending;
    if (!identical(_userSymbolPending, pending)) return;
    _userSymbolPending = null;
    _userSymbol = symbol;
    if (!mounted) return;
    // Kutish paytida nuqta o'chirilgan yoki surilgan bo'lishi mumkin.
    await _syncUser();
  }

  Future<void> _syncCar() async {
    final controller = _controller;
    final target = widget.carLocation;
    if (controller == null) return;

    if (target == null) {
      if (_carSymbol != null) {
        await controller.removeSymbol(_carSymbol!);
        _carSymbol = null;
      }
      _stopTicker();
      return;
    }

    final animation = _carAnimation ??=
        MarkerAnimation(start: target, clock: DateTime.now);
    animation.retarget(target);

    if (_carSymbol == null) {
      final pending = _carSymbolPending ??= controller.addSymbol(
        ml.SymbolOptions(
          geometry: _ml(animation.value),
          iconImage: AppMapIcon.car.name,
          iconSize: _iconSize,
          iconRotate: _carIconRotate(animation),
        ),
      );
      final symbol = await pending;
      // Kutish paytida uslub almashgan (simvol endi yo'q) yoki boshqa
      // chaqiruv allaqachon o'rnatgan — bu yerda ish qolmadi.
      if (!identical(_carSymbolPending, pending)) return;
      _carSymbolPending = null;
      _carSymbol = symbol;
      if (!mounted) return;
      // Kutish paytida mashina olib tashlangan — endi simvolni ham olamiz.
      if (widget.carLocation == null) {
        await _syncCar();
        return;
      }
    }

    _startTicker();
  }

  void _startTicker() {
    if (_ticker != null) return;
    _lastTick = Duration.zero;
    _sinceLastPush = Duration.zero;
    _ticker = createTicker(_onTick)..start();
  }

  void _stopTicker() {
    _pauseTicker();
    _carAnimation = null;
  }

  /// Mashina joyiga yetdi — keyingi fiksgacha kadr so'ralmaydi. Ilgari
  /// ticker butun safar davomida sekundiga 60 marta "bo'sh" ishlardi.
  void _pauseTicker() {
    _ticker?.dispose();
    _ticker = null;
  }

  void _onTick(Duration now) {
    final animation = _carAnimation;
    final controller = _controller;
    final symbol = _carSymbol;
    if (animation == null || controller == null || symbol == null) return;

    final delta = _lastTick == Duration.zero ? Duration.zero : now - _lastTick;
    _lastTick = now;

    if (!animation.advance(delta)) {
      _pauseTicker();
      return;
    }

    // Oxirgi kadr har doim yuboriladi — aks holda throttle tufayli mashina
    // manzildan bir oz oldin to'xtab qolishi mumkin edi.
    _sinceLastPush += delta;
    if (_sinceLastPush < _pushInterval && animation.isAnimating) return;
    _sinceLastPush = Duration.zero;

    controller.updateSymbol(
      symbol,
      ml.SymbolOptions(
        geometry: _ml(animation.value),
        iconRotate: _carIconRotate(animation),
      ),
    );
  }

  /// Kamera burchagi (shimoldan, gradus). Kuzatish o'chiq bo'lsa `0`.
  double get _cameraBearing => _controller?.cameraPosition?.bearing ?? 0;

  /// Mashina ikonasining EKRANDAGI burilishi.
  ///
  /// Plagin annotatsiya qatlamiga `icon-rotation-alignment: map` qo'yishga
  /// ruxsat bermaydi — ikona ekranga nisbatan aylanadi. Xarita burilganda
  /// (navigatsiyada kamera yo'nalish bo'yicha turadi, foydalanuvchi ham
  /// buradi) strelka yo'lga qaramay qolardi; shuning uchun kamera burchagi
  /// ayiriladi.
  double _carIconRotate(MarkerAnimation animation) =>
      (animation.displayBearing ?? 0) - _cameraBearing;

  /// Faqat kamera burilganda (mashina turgan bo'lsa ham) strelkani
  /// to'g'rilaydi; harakatda buni ticker o'zi qiladi.
  double? _lastCameraBearing;
  void _onCameraChanged() {
    final bearing = _cameraBearing;
    final last = _lastCameraBearing;
    if (last != null && (bearing - last).abs() < 1) return;
    _lastCameraBearing = bearing;
    final animation = _carAnimation;
    final symbol = _carSymbol;
    final controller = _controller;
    if (animation == null || symbol == null || controller == null) return;
    if (_ticker?.isActive ?? false) return;
    controller.updateSymbol(
      symbol,
      ml.SymbolOptions(iconRotate: _carIconRotate(animation)),
    );
  }

  Future<void> _fitToContent() async {
    final controller = _controller;
    if (controller == null) return;

    final points = <LatLng>[
      ...widget.route,
      ...widget.markers.map((m) => m.point),
    ];
    if (points.length < 2) return;

    double minLat = points.first.latitude, maxLat = minLat;
    double minLng = points.first.longitude, maxLng = minLng;
    for (final p in points) {
      minLat = p.latitude < minLat ? p.latitude : minLat;
      maxLat = p.latitude > maxLat ? p.latitude : maxLat;
      minLng = p.longitude < minLng ? p.longitude : minLng;
      maxLng = p.longitude > maxLng ? p.longitude : maxLng;
    }

    await controller.animateCamera(
      ml.CameraUpdate.newLatLngBounds(
        ml.LatLngBounds(
          southwest: ml.LatLng(minLat, minLng),
          northeast: ml.LatLng(maxLat, maxLng),
        ),
        left: 48,
        right: 48,
        top: 96,
        bottom: 260,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final styleDocument = _styleDocument;

    // Uslub assetdan o'qilgunicha (bir kadr, keshdan keyin esa darhol)
    // xaritaning o'z fon rangini ko'rsatamiz — oq "chaqnash" bo'lmasligi
    // uchun. Rang uslubdagi `background` qatlami bilan bir xil.
    final background =
        widget.style == AppMapStyle.dark ? kBackgroundDark : _mapBackgroundLight;
    if (styleDocument == null) {
      return ColoredBox(color: background, child: const SizedBox.expand());
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        _buildMap(styleDocument),
        IgnorePointer(
          child: AnimatedOpacity(
            opacity: _mapVisible ? 0 : 1,
            duration: kDurationBase,
            child: ColoredBox(color: background),
          ),
        ),
        if (widget.showZoomControls ?? widget.interactive)
          // O'ng chekka, o'rtadan biroz yuqori: pastda sheet, tepada ekran
          // tugmalari (menyu, orqaga) turadi — bu joy hamma ekranda bo'sh.
          Align(
            alignment: const Alignment(1, -0.25),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(right: 12),
                child: _ZoomControls(onZoom: _zoomBy),
              ),
            ),
          ),
        if (_loadFailed) Center(child: _MapLoadFailed(onRetry: _retryLoad)),
      ],
    );
  }

  void _zoomBy(double delta) {
    _controller?.animateCamera(ml.CameraUpdate.zoomBy(delta));
  }

  Widget _buildMap(String styleDocument) {
    return ml.MapLibreMap(
      key: ValueKey(_mapGeneration),
      styleString: styleDocument,
      onMapIdle: _onMapIdle,
      initialCameraPosition: ml.CameraPosition(
        target: _ml(widget.initialCenter),
        zoom: widget.initialZoom,
        tilt: widget.tilt,
      ),
      onMapCreated: _onMapCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      // Mashina bo'lsa kamera burchagi kerak — `_carIconRotate`.
      trackCameraPosition: widget.trackCameraPosition ||
          widget.onCameraIdle != null ||
          widget.carLocation != null,
      onCameraIdle: widget.onCameraIdle == null
          ? null
          : () {
              final position = _controller?.cameraPosition;
              if (position != null) {
                widget.onCameraIdle!(
                  LatLng(position.target.latitude, position.target.longitude),
                );
              }
            },
      // MapTiler litsenziyasi atributni talab qiladi — plagin uni o'zi
      // chizadi, faqat joyini belgilaymiz.
      attributionButtonPosition: ml.AttributionButtonPosition.bottomRight,
      // Kompas faqat xarita burilganda kerak — u ham xaritani shimolga
      // qaytaradigan yagona yo'l.
      compassEnabled: widget.interactive,
      rotateGesturesEnabled: widget.interactive,
      scrollGesturesEnabled: widget.interactive,
      zoomGesturesEnabled: widget.interactive,
      tiltGesturesEnabled: widget.interactive,
    );
  }
}

/// Test uchun: [Uint8List] ni bevosita ishlatmasak ham, `rootBundle.load`
/// qaytargan turni saqlab qolamiz.
typedef MapIconBytes = Uint8List;

/// Xarita [_AppVectorMapState._loadTimeout] ichida chizilmadi.
class _MapLoadFailed extends StatelessWidget {
  const _MapLoadFailed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 32),
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: Color(0x22000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(child: Text(l10n.shMapLoadFailed)),
          TextButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
        ],
      ),
    );
  }
}

class _ZoomControls extends StatelessWidget {
  const _ZoomControls({required this.onZoom});

  final void Function(double delta) onZoom;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Tegish qutisi 56dp — haydovchi nishoni (tebranayotgan mashinada 48dp
    // ga birinchi urinishda tushmaydi). Ko'rinadigan doira o'zgarmaydi
    // (`driver/screens/home_screen.dart#_driverFab` bilan bir xil usul).
    Widget box(Widget fab) => SizedBox.square(dimension: kMinTapTargetDriver, child: fab);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        box(AgMapFab(
          icon: Icons.add_rounded,
          semanticsLabel: l10n.shMapZoomIn,
          onTap: () => onZoom(1),
        )),
        box(AgMapFab(
          icon: Icons.remove_rounded,
          semanticsLabel: l10n.shMapZoomOut,
          onTap: () => onZoom(-1),
        )),
      ],
    );
  }
}
