import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_platform.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/features/driver/widgets/driver_earnings_hero.dart';
import 'package:angren_taxi/features/driver/widgets/driver_verification_notice.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/models/driver_service.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/service_catalog.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/ag_option_chips.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
// Xarita kamerasi MapLibre'ning o'z LatLng turini kutadi; ilovaning
// qolgan qismi latlong2 ni ishlatadi, shuning uchun prefiks bilan.
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show MapLibreMapController, CameraUpdate, LatLng;
import 'package:provider/provider.dart';

// ============================================================================
// HAYDOVCHI BOSH EKRANI — 1.5 SONIYALIK QARASH uchun qurilgan.
//
// Bu ekran HARAKATDAGI avtomobildan ochiladi, shu sababli tuzilma
// yo'lovchi bosh ekranidan farq qiladi:
//
//   · BITTA hero — kunlik daromad (`DriverEarningsHero`). Haydovchi
//     ilovani aynan shu raqam uchun ochadi: "bugun qancha ishladim?".
//   · Asosiy amal `kControlHeightDriver` (64dp) — tebranayotgan mashinada
//     yo'lovchi o'lchami (54dp) birinchi urinishda tushmaydi.
//   · Ikkilamchi nishonlar `kMinTapTargetDriver` (56dp).
//   · Holat RANG BILAN BIRGA MATN va IKONKA SHAKLI orqali beriladi —
//     yuqori paneldagi `AppStatusBadge` va hero ichidagi nuqta+yozuv.
//   · Xarita ustidagi doira tugmalar `AgMapFab`, sheet esa
//     `AdaptiveMapPanel(layered: true)` + oq `AgSurfaceCard` bloklari.
//
// ⚠️ BIZNES MANTIQ O'ZGARMAGAN: onlayn/oflayn chaqiruvlari, tekshiruv
// darvozasi, faol buyurtmaga o'tish yo'llari — hammasi o'sha-o'sha.
// Bu yerda qo'shilgan yagona so'rovlar — FAQAT O'QISH uchun
// (`loadEarnings`, `loadEarningsBreakdown`, `loadBonusProgress`,
// `loadDriverServices`), ular hech narsani o'zgartirmaydi.
// ============================================================================

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
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
      final driver = context.read<DriverProvider>();
      driver.initialize();
      driver.addListener(_onDriverProviderChanged);
      // Faqat O'QISH so'rovlari — bosh ekrandagi raqamlar HAQIQIY bo'lishi
      // uchun. Hech biri hech narsani o'zgartirmaydi va har biri o'z
      // xatosini ichida yutadi (`DriverProvider` dagi izohlarga qarang),
      // shuning uchun biri yiqilsa ham ekran ishlayveradi.
      //
      // ⚠️ Ilgari bosh ekran `todayEarnings` ni KO'RSATARDI, lekin uni
      // hech qachon YUKLAMASDI: qiymat faqat safar tugaganda o'sardi va
      // ilova qayta ochilganda nolga tushib qolardi. Haydovchiga "bugun 0
      // ishlading" deb ko'rsatish — eng og'ir turdagi soxta ekran.
      driver.loadEarnings();
      driver.loadEarningsBreakdown();
      driver.loadBonusProgress();
      driver.loadDriverServices();
    });
  }

  void _onDriverProviderChanged() {
    final driver = context.read<DriverProvider>();
    if (driver.pendingOffer != null && mounted) {
      Navigator.of(context).pushNamed('/driver/offer');
    }
    // Surfaces goOnline/goOffline failures — critically the "balance is
    // negative" block, which the driver otherwise has no way to see.
    if (driver.state == DriverProviderState.error &&
        driver.error != null &&
        mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(driver.error!), backgroundColor: kErrorDeep),
      );
      driver.clearError();
    }
  }

  @override
  void dispose() {
    try {
      context.read<DriverProvider>().removeListener(_onDriverProviderChanged);
    } catch (_) {}
    super.dispose();
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
    } else if (mounted) {
      setState(() => _locationLoading = false);
      final reason = await locationService.checkUnavailableReason();
      _showLocationError(reason);
    }
  }

  /// Kamerani haydovchiga qaratadi va uni sheet USTIGA chiqaradi.
  ///
  /// ⚠️ NEGA IKKI QADAM. `newLatLngZoom` nuqtani ekran MARKAZIGA qo'yadi,
  /// markaz esa sheet ostida qoladi — ya'ni haydovchi o'z mashinasini
  /// ko'rish uchun sheetni pastga surishga majbur bo'lardi. Chegara
  /// (`newLatLngBounds`) paddingi bitta nuqta uchun ishlamaydi (to'rtburchak
  /// yo'q), shuning uchun nuqta qo'yilgandan keyin kamera ochiq maydon
  /// markaziga suriladi. Siljish ishorasi `MapCameraInsets.centeringScroll`
  /// da tushuntirilgan. Naqsh yo'lovchi bosh ekrani bilan bir xil.
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

  // Without this, a permission/GPS failure silently falls back to a hardcoded
  // Angren-center coordinate with no indication to the driver why the map
  // shows the wrong place.
  void _showLocationError(LocationUnavailableReason reason) {
    if (!mounted) return;
    final message = switch (reason) {
      LocationUnavailableReason.serviceDisabled =>
        "Telefoningizda joylashuv (GPS) o'chirilgan — xarita to'g'ri ishlashi uchun uni yoqing.",
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        "Ilova joylashuvga ruxsat olmadi — xaritada aniq joyingizni ko'rish uchun ruxsat bering.",
      LocationUnavailableReason.timeoutOrError =>
        "Joylashuvni aniqlab bo'lmadi. Ochiq joyga o'ting yoki qayta urinib ko'ring.",
    };
    final actionLabel = switch (reason) {
      LocationUnavailableReason.serviceDisabled => 'Yoqish',
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        'Sozlamalar',
      LocationUnavailableReason.timeoutOrError => 'Qayta urinish',
    };
    final VoidCallback onAction = switch (reason) {
      LocationUnavailableReason.serviceDisabled => () =>
          Geolocator.openLocationSettings(),
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        () => Geolocator.openAppSettings(),
      LocationUnavailableReason.timeoutOrError => () {
          setState(() => _locationLoading = true);
          _initLocation();
        },
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: kWarningDeep,
        duration: const Duration(seconds: 8),
        action: SnackBarAction(
          label: actionLabel,
          textColor: kOnPrimary,
          onPressed: onAction,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<DriverProvider>(
        builder: (context, driverProvider, _) {
          return Stack(
            children: [
              _buildMap(driverProvider),
              _buildTopBar(driverProvider),
              _buildBottomPanel(driverProvider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(DriverProvider driverProvider) {
    return AppVectorMap(
      initialCenter: _currentLocation,
      initialZoom: 15,
      onMapCreated: (controller) {
        _mapController = controller;
        // Fiks xarita qurilishidan OLDIN kelgan bo'lsa, kamerani shu yerda
        // sheet ustiga chiqaramiz — aks holda haydovchi nuqtasi ekran
        // markazida, ya'ni sheet ostida qolardi.
        if (_hasLocationFix) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnUser());
        }
      },
      // Onlaynda mint mashina markeri (holat xaritada ham ko'rinadi),
      // oflaynda esa oddiy native joylashuv nuqtasi.
      markers: [
        if (driverProvider.isOnline)
          AppMapMarker(point: _currentLocation, icon: AppMapIcon.car),
      ],
      showUserLocation: !driverProvider.isOnline && _hasLocationFix,
    );
  }

  // --------------------------------------------------------------------
  // YUQORI PANEL.
  //
  // Doira tugmalar endi `AgMapFab`: xarita foni oldindan noma'lum
  // (asfalt, ko'k suv, yashil park), shuning uchun tugma yuzani SOYA
  // BILAN BIRGA `kLineInteractive` chegarasi orqali ajratadi — soya
  // yolg'iz och fonda deyarli ko'rinmaydi (WCAG 1.4.11, 3:1).
  //
  // "Joylashuvimni topish" — `large: true`. Ierarxiya bu yerda rangda
  // emas, O'LCHAMDA beriladi: xarita foni ustida rang farqi ishonchsiz.
  //
  // Menyu tugmasidagi nuqta — tekshiruvda e'tibor talab qiladigan
  // element bor. Ilgari bu faqat menyu ICHIDA ko'rinardi, ya'ni
  // haydovchi menyuni ochmaguncha hujjati muddati tugayotganini bilmasdi.
  //
  // ⚠️ Ikkala tugma ham `_driverFab` orqali o'tadi — sabab o'sha
  // yordamchining izohida.
  // --------------------------------------------------------------------
  Widget _buildTopBar(DriverProvider driverProvider) {
    final needsAttention = driverProvider.verification.actionNeededCount > 0;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(kSpace4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Consumer<AuthProvider>(
              builder: (context, auth, _) => _driverFab(
                AgMapFab(
                  icon: Icons.menu,
                  semanticsLabel: 'Menyu',
                  badge: needsAttention,
                  onTap: () => _showMenu(context, auth, driverProvider),
                ),
              ),
            ),
            // Holat faqat rang bilan berilmaydi: ikonka + matn + rang.
            // Oldin mint fon ustida OQ matn (2.12:1) edi.
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(kRadiusXs),
                boxShadow: kShadowCard,
              ),
              child: AppStatusBadge(
                label: driverProvider.isOnline ? 'Online' : 'Offline',
                tone: driverProvider.isOnline
                    ? AppStatusTone.success
                    : AppStatusTone.neutral,
              ),
            ),
            _driverFab(
              AgMapFab(
                icon: Icons.my_location,
                semanticsLabel: 'Joylashuvimni topish',
                large: true,
                onTap: _initLocation,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Xarita tugmasini HAYDOVCHI nishoniga (`kMinTapTargetDriver`, 56dp)
  /// kengaytiradi.
  ///
  /// ⚠️ NEGA CHAQIRUV JOYIDA. `AgMapFab` ning tegish maydoni
  /// `kMinTapTarget` (48dp) — u YO'LOVCHI xaritasi uchun o'lchangan, u
  /// yerda doira tugmalar zanjir bo'lib turadi va kattaroq nishonlar
  /// xaritani haddan tashqari yopadi (komponent izohida shu yozilgan).
  /// Haydovchi ekranida esa nishon 56dp dan past bo'lmasligi kerak:
  /// tebranayotgan mashinada barmoq 48dp ga birinchi urinishda tushmaydi.
  /// Bu yerda tugma bor-yo'g'i ikkita va ular ekranning qarama-qarshi
  /// burchaklarida — joy yetarli.
  ///
  /// Umumiy komponentning o'zini o'zgartirish YO'LOVCHI ekranlariga ham
  /// tegib ketardi, shuning uchun yetishmayotgan 8dp shu yerda beriladi.
  /// `SizedBox` bolaga QAT'IY 56x56 chegara uzatadi, `AgMapFab` ichidagi
  /// tegish qutisi esa o'sha chegaraga kengayadi; ko'rinadigan doira
  /// (44/48dp) o'z `Center` i ichida o'zgarmay qoladi — ya'ni tugma
  /// ko'zga o'sha-o'sha ko'rinadi, barmoqqa esa kattaroq bo'ladi.
  Widget _driverFab(Widget fab) => SizedBox(
        width: kMinTapTargetDriver,
        height: kMinTapTargetDriver,
        child: fab,
      );

  // --------------------------------------------------------------------
  // SHEET — QATLAMLI YUZA.
  //
  // Panel foni `kSurface2` (`layered: true`), ichidagi bloklar esa oq
  // `AgSurfaceCard` yoki to'q siyoh hero. Ikkalasi BIRGA ishlatilishi
  // shart: oq panel ustidagi oq karta ajralmaydi. `AdaptiveMapPanel`
  // 720dp dan keng ekranda panelni CHAP YON PANELga aylantiradi va
  // sudrash dastagini o'zi chizadi.
  //
  // Uch holat: yuklanmoqda → skeleton, faol buyurtma → karta,
  // bo'sh → onlayn toggle bloki. (Bu bo'linish o'zgarmagan.)
  // --------------------------------------------------------------------
  Widget _buildBottomPanel(DriverProvider driverProvider) {
    return AdaptiveMapPanel(
      layered: true,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      child: Column(
        key: _sheetContentKey,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_locationLoading)
            const AppSkeletonList(
              itemCount: 2,
              hasTrailing: true,
              padding: EdgeInsets.zero,
            )
          else if (driverProvider.hasActiveOrder)
            _buildActiveOrderCard(driverProvider)
          else
            _buildOnlineToggle(driverProvider),
        ],
      ),
    );
  }

  Widget _buildOnlineToggle(DriverProvider driverProvider) {
    final isOnline = driverProvider.isOnline;
    final isLoading = driverProvider.state == DriverProviderState.loading;
    final verification = driverProvider.verification;

    // Tekshiruv bloklagan bo'lsa smenani BOSHLASH mumkin emas.
    //
    // ⚠️ Allaqachon onlayn haydovchi bundan mustasno: hujjat muddati
    // smena o'rtasida tugab qolsa, tugmani o'chirish uni onlayn holatda
    // qamab qo'yardi — "Offline bo'lish" har doim ochiq turishi shart.
    final canToggle = isOnline || verification.canGoOnline;

    // ⚠️ BLOKLANGAN HOLATDA EKRAN QISQARADI. Sabab banneri + hero +
    // chiplar + bonus birga kichik telefonga (640dp) sig'maydi va sheet
    // toshib ketardi. Bundan ham muhimi: bloklangan haydovchining yagona
    // vazifasi — hujjatni tuzatish. Bonus chizig'i va xizmat chiplari
    // hozir hech narsani hal qilmaydi, shuning uchun ular olib turiladi
    // va ekran bitta savolga javob beradi: "nima qilishim kerak?".
    final blocked = !verification.canGoOnline;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (blocked)
          Padding(
            padding: const EdgeInsets.only(bottom: kSpace3),
            child: DriverVerificationNotice(
              key: const ValueKey('driver_verification_blocked'),
              tone: AppStatusTone.danger,
              icon: Icons.block_rounded,
              title: "Onlayn bo'lish yopiq",
              message: verification.blockedReason ??
                  "Tekshiruv to'liq emas — talablarni bajaring.",
              actionLabel: 'Tekshiruvni ochish',
              onAction: () =>
                  Navigator.of(context).pushNamed('/driver/verification'),
            ),
          )
        else if (verification.hasDueSoon)
          Padding(
            padding: const EdgeInsets.only(bottom: kSpace3),
            child: DriverVerificationNotice(
              key: const ValueKey('driver_verification_due_soon'),
              tone: AppStatusTone.warning,
              icon: Icons.schedule_rounded,
              title: 'Muddat yaqinlashmoqda',
              // Ogohlantirish — ishni TO'XTATMAYDI.
              message: "Ba'zi hujjatlarning muddati tugayapti. "
                  'Oldindan yangilab qo\'ying.',
              actionLabel: 'Ko\'rish',
              onAction: () =>
                  Navigator.of(context).pushNamed('/driver/verification'),
            ),
          ),
        DriverEarningsHero(
          todayEarnings: driverProvider.todayEarnings,
          todayTrips: driverProvider.earningsBreakdown.today.trips,
          weekNet: driverProvider.earningsBreakdown.week.net,
          isOnline: isOnline,
          bonus: blocked ? null : _weeklyBonus(driverProvider),
          onTap: () => Navigator.of(context).pushNamed('/driver/earnings'),
        ),
        if (!blocked) ...[
          const SizedBox(height: kSpace3),
          _buildServiceChips(driverProvider),
        ],
        const SizedBox(height: kSpace3),
        _buildDemandMapLink(),
        const SizedBox(height: kSpace4),
        Semantics(
          button: true,
          toggled: isOnline,
          enabled: !isLoading && canToggle,
          label: isOnline ? "Offline bo'lish" : "Online bo'lish",
          value: isOnline ? 'Online' : 'Offline',
          // Ekran o'quvchi tugma nega bosilmasligini AYTSIN — aks holda
          // "o'chiq tugma" sababsiz ko'rinadi.
          hint: canToggle ? null : verification.blockedReason,
          excludeSemantics: true,
          child: AppPressable(
            key: const ValueKey('driver_online_toggle'),
            // Haptika bu yerda o'chirilgan — quyida holatga QARAB
            // farqlanadi: onlayn bo'lish "muvaffaqiyat", oflayn bo'lish
            // esa oddiy "sezilarli harakat".
            haptic: AppHapticLevel.none,
            pressedScale: 0.98,
            minTapTarget: false,
            onTap: isLoading || !canToggle
                ? null
                : () {
                    if (isOnline) {
                      AppHaptics.impact();
                      driverProvider.goOffline();
                    } else {
                      // Ish smenasining boshlanishi — haydovchi uchun
                      // kunning eng muhim harakati.
                      AppHaptics.success();
                      driverProvider.goOnline();
                    }
                  },
            child: AnimatedContainer(
              duration: kDurationSlow,
              curve: kEaseEmphasized,
              width: double.infinity,
              // ⚠️ `kControlHeight` (54) EMAS. Bu kunning eng muhim
              // haydovchi amali va u ko'pincha mashina ichida, tebranish
              // ostida bosiladi — `kControlHeightDriver` (64dp) birinchi
              // urinishda tushishini ta'minlaydi.
              height: kControlHeightDriver,
              decoration: BoxDecoration(
                // Ikkala FAOL holat ham GRADIENT — shunda `AnimatedContainer`
                // ular orasida silliq o'ta oladi. (Gradient ↔ tekis rang
                // o'tishi sakrab ko'rinardi.)
                //
                // Oflayn: to'q yashil CTA gradienti (oq matn 5.38:1).
                // Onlayn: to'q "ink" gradient — harakat endi "to'xtatish".
                // Bloklangan: tekis `kPrimaryDisabled` + `kInkMuted` yozuv
                // (4.88:1) — tugma bosilmasligi ko'rinib turadi.
                gradient: canToggle
                    ? (isOnline ? kGradientInk : kGradientCta)
                    : null,
                color: canToggle ? null : kPrimaryDisabled,
                borderRadius: BorderRadius.circular(kRadiusMd),
                boxShadow: canToggle
                    ? (isOnline ? kShadowInk : kShadowCta)
                    : null,
              ),
              alignment: Alignment.center,
              child: AnimatedSwitcher(
                duration: kDurationBase,
                child: isLoading
                    ? const AdaptiveProgress(
                        key: ValueKey('loading'),
                        size: 22,
                        color: kOnPrimary,
                      )
                    : Text(
                        isOnline ? "Offline bo'lish" : "Online bo'lish",
                        key: ValueKey(isOnline),
                        style: TextStyle(
                          // Tugma matni ham haydovchi o'lchamida: 16dp
                          // yozuv 64dp tugma ichida yo'qolib ketadi.
                          fontSize: kFontH3,
                          fontWeight: FontWeight.w800,
                          color: canToggle ? kOnPrimary : kInkMuted,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Haftalik maqsad bonusi. Bir nechtasi bo'lsa BIRINCHISI olinadi —
  /// bosh ekranda bittasidan ortig'i 1.5 soniyalik qarashga sig'maydi,
  /// to'liq ro'yxat daromad ekranida qoladi.
  DriverBonusProgress? _weeklyBonus(DriverProvider driverProvider) {
    for (final item in driverProvider.bonusProgress) {
      if (item.ruleType == BonusRuleType.weeklyGoal) return item;
    }
    return null;
  }

  // --------------------------------------------------------------------
  // XIZMAT TURLARI CHIPLARI.
  //
  // ⚠️ BU YERDA HECH NARSA YOQILMAYDI VA O'CHIRILMAYDI. Chiplar faqat
  // "hozir qaysi turlarni olyapman" degan O'QISH ko'rinishi; bosilganda
  // mavjud `/driver/services` ekrani ochiladi va butun yoqish/o'chirish
  // mantig'i (qoralama, tekshiruv talablari, saqlash, server xatosi)
  // o'sha yerda, O'ZGARMAGAN holda qoladi.
  //
  // NEGA SHUNDAY: bu bloklovchi mantiq — turni yoqish uchun tekshiruv
  // talablari bajarilgan bo'lishi kerak. Bir teginishda o'chib ketadigan
  // chip harakatdagi mashinada tasodifan bosilsa, haydovchi buyurtmalar
  // oqimini o'zi bilmagan holda to'xtatib qo'yardi va buni faqat "nega
  // buyurtma kelmayapti?" deb ancha keyin sezardi.
  //
  // Ro'yxat ham, yorliq ham SERVERDAN (`driver_service.dart`) — bu yerda
  // `taxi`/`food` uchun qattiq kodlangan nom YO'Q.
  // --------------------------------------------------------------------
  Widget _buildServiceChips(DriverProvider driverProvider) {
    final options = driverProvider.services.options;
    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: kSpace1, bottom: kSpace2),
          child: Text(
            'Qabul qilinadigan buyurtmalar',
            style: TextStyle(
              // `kInkSubtle` EMAS — u 3.67:1 bilan yozuv uchun AA'dan past.
              color: kInkMuted,
              fontSize: kFontCaption,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        AgOptionChips(
          items: [
            for (final option in options)
              AgOptionChipItem(
                id: option.serviceType,
                label: option.label,
                icon: _serviceIcon(option.serviceType),
                active: option.enabled,
                // Chip HAR DOIM bosiladi — u sozlama emas, o'tish yo'li.
                // Bloklangan tur ham ochilsin: haydovchi nega
                // bloklanganini o'sha ekranda o'qiydi.
                semanticsLabel: _serviceChipSemantics(option),
              ),
          ],
          onTap: (_) => Navigator.of(context).pushNamed('/driver/services'),
        ),
      ],
    );
  }

  /// Ikonka faqat TANISH tur uchun.
  ///
  /// ⚠️ `ServiceCatalogEntry.of` noma'lum turni TAKSIGA tushiradi — bu
  /// yerda u yaramaydi: server `pharmacy` yuborsa, chip taksi ikonkasi
  /// bilan chiqib, haydovchini chalg'itardi. Tanish bo'lmasa ikonka
  /// umuman qo'yilmaydi (`AgOptionChipItem.icon` ixtiyoriy) va serverning
  /// o'z yorlig'i o'zi gapiradi.
  IconData? _serviceIcon(String serviceType) {
    for (final entry in ServiceCatalogEntry.all) {
      if (entry.serviceType == serviceType) return entry.icon;
    }
    return null;
  }

  String _serviceChipSemantics(DriverServiceOption option) {
    if (!option.canEnable && !option.enabled) {
      final reason = option.blockedReason;
      return '${option.label}, mavjud emas'
          '${reason == null ? '' : ': $reason'}'
          '. Xizmat turlarini ochish';
    }
    return '${option.label}, ${option.enabled ? 'yoqilgan' : "o'chirilgan"}. '
        'Xizmat turlarini ochish';
  }

  /// Talab xaritasiga o'tish.
  ///
  /// Nega aynan shu joyda: haydovchi smenani boshlashdan OLDIN "qayerga
  /// borsam?" degan savolga javob izlaydi — tugma onlayn/oflayn ikkala
  /// holatda ham, CTA'ning tepasida turadi.
  Widget _buildDemandMapLink() {
    return AppPressable(
      onTap: () => Navigator.of(context).pushNamed('/driver/demand'),
      semanticsLabel: "Talab xaritasi, qayerda buyurtma ko'pligini ko'rish",
      pressedScale: 0.98,
      minTapTarget: false,
      child: const AgSurfaceCard(
        padding: EdgeInsets.symmetric(
          horizontal: kSpace4,
          vertical: kSpace3,
        ),
        // Yorliqni `AppPressable` semantikasi allaqachon o'qiydi.
        child: ExcludeSemantics(
          child: Row(
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: kWarningLight,
                    borderRadius: BorderRadius.all(
                      Radius.circular(kRadiusSm),
                    ),
                  ),
                  child: Icon(
                    Icons.local_fire_department_rounded,
                    size: 22,
                    color: kWarningDeep,
                  ),
                ),
              ),
              SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Talab xaritasi',
                      style: TextStyle(
                        fontSize: kFontBodyLg,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                    Text(
                      "Qayerda buyurtma ko'p",
                      style: TextStyle(
                        fontSize: kFontCaption,
                        color: kInkMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              // `kInkSubtle` FAQAT ikonka uchun — yozuvda ishlatilmaydi.
              Icon(Icons.chevron_right_rounded, color: kInkSubtle),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------
  // FAOL BUYURTMA KARTASI.
  //
  // Bu holatda ekranning yagona savoli — "keyingi qadam nima?".
  // Shuning uchun ochish tugmasi endi narx yonidagi kichik tugma emas,
  // to'liq kenglikdagi `kControlHeightDriver` (64dp) asosiy amal:
  // haydovchi unga qaramasdan, barmoq xotirasi bilan tegadi.
  // O'tish MANTIG'I (`_navigateToActiveOrder`) o'zgarmagan.
  // --------------------------------------------------------------------
  Widget _buildActiveOrderCard(DriverProvider driverProvider) {
    final order = driverProvider.activeOrder!;
    // Buyurtma TURI kartaning sarlavhasi: haydovchi bosh ekranga
    // qaytganda ham nima olganini ("Ovqat yetkazish") ko'rib tursin.
    final wording = order.wording;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AgSurfaceCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      key: const ValueKey('active_order_service_type'),
                      children: [
                        ExcludeSemantics(
                          child: Icon(wording.icon, size: 18, color: kInkMuted),
                        ),
                        const SizedBox(width: kSpace2),
                        Flexible(
                          child: Text(
                            wording.typeLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: kFontBodyLg,
                              color: kInk,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: kSpace2),
                  // Ikonka + matn + rang — holat faqat rangda qolmaydi.
                  AppStatusBadge(
                    label: order.status.label,
                    tone: AppStatusTone.info,
                    dense: true,
                  ),
                ],
              ),
              const SizedBox(height: kSpace3),
              _buildOrderRouteRow(
                Icons.radio_button_checked,
                kPrimary,
                order.pickup.address,
              ),
              const SizedBox(height: kSpace1 + 2),
              _buildOrderRouteRow(
                Icons.location_on,
                kError,
                order.dropoff.address,
              ),
              // `AgSurfaceCard` OQ, shuning uchun ajratkich `kLine` —
              // `kSurface2` fonli sheetda emas, karta ICHIDA turadi.
              const Divider(height: kSpace4, color: kLine),
              // ⚠️ YORLIQ EGILADI, SUMMA EGILMAYDI. Ilgari qator qat'iy
              // ikki matndan iborat edi va uzun summa ("1 284 000 UZS")
              // yoki kattalashtirilgan tizim shrifti 320dp li telefonda
              // qatorni TOSHIRIB yuborardi. `Expanded` yorliqni avval
              // qisqartiradi; summa flekssiz qoladi — kesilgan narx
              // haydovchi uchun eng yomon xato.
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      "To'lov",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
                    ),
                  ),
                  const SizedBox(width: kSpace3),
                  // To'lov — haydovchining asosiy raqami, shuning uchun
                  // sarlavha o'lchamida (`kFontH2`), tana matnida emas.
                  Text(
                    Formatters.formatPrice(order.estimatedPrice),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: kFontH2,
                      color: kInk,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: kSpace3),
        AppButton(
          key: const ValueKey('driver_active_order_open'),
          label: 'Buyurtmani ochish',
          semanticsLabel: '${wording.typeLabel} buyurtmasini ochish',
          height: kControlHeightDriver,
          // To'q siyoh — bu DAVOM ETTIRISH, yangi smena boshlash emas
          // (yashil CTA aynan "boshlash" ma'nosini oldindan band qilgan).
          backgroundColor: kInk,
          onPressed: () => _navigateToActiveOrder(driverProvider),
        ),
      ],
    );
  }

  Widget _buildOrderRouteRow(IconData icon, Color color, String text) {
    return Row(
      children: [
        ExcludeSemantics(child: Icon(icon, color: color, size: 16)),
        const SizedBox(width: kSpace2),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: kFontLabel, color: kInk),
          ),
        ),
      ],
    );
  }

  void _navigateToActiveOrder(DriverProvider provider) {
    final order = provider.activeOrder;
    if (order == null) return;

    switch (order.status) {
      case OrderStatus.driverAssigned:
      case OrderStatus.driverEnRoute:
        Navigator.of(context).pushNamed('/driver/navigation');
      case OrderStatus.driverArrived:
        Navigator.of(context).pushNamed('/driver/arrived');
      case OrderStatus.inProgress:
        Navigator.of(context).pushNamed('/driver/trip');
      default:
        break;
    }
  }

  void _showMenu(
    BuildContext context,
    AuthProvider auth,
    DriverProvider driverProvider,
  ) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      // ⚠️ Ro'yxat AYLANADIGAN bo'lishi shart: modal sheet balandligi
      // ekranning yarmi bilan cheklangan va kichik telefonlarda oxirgi
      // element ("Chiqish") kesilib qolardi.
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: kSurface2,
                  child: Icon(Icons.person, color: kInk),
                ),
                title: Text(auth.currentUser?.displayName ?? 'Haydovchi'),
                subtitle: Text(auth.currentUser?.phone ?? ''),
              ),
              const Divider(),
              _buildMenuTile(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Daromad',
                onTap: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pushNamed('/driver/earnings');
                },
              ),
              _buildMenuTile(
                icon: Icons.person_outline,
                title: 'Profil',
                onTap: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pushNamed('/driver/profile');
                },
              ),
              // Tekshiruv menyudan HAR DOIM ochiladi — bloklangan holatdagi
              // banner yo'qolganda ham haydovchi hujjatlarini ko'ra olsin.
              _buildMenuTile(
                icon: Icons.verified_outlined,
                title: 'Tekshiruv',
                subtitle: driverProvider.verification.actionNeededCount > 0
                    ? Text(
                        '${driverProvider.verification.actionNeededCount} ta '
                        "e'tibor talab qiladi",
                        style: const TextStyle(
                          color: kWarningDeep,
                          fontSize: kFontCaption,
                          fontWeight: FontWeight.w700,
                        ),
                      )
                    : null,
                onTap: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pushNamed('/driver/verification');
                },
              ),
              // Kuryer rejimi — haydovchi qaysi turdagi buyurtmalarni
              // olishini shu yerdan boshqaradi.
              _buildMenuTile(
                key: const ValueKey('driver_menu_services'),
                icon: Icons.category_outlined,
                title: 'Xizmat turlari',
                subtitle: const Text(
                  "Qaysi buyurtmalarni olasiz",
                  style: TextStyle(fontSize: kFontCaption, color: kInkMuted),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pushNamed('/driver/services');
                },
              ),
              // ⚠️ Chiqish — BUZG'UNCHI amal. Yuqoridagi kundalik
              // qatorlardan `kSpace3` (12dp) bilan uziladi: aks holda
              // "Xizmat turlari" ni bosmoqchi bo'lgan barmoq mashina
              // tebranganda seansni yopib yuborardi.
              const SizedBox(height: kSpace3),
              _buildMenuTile(
                icon: Icons.logout,
                title: 'Chiqish',
                // Xavf MATNI `kErrorDeep` (6.47:1); `kError` faqat
                // chegara va to'ldirish uchun.
                foreground: kErrorDeep,
                onTap: () {
                  Navigator.of(ctx).pop();
                  auth.logout();
                },
              ),
              const SizedBox(height: kSpace2),
            ],
          ),
        ),
      ),
    );
  }

  /// Menyu qatori — haydovchi nishoni `kMinTapTargetDriver` (56dp).
  ///
  /// Material'ning standart 48dp qatori bu yerda yetarli emas: menyu
  /// mashina to'xtab turganda ham, harakatda ham ochiladi. Balandlik
  /// QAT'IY emas, MINIMAL — tizim shrifti kattalashtirilganda qator
  /// o'sishga haqli va yozuv kesilmaydi.
  Widget _buildMenuTile({
    Key? key,
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? subtitle,
    Color foreground = kInk,
  }) {
    return ListTile(
      key: key,
      minVerticalPadding: kSpace3,
      minTileHeight: kMinTapTargetDriver,
      leading: Icon(icon, color: foreground),
      title: Text(
        title,
        style: TextStyle(
          color: foreground,
          fontSize: kFontBodyLg,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: subtitle,
      onTap: onTap,
    );
  }
}
