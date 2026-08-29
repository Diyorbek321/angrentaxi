import 'dart:typed_data';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/config/map_style.dart';
import 'package:angren_taxi/core/location/marker_animation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/widgets.dart';
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

  /// Native joylashuv nuqtasi (ko'k puck + aniqlik doirasi).
  ///
  /// Qo'lda qo'yilgan markerdan ustunligi: u GPS bilan uzluksiz yangilanadi
  /// va qurilma kompasidan yo'nalishni ham ko'rsatadi — Yandex/Google
  /// xaritalaridagi kabi. Joylashuvga ruxsat berilgandan keyin yoqiladi.
  final bool showUserLocation;

  /// Kamera egilishi (gradus). Navigatsiya ekranida 45° — oldinda yotgan
  /// yo'l ko'proq ko'rinadi va uch o'lchamli his beradi.
  final double tilt;

  /// Kunduzgi yoki tungi uslub. Tungi variant faqat navigatsiya ekranida
  /// kerak bo'ladi — u yerda haydovchi xaritaga uzoq qaraydi.
  final AppMapStyle style;

  @override
  State<AppVectorMap> createState() => _AppVectorMapState();
}

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
      _carAnimation = MarkerAnimation(start: widget.carLocation!);
    }
    _loadStyle();
  }

  Future<void> _loadStyle() async {
    final document = await MapStyleLoader.load(widget.style);
    if (!mounted) return;
    setState(() => _styleDocument = document);
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  Future<void> _onMapCreated(ml.MapLibreMapController controller) async {
    _controller = controller;
    widget.onMapCreated?.call(controller);
  }

  /// Simvollar faqat uslub yuklangandan keyin qo'shilishi mumkin — plagin
  /// hujjatlaridagi shart. Ikonalar ham shu yerda ro'yxatdan o'tkaziladi.
  Future<void> _onStyleLoaded() async {
    final controller = _controller;
    if (controller == null) return;

    for (final entry in _iconAssets.entries) {
      final bytes = await rootBundle.load(entry.value);
      await controller.addImage(
        entry.key.name,
        // Offset/uzunlik bilan kesamiz: `buffer.asUint8List()` o'zi butun
        // bufferni oladi va asset bufer boshidan boshlanmasa, ikona buzilgan
        // baytlar bilan ro'yxatdan o'tadi.
        bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes),
      );
    }

    if (!mounted) return;
    _styleReady = true;

    await _syncFillOverlay();
    await _syncRoute();
    await _syncMarkers();
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
      _styleReady = false;
      _markerSymbols.clear();
      _carSymbol = null;
      _routeLayersAdded = false;
      _fillLayerAdded = false;
      _loadStyle();
      return;
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

  Future<void> _syncMarkers() async {
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
          iconSize: 0.5,
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

    final animation = _carAnimation ??= MarkerAnimation(start: target);
    animation.retarget(target);

    _carSymbol ??= await controller.addSymbol(
      ml.SymbolOptions(
        geometry: _ml(animation.value),
        iconImage: AppMapIcon.car.name,
        iconSize: 0.5,
        iconRotate: animation.bearing ?? 0,
      ),
    );

    _startTicker();
  }

  void _startTicker() {
    if (_ticker != null) return;
    _lastTick = Duration.zero;
    _sinceLastPush = Duration.zero;
    _ticker = createTicker(_onTick)..start();
  }

  void _stopTicker() {
    _ticker?.dispose();
    _ticker = null;
    _carAnimation = null;
  }

  void _onTick(Duration now) {
    final animation = _carAnimation;
    final controller = _controller;
    final symbol = _carSymbol;
    if (animation == null || controller == null || symbol == null) return;

    final delta = _lastTick == Duration.zero ? Duration.zero : now - _lastTick;
    _lastTick = now;

    if (!animation.advance(delta)) return;

    _sinceLastPush += delta;
    if (_sinceLastPush < _pushInterval) return;
    _sinceLastPush = Duration.zero;

    controller.updateSymbol(
      symbol,
      ml.SymbolOptions(
        geometry: _ml(animation.value),
        iconRotate: animation.bearing ?? 0,
      ),
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
    if (styleDocument == null) {
      return ColoredBox(
        color: widget.style == AppMapStyle.dark ? kBackgroundDark : kBackground,
        child: const SizedBox.expand(),
      );
    }

    return ml.MapLibreMap(
      styleString: styleDocument,
      initialCameraPosition: ml.CameraPosition(
        target: _ml(widget.initialCenter),
        zoom: widget.initialZoom,
        tilt: widget.tilt,
      ),
      onMapCreated: _onMapCreated,
      onStyleLoadedCallback: _onStyleLoaded,
      trackCameraPosition:
          widget.trackCameraPosition || widget.onCameraIdle != null,
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
      myLocationEnabled: widget.showUserLocation,
      myLocationRenderMode: widget.showUserLocation
          ? ml.MyLocationRenderMode.compass
          : ml.MyLocationRenderMode.normal,
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
