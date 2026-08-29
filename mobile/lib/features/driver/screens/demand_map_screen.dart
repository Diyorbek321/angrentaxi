import 'dart:io' show Platform;

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/demand_provider.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/shared/models/demand_zone.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show MapLibreMapController, CameraUpdate, LatLng, LatLngBounds;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

// ============================================================================
// TALAB XARITASI — haydovchi qayerda kutishni tanlashi uchun.
//
// Ekranning butun mazmuni bitta savolga javob beradi: "hozir qayerga
// borsam, buyurtma tezroq keladi?". Shuning uchun:
//
//   • `normal` zonalar CHIZILMAYDI. Agar butun shahar bo'yalsa, xarita
//     shovqinga aylanadi va farq ko'rinmaydi — "hech qayerda ajralib
//     turmaydi" ham javob, uni bo'sh xarita aytadi.
//   • Koeffitsiyent (multiplier) KO'RSATILMAYDI. Aniq raqamni ko'rgan
//     haydovchi uning ko'tarilishini kutib bo'sh turadi; bu taklifni
//     kamaytiradi va yo'lovchining kutish vaqtini oshiradi.
//     ⚠️ Bu qaror MODELDA ham qo'riqlanadi: `DemandZone` koeffitsiyentni
//     umuman saqlamaydi (shared/models/demand_zone.dart) — ya'ni uni bu
//     ekranga tasodifan chiqarib yuborish MUMKIN EMAS. Faqat DARAJA
//     (odatiy / yuqori / juda yuqori) ko'rsatiladi.
//   • Har daraja yonida MASOFA turadi. Daraja yolg'iz o'zi qaror uchun
//     yetarli emas: "juda yuqori" 14 km narida bo'lsa, u yerga borish
//     yo'ldagi buyurtmalarni o'tkazib yuborishdan qimmatroq tushadi.
//     Masofa haydovchining joylashuvidan shu darajadagi ENG YAQIN zonaga
//     to'g'ri chiziq bo'yicha o'lchanadi (yo'l masofasi emas — u har zona
//     uchun alohida marshrut so'rashni talab qilardi va 60 soniyalik
//     yangilanishda o'nlab bekorchi so'rov bo'lardi).
//   • Rang YAGONA signal emas (WCAG 1.4.1): pastdagi legendada har
//     daraja ikonka + matn + zonalar soni bilan takrorlanadi, xaritada
//     esa darajalar rang bilan ham, TINIQLIK bilan ham farqlanadi.
//   • ASOSIY AMAL — navigatsiyani ochish. Xarita "qiziqarli ma'lumot"
//     emas, QAROR bo'lishi kerak: ko'rgan joyiga bir tegishda yo'l
//     olinadi, aks holda haydovchi zonani ko'z bilan chamalab, boshqa
//     ilovada qidirishga majbur bo'ladi.
// ============================================================================

/// To'g'ri chiziqli masofa — zonagacha "qanchalik uzoq" degan savolga
/// yetarli aniqlik. Bir marta quriladi (`Distance` obyekti holatsiz).
const Distance _distance = Distance();

class DemandMapScreen extends StatefulWidget {
  const DemandMapScreen({super.key});

  @override
  State<DemandMapScreen> createState() => _DemandMapScreenState();
}

class _DemandMapScreenState extends State<DemandMapScreen>
    with WidgetsBindingObserver {
  /// Provayder shu ekranga tegishli va shu yerda o'ldiriladi — 60 soniyalik
  /// taymer ekran yopilishi bilan to'xtashi uchun (`dispose`).
  late final DemandProvider _provider;

  ml.MapLibreMapController? _mapController;

  /// Sheet kontentining o'lchangan balandligi — kamera chetlari shundan
  /// hisoblanadi (`MapCameraInsets.forPanel`).
  final GlobalKey _panelContentKey = GlobalKey();
  double? _panelContentHeight;

  /// Avtomatik kamera moslashi ENG KO'PI BILAN IKKI MARTA bo'ladi:
  ///   1) birinchi kadrda haydovchi nuqtasiga markazlashish (zonalar hali
  ///      kelmagan bo'ladi — so'rov javobi bir necha kadr keyin tushadi),
  ///   2) zonalar kelganda ularni ham ekranga sig'dirish.
  ///
  /// Uchinchisi YO'Q: har yangilanishda (60 soniyada bir marta!) kamerani
  /// orqaga tortib olish ekranni ishlatib bo'lmas qilardi — haydovchi
  /// surgan joyi o'z joyida qoladi. Keyingi moslash faqat QO'LDA,
  /// o'ngdagi "sig'dirish" tugmasi orqali.
  bool _centeredOnDriver = false;
  bool _fittedToZones = false;

  @override
  void initState() {
    super.initState();
    _provider = buildDemandProvider();
    WidgetsBinding.instance.addObserver(this);
    _provider.start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Taymerni to'xtatadigan yagona joy — `DemandProvider.dispose`.
    _provider.dispose();
    super.dispose();
  }

  /// Ilova fonga o'tganda so'rovlar to'xtaydi: ko'rinmayotgan ekran uchun
  /// har daqiqada tarmoqqa chiqish batareyani va mobil trafikni yeydi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _provider.resumeAutoRefresh();
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _provider.pauseAutoRefresh();
    }
  }

  /// Bir necha zona birdaniga ko'rinadigan masshtab — bu ekranda "qayerga
  /// borish" muhim, "qaysi ko'chada turish" emas.
  static const double _zoom = 12.5;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<DemandProvider>.value(
      value: _provider,
      child: Scaffold(
        body: Consumer<DemandProvider>(
          builder: (context, provider, _) {
            // Sheet balandligi holatga qarab o'zgaradi (skeleton → legenda →
            // bo'sh holat), kamera esa shu balandlikka bog'liq. Ro'yxatga
            // olish `Consumer` ICHIDA: zonalar kelganda tashqi `build`
            // qayta ishlamaydi — faqat shu quruvchi.
            WidgetsBinding.instance.addPostFrameCallback((_) => _syncCamera());

            return Stack(
              children: [
                _buildMap(provider),
                _buildTopBar(provider),
                _buildBottomPanel(provider),
              ],
            );
          },
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // XARITA + KAMERA (to'ldirilgan to'rtburchak / padded-fit)
  // ---------------------------------------------------------------------

  Widget _buildMap(DemandProvider provider) {
    final center = provider.center ??
        const LatLng(AppConfig.defaultLat, AppConfig.defaultLng);

    return AppVectorMap(
      initialCenter: center,
      initialZoom: _zoom,
      // Kamerani O'ZIMIZ boshqaramiz: `fitToContent` paddingni ichkarida
      // qat'iy saqlaydi va sheet balandligini bilmaydi (bundan tashqari u
      // faqat marker/marshrutni sig'diradi, poligonlarni emas).
      fitToContent: false,
      onMapCreated: (controller) {
        _mapController = controller;
        // Zonalar xarita qurilishidan OLDIN kelgan bo'lishi mumkin —
        // u holda kamerani shu yerda to'g'rilaymiz.
        _syncCamera();
      },
      // Ruxsat berilganini joylashuv kelganidan bilamiz; aks holda native
      // nuqtani yoqib bo'lmaydi.
      showUserLocation: provider.center != null,
      fillOverlay: AppMapFillOverlay(
        geoJson: provider.zones.mapGeoJson,
        // `match` ifodasi native tomonda ishlaydi: har poligon o'z
        // `level` xossasiga qarab bo'yaladi, Dart tomonida qatlamlarni
        // ajratish shart emas.
        fillColor: [
          'match',
          ['get', 'level'],
          demandLevelToApi(DemandLevel.high),
          mapLibreHex(kError),
          demandLevelToApi(DemandLevel.elevated),
          mapLibreHex(kWarning),
          // Zaxira: `normal` bu yerga umuman yetib kelmaydi (modelda
          // filtrlanadi), lekin ifoda oxirgi qiymatsiz yaroqsiz.
          mapLibreHex(kWarning),
        ],
        // Ikki daraja tiniqlik bilan ham farqlanadi — rang ko'rmaydigan
        // foydalanuvchi uchun yorqinlik farqi qoladi.
        fillOpacity: [
          'match',
          ['get', 'level'],
          demandLevelToApi(DemandLevel.high),
          0.34,
          demandLevelToApi(DemandLevel.elevated),
          0.18,
          0.0,
        ],
        // Kontur shaklni ko'rsatadi: qo'shni zonalar bir-biriga qo'shilib
        // bitta dog'ga aylanmaydi.
        outlineColor: [
          'match',
          ['get', 'level'],
          demandLevelToApi(DemandLevel.high),
          mapLibreHex(kErrorDeep),
          demandLevelToApi(DemandLevel.elevated),
          mapLibreHex(kWarningDeep),
          mapLibreHex(kWarningDeep),
        ],
      ),
    );
  }

  /// Sheetni o'lchaydi va (hali moslanmagan bo'lsa) kamerani moslaydi.
  void _syncCamera() {
    if (!mounted) return;
    final renderObject = _panelContentKey.currentContext?.findRenderObject();
    if (renderObject is RenderBox && renderObject.hasSize) {
      _panelContentHeight = renderObject.size.height;
    }
    _fitCamera();
  }

  /// Zonalarni va haydovchini SHEET OSTIDA QOLMAYDIGAN maydonga sig'diradi.
  ///
  /// Chetlar `MapCameraInsets` da hisoblanadi — bu ekran ham yo'lovchi
  /// xarita ekranlari bilan bir xil qoidaga bo'ysunadi: sheet ekranning
  /// pastki uchdan birini yopib turadi, kamera esa faqat OCHIQ maydonga
  /// moslanadi. Aks holda eng issiq zona sheet ostida qolardi.
  void _fitCamera({bool force = false}) {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    final points = _cameraPoints();
    if (points.isEmpty) return;

    // Zonasiz moslash YAKUNIY hisoblanmaydi: aks holda birinchi kadrdagi
    // "faqat haydovchi" markazlashuvi oxirgisi bo'lib qolardi va zonalar
    // kelganda xarita ularni umuman ko'rsatmasdi.
    final hasZones = _provider.zones.zones.isNotEmpty;
    if (!force && (hasZones ? _fittedToZones : _centeredOnDriver)) return;
    _centeredOnDriver = true;
    if (hasZones) _fittedToZones = true;

    final insets = MapCameraInsets.forPanel(
      context,
      panelContentHeight: _panelContentHeight,
    );

    if (points.length == 1) {
      _centerOnPoint(controller, points.first, insets);
      return;
    }

    var minLat = points.first.latitude, maxLat = minLat;
    var minLng = points.first.longitude, maxLng = minLng;
    for (final p in points) {
      minLat = p.latitude < minLat ? p.latitude : minLat;
      maxLat = p.latitude > maxLat ? p.latitude : maxLat;
      minLng = p.longitude < minLng ? p.longitude : minLng;
      maxLng = p.longitude > maxLng ? p.longitude : maxLng;
    }

    controller.animateCamera(
      ml.CameraUpdate.newLatLngBounds(
        ml.LatLngBounds(
          southwest: ml.LatLng(minLat, minLng),
          northeast: ml.LatLng(maxLat, maxLng),
        ),
        left: insets.left,
        top: insets.top,
        right: insets.right,
        bottom: insets.bottom,
      ),
    );
  }

  /// BITTA nuqta (faqat haydovchi ma'lum, zona yo'q) uchun ikki qadamli
  /// markazlash: `newLatLngBounds` chegarasiz ishlamaydi, shuning uchun
  /// nuqta qo'yilgandan keyin kamera ochiq maydon markaziga suriladi.
  /// Siljish ishorasi `MapCameraInsets.centeringScroll` da tushuntirilgan.
  Future<void> _centerOnPoint(
    ml.MapLibreMapController controller,
    LatLng point,
    MapCameraInsets insets,
  ) async {
    await controller.animateCamera(
      ml.CameraUpdate.newLatLngZoom(
        ml.LatLng(point.latitude, point.longitude),
        _zoom,
      ),
    );
    if (!mounted) return;
    final scroll = insets.centeringScroll;
    // 1dp dan kichik siljish sezilmaydi — ortiqcha animatsiya qilmaymiz.
    if (scroll.dx.abs() < 1 && scroll.dy.abs() < 1) return;
    await controller.animateCamera(
      ml.CameraUpdate.scrollBy(scroll.dx, scroll.dy),
    );
  }

  /// Kamera sig'dirishi kerak bo'lgan nuqtalar: haydovchi + barcha
  /// bo'yalgan zonalarning burchaklari. Ro'yxat xaritada CHIZILGAN narsa
  /// bilan bir xil — aks holda kamera ko'rinmaydigan joyga joy ajratardi.
  List<LatLng> _cameraPoints() {
    final points = <LatLng>[];
    final center = _provider.center;
    if (center != null) points.add(center);
    for (final zone in _provider.zones.zones) {
      for (final point in zone.ring) {
        // GeoJSON tartibi `[lng, lat]` — teskarisi xaritani okeanga olib
        // ketardi.
        points.add(LatLng(point[1], point[0]));
      }
    }
    return points;
  }

  // ---------------------------------------------------------------------
  // Yuqori panel: orqaga + sarlavha + yangilash/sig'dirish
  // ---------------------------------------------------------------------

  Widget _buildTopBar(DemandProvider provider) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.all(context.gutter),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AgMapFab(
              icon: Icons.arrow_back_rounded,
              semanticsLabel: 'Orqaga',
              onTap: () => Navigator.of(context).pop(),
            ),
            const SizedBox(width: kSpace3),
            Expanded(child: _buildTitlePill(provider)),
            const SizedBox(width: kSpace3),
            Column(
              // Ustun kontent balandligida qolsin: `max` bo'lsa u butun
              // ekran balandligini egallab, xarita ustida ko'rinmas
              // qatlam bo'lib turardi.
              mainAxisSize: MainAxisSize.min,
              children: [
                AgMapFab(
                  icon: Icons.refresh_rounded,
                  semanticsLabel: 'Talab maʼlumotini yangilash',
                  // Tugma yuklanayotganda ham FAOL qoladi: takroriy so'rov
                  // provayderda baribir o'tkazib yuboriladi, holat esa
                  // sarlavhada ("Yangilanmoqda…") aytiladi. O'chirilgan
                  // tugma bu yerda yomonroq bo'lardi — haydovchi bosadi,
                  // hech narsa bo'lmaydi va sababini ko'rmaydi.
                  onTap: () => provider.refresh(),
                ),
                const SizedBox(height: kSpace2),
                AgMapFab(
                  icon: Icons.center_focus_strong_rounded,
                  semanticsLabel: 'Zonalarni ekranga sig\'dirish',
                  // Kamera o'zi faqat ochilishda moslanadi; xaritani
                  // surib yuborgan haydovchi shu tugma bilan qaytadi.
                  // Xaritadagi ASOSIY amal shu — shuning uchun `large`.
                  large: true,
                  onTap: () => _fitCamera(force: true),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTitlePill(DemandProvider provider) {
    final updatedAt = provider.updatedAt;
    final isRefreshing = provider.state == DemandProviderState.loading;

    return Container(
      // Qat'iy balandlik EMAS: tizim shrifti kattalashtirilganda ikki
      // qatorli sarlavha bu qutiga sig'masdi.
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace2,
      ),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: kShadowCard,
      ),
      alignment: Alignment.centerLeft,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Talab xaritasi',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.fs(kFontTitle),
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          if (isRefreshing)
            Text(
              'Yangilanmoqda…',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.fs(kFontMicro),
                color: kInkMuted,
                fontWeight: FontWeight.w500,
              ),
            )
          else if (updatedAt != null)
            Text(
              'Yangilandi: ${Formatters.formatTime(updatedAt)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.fs(kFontMicro),
                color: kInkMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Pastki panel: to'rt holat — yuklanmoqda / xato / bo'sh / legenda
  //
  // QATLAMLI sheet: panel foni `kSurface2` (`layered: true`), ichidagi
  // bloklar oq `AgSurfaceCard`. Ikkalasi BIRGA ishlatiladi — oq sheet
  // ustidagi oq karta ko'rinmasdi.
  // ---------------------------------------------------------------------

  Widget _buildBottomPanel(DemandProvider provider) {
    return AdaptiveMapPanel(
      layered: true,
      // Yon panel rejimida (720dp+) tepada suzuvchi "orqaga" tugmasi turadi.
      topGap: kSpace10 + kSpace6,
      child: KeyedSubtree(
        key: _panelContentKey,
        child: AnimatedSize(
          duration: kDurationBase,
          curve: kEaseStandard,
          alignment: Alignment.topCenter,
          child: _buildPanelContent(provider),
        ),
      ),
    );
  }

  Widget _buildPanelContent(DemandProvider provider) {
    // Birinchi yuklash — spinner emas, skeleton (ekran tuzilishi darhol
    // ko'rinadi va sakramaydi).
    if (!provider.hasData &&
        provider.state == DemandProviderState.loading) {
      return const _DemandSkeleton();
    }

    if (!provider.hasData && provider.state == DemandProviderState.error) {
      return AgSurfaceCard(
        // Ichki bo'shliqni `AppErrorState` o'zi beradi — karta paddingi
        // qo'shilsa, sheet bekorga ikki barobar o'sardi.
        padding: EdgeInsets.zero,
        child: AppErrorState(
          compact: true,
          title: 'Talab maʼlumoti olinmadi',
          message: provider.error ?? 'Xatolik yuz berdi',
          onRetry: () => provider.refresh(),
        ),
      );
    }

    // Ma'lumot bor, lekin hech qayerda talab odatdagidan yuqori emas.
    if (provider.zones.isEmpty) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AgSurfaceCard(
            padding: EdgeInsets.zero,
            child: AppEmptyState(
              compact: true,
              icon: Icons.explore_outlined,
              title: 'Hozir talab hamma joyda oddiy',
              message: 'Zonalar orasida farq yo‘q — istalgan joyda kutishingiz '
                  'mumkin. Maʼlumot har daqiqada yangilanadi.',
            ),
          ),
          _buildStaleNotice(provider),
        ],
      );
    }

    final highDistance = _nearestDistanceMeters(provider, DemandLevel.high);
    final elevatedDistance =
        _nearestDistanceMeters(provider, DemandLevel.elevated);
    final target = _navigationTarget(provider);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ⚠️ TUSHUNTIRISH SHEET DAGI ENG KATTA ELEMENT EMAS. Bu jumla
        // O'ZGARMAYDI — u haydovchi uchun birinchi safar ma'lumot, keyin
        // esa shovqin. Qaror qilinadigan narsa "Talab juda yuqori · 1,2 km"
        // qatori, shuning uchun 1,5 soniyalik qarashda ANIQ O'SHA birinchi
        // o'qilishi kerak. Ilgari bu sarlavha kFontH3/w800 edi, ya'ni
        // qatorlardan KATTA — ko'z avval o'zgarmas matnga tushardi.
        AgSurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bo‘yalgan joylarda buyurtma ko‘proq',
                style: TextStyle(
                  fontSize: context.fs(kFontBody),
                  fontWeight: FontWeight.w700,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace1),
              Text(
                'Shu zonalarga yaqin turing — buyurtma tezroq keladi.',
                style: TextStyle(
                  fontSize: context.fs(kFontLabel),
                  color: kInkMuted,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: kSpace2),
        AgSurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (provider.zones.highCount > 0) ...[
                _DemandLevelRow(
                  level: DemandLevel.high,
                  count: provider.zones.highCount,
                  distanceMeters: highDistance,
                ),
                if (provider.zones.elevatedCount > 0)
                  const SizedBox(height: kSpace3),
              ],
              if (provider.zones.elevatedCount > 0)
                _DemandLevelRow(
                  level: DemandLevel.elevated,
                  count: provider.zones.elevatedCount,
                  distanceMeters: elevatedDistance,
                ),
              const SizedBox(height: kSpace3),
              // Bo'yalmagan joyning ma'nosi ham aytiladi — aks holda
              // "rangsiz" "ma'lumot yo'q" deb tushunilishi mumkin.
              Text(
                'Bo‘yalmagan joylarda talab odatdagidek.',
                style: TextStyle(
                  fontSize: context.fs(kFontCaption),
                  // Yozuvda kInkSubtle ISHLATILMAYDI (3.67:1 — kichik matn
                  // uchun AA dan past); kInkMuted 5.47:1.
                  color: kInkMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        if (target != null) ...[
          const SizedBox(height: kSpace4),
          AppButton(
            label: 'Eng yaqin zonaga yo‘l olish',
            // Haydovchi nishoni — `kControlHeight` (54) yo'lovchi uchun.
            height: kControlHeightDriver,
            icon: const Icon(Icons.navigation_rounded, size: 20),
            semanticsLabel: 'Eng yaqin talab zonasiga navigatsiyani ochish, '
                '${_levelTitle(target.level)}, '
                '${Formatters.formatDistance(target.meters)}',
            onPressed: () => _openNavigation(target),
          ),
        ],
        _buildStaleNotice(provider),
      ],
    );
  }

  /// Eski ma'lumot ustida turgan xato: zonalar ekranda qoladi, lekin
  /// haydovchi ular eskirganini bilishi kerak.
  Widget _buildStaleNotice(DemandProvider provider) {
    final message = provider.error;
    if (message == null || !provider.hasData) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: kSpace4),
      child: InlineErrorWidget(message: 'Yangilanmadi: $message'),
    );
  }

  // ---------------------------------------------------------------------
  // MASOFA VA NAVIGATSIYA
  // ---------------------------------------------------------------------

  /// Haydovchidan shu darajadagi ENG YAQIN zonagacha masofa (metr).
  /// Joylashuv noma'lum bo'lsa `null` — bunda masofa umuman ko'rsatilmaydi
  /// (taxminiy raqam yo'q raqamdan yomonroq).
  double? _nearestDistanceMeters(DemandProvider provider, DemandLevel level) {
    return _nearestZone(provider, level)?.meters;
  }

  _NearestZone? _nearestZone(DemandProvider provider, DemandLevel level) {
    final from = provider.center;
    if (from == null) return null;

    _NearestZone? nearest;
    for (final zone in provider.zones.zones) {
      if (zone.level != level) continue;
      final center = _zoneCenter(zone);
      if (center == null) continue;
      final meters = _distance.as(LengthUnit.Meter, from, center);
      if (nearest == null || meters < nearest.meters) {
        nearest = _NearestZone(level: level, center: center, meters: meters);
      }
    }
    return nearest;
  }

  /// Navigatsiya nishoni: avval "juda yuqori", u yo'q bo'lsa "yuqori"
  /// darajadagi eng yaqin zona. Daraja masofadan USTUN: haydovchi bu
  /// ekranga aynan issiqroq joyni topish uchun kiradi.
  _NearestZone? _navigationTarget(DemandProvider provider) {
    return _nearestZone(provider, DemandLevel.high) ??
        _nearestZone(provider, DemandLevel.elevated);
  }

  /// Zona markazi — halqa nuqtalarining o'rtachasi. H3 katagi kichik va
  /// deyarli muntazam olti burchak, shuning uchun oddiy o'rtacha yetarli
  /// aniqlikda markaz beradi (og'irlik markazini hisoblash bu yerda
  /// sezilarli farq bermaydi).
  LatLng? _zoneCenter(DemandZone zone) {
    if (zone.ring.isEmpty) return null;
    var lat = 0.0;
    var lng = 0.0;
    for (final point in zone.ring) {
      // GeoJSON tartibi `[lng, lat]`.
      lng += point[0];
      lat += point[1];
    }
    return LatLng(lat / zone.ring.length, lng / zone.ring.length);
  }

  /// Qurilmaning navigatsiya ilovasini zona markaziga qaratib ochadi.
  /// Naqsh `driver/screens/navigation_screen.dart#_openNavigation` bilan
  /// bir xil: Androidda umumiy `geo:` (OS o'rnatilgan navigatorni tanlaydi),
  /// iOS'da `geo:` qo'llab-quvvatlanmagani uchun Apple Maps havolasi.
  Future<void> _openNavigation(_NearestZone target) async {
    final label = Uri.encodeComponent('Talab zonasi');
    final uri = Platform.isIOS
        ? Uri.parse(
            'https://maps.apple.com/?daddr='
            '${target.center.latitude},${target.center.longitude}',
          )
        : Uri.parse(
            'geo:0,0?q=${target.center.latitude},'
            '${target.center.longitude}($label)',
          );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Navigatsiya ilovasi topilmadi')),
      );
    }
  }
}

/// Haydovchiga eng yaqin zona — daraja + markaz + masofa birga.
@immutable
class _NearestZone {
  const _NearestZone({
    required this.level,
    required this.center,
    required this.meters,
  });

  final DemandLevel level;
  final LatLng center;
  final double meters;
}

String _levelTitle(DemandLevel level) => switch (level) {
      DemandLevel.high => 'Talab juda yuqori',
      DemandLevel.elevated => 'Talab yuqori',
      DemandLevel.normal => 'Talab oddiy',
    };

/// Legendaning bitta qatori: rang namunasi + ikonka + matn + zonalar soni
/// + eng yaqin zonagacha masofa.
///
/// Uchta signal ataylab takrorlanadi. Rang ko'rmaydigan haydovchi uchun
/// ikonka va matn, xaritani uzoqdan ko'rayotgan uchun rang ishlaydi.
/// Masofa esa darajani QARORGA aylantiradi: "juda yuqori, 900 m" bilan
/// "juda yuqori, 12 km" mutlaqo boshqa ma'no.
class _DemandLevelRow extends StatelessWidget {
  const _DemandLevelRow({
    required this.level,
    required this.count,
    required this.distanceMeters,
  });

  final DemandLevel level;
  final int count;

  /// `null` — joylashuv noma'lum, masofa ko'rsatilmaydi.
  final double? distanceMeters;

  @override
  Widget build(BuildContext context) {
    final (fill, border, icon) = switch (level) {
      DemandLevel.high => (
          kError,
          kErrorDeep,
          Icons.local_fire_department_rounded,
        ),
      DemandLevel.elevated => (
          kWarning,
          kWarningDeep,
          Icons.trending_up_rounded,
        ),
      DemandLevel.normal => (kInkSubtle, kInkMuted, Icons.remove_rounded),
    };

    final title = _levelTitle(level);
    final countLabel = count == 1 ? '1 zona' : '$count zona';
    final distance = distanceMeters;
    final distanceLabel =
        distance == null ? null : Formatters.formatDistance(distance);

    return Semantics(
      container: true,
      label: distanceLabel == null
          ? '$title, $countLabel'
          : '$title, $countLabel, eng yaqini $distanceLabel',
      excludeSemantics: true,
      child: Row(
        children: [
          // Xaritadagi to'ldirish bilan bir xil tiniqlik — namuna
          // xaritada haqiqatda ko'rinadigan rangni ko'rsatishi kerak.
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: fill.withValues(
                alpha: level == DemandLevel.high ? 0.34 : 0.18,
              ),
              borderRadius: BorderRadius.circular(kRadiusXs),
              border: Border.all(color: border, width: 1.5),
            ),
            child: Icon(icon, size: 18, color: border),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Daraja — sheet dagi QARORNING yarmi, shuning uchun u
                // tushuntirish sarlavhasidan KATTA (kFontH3, w800).
                Text(
                  title,
                  style: TextStyle(
                    fontSize: context.fs(kFontH3),
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                Text(
                  countLabel,
                  style: TextStyle(
                    fontSize: context.fs(kFontCaption),
                    fontWeight: FontWeight.w500,
                    color: kInkMuted,
                  ),
                ),
              ],
            ),
          ),
          if (distanceLabel != null) ...[
            const SizedBox(width: kSpace3),
            // Masofa — sheet dagi ENG KATTA element va qarorning ikkinchi
            // yarmi: "juda yuqori, 900 m" bilan "juda yuqori, 12 km"
            // mutlaqo boshqa qaror. Mashinadan qaralganda birinchi bo'lib
            // shu raqam o'qilishi kerak, shuning uchun kFontH2 (19dp) —
            // to'q siyohda, oq kartada 17.5:1.
            Text(
              distanceLabel,
              style: TextStyle(
                fontSize: context.fs(kFontH2),
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DemandSkeleton extends StatelessWidget {
  const _DemandSkeleton();

  @override
  Widget build(BuildContext context) {
    return const AppSkeletonGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSkeleton(width: 200, height: 18, radius: kRadiusXs),
          SizedBox(height: kSpace3),
          AppSkeleton(width: double.infinity, height: 12),
          SizedBox(height: kSpace5),
          AppSkeleton(width: double.infinity, height: 32, radius: kRadiusSm),
          SizedBox(height: kSpace3),
          AppSkeleton(width: double.infinity, height: 32, radius: kRadiusSm),
        ],
      ),
    );
  }
}
