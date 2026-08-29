import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_action_row.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:angren_taxi/shared/widgets/waiting_charge_ticker.dart';
import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:latlong2/latlong.dart';
// Xarita kamerasi MapLibre'ning o'z LatLng turini kutadi; ilovaning qolgan
// qismi latlong2 ni ishlatadi, shuning uchun bu yerda prefiks bilan.
import 'package:maplibre_gl/maplibre_gl.dart' as ml
    show MapLibreMapController, CameraUpdate, LatLng, LatLngBounds;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

// ============================================================================
// FAOL SAFAR KO'RINISHI.
//
// ⚠️ NEGA ALOHIDA FAYL. Bu klaster ilgari `home_screen.dart` ichida yashardi
// va o'sha faylni 1200+ qatorga cho'zib yuborgan edi. Bosh ekranda ikki
// mustaqil rejim bor: QIDIRUV (manzil tanlash) va FAOL SAFAR (kuzatuv).
// Ular bir-biriga hech narsa bermaydi — na holat, na yordamchi. Bitta faylda
// turgani uchun esa har ikkalasini o'qish uchun ikkinchisini ham varaqlash
// kerak bo'lardi va SOS oqimi (xavfsizlik funksiyasi) favoritlar bilan bir
// joyda yotardi.
//
// ⚠️ MANTIQ O'ZGARMAGAN. Bu ko'chirish: SOS oqimi, ETA hisobi, bekor qilish
// sababi, chat va qo'ng'iroq — hammasi bir xilligicha qoldi. O'zgargani
// faqat KOMPOZITSIYA (qatlamli yuza, amal qatori) va kamera paddingi.
//
// Holat va yon ta'sirlar tashqaridan beriladi (`onCancel`, `sosService`,
// `driverLocation`), shuning uchun bu ko'rinish `OrderProvider` ni bilmaydi
// va uni testda soxta provider'siz ham qurish mumkin.
// ============================================================================

/// Faol buyurtma kuzatuvi: xarita + qatlamli sheet.
///
/// ```dart
/// ActiveOrderView(
///   order: orderProvider.activeOrder!,
///   driverLocation: orderProvider.driverLocationListenable,
///   isBusy: orderProvider.state == OrderProviderState.loading,
///   onCancel: (reason) => orderProvider.cancelOrder(reason: reason),
///   sosService: sosService,
///   fallbackLocation: currentLocation,
///   topBar: buildTopBar(),
/// )
/// ```
class ActiveOrderView extends StatefulWidget {
  const ActiveOrderView({
    super.key,
    required this.order,
    required this.driverLocation,
    required this.isBusy,
    required this.onCancel,
    required this.sosService,
    required this.fallbackLocation,
    this.topBar,
  });

  final Order order;

  /// Haydovchi joylashuvi alohida kanal orqali keladi: uni `ValueListenable`
  /// sifatida olamiz, shunda har yangilanishda butun ko'rinish emas, faqat
  /// xarita qatlami qayta quriladi.
  final ValueListenable<LatLng?> driverLocation;

  /// Buyurtma ustida so'rov uchayapti — bekor qilish tugmasi shu paytda
  /// bosilmaydi (ikki marta bekor qilish so'rovi yuborilmasligi uchun).
  final bool isBusy;

  /// Bekor qilish tasdiqlangandan keyin chaqiriladi. Sabab `null` bo'lishi
  /// mumkin (foydalanuvchi "Boshqa sabab" ni bo'sh qoldirgan).
  final void Function(String? reason) onCancel;

  /// Injectable for tests. `null` bo'lsa xizmat KERAK BO'LGANDA
  /// (SOS bosilganda) service locator'dan quriladi.
  ///
  /// ⚠️ Dangasa qurish ATAYLAB: `build` paytida qurilsa, SOS umuman
  /// ishlatilmaydigan testlarda ham `ApiClient` ro'yxatdan o'tgan bo'lishi
  /// talab qilinardi va bekor qilish testi shu sababdan yiqilardi.
  final SosService? sosService;

  /// SOS xabarida ishlatiladigan zaxira koordinata — jonli fiks olinmasa
  /// shu yuboriladi (bosh ekran allaqachon bilgan eng yaxshi taxmin).
  final LatLng fallbackLocation;

  /// Xarita ustidagi yuqori panel. Bosh ekranda qoladi, chunki u menyu va
  /// `AuthProvider` bilan ishlaydi — bu ko'rinishning ishi emas.
  final Widget? topBar;

  @override
  State<ActiveOrderView> createState() => _ActiveOrderViewState();
}

class _ActiveOrderViewState extends State<ActiveOrderView> {
  SosService get _sosService =>
      widget.sosService ?? SosService(apiClient: sl<ApiClient>());

  /// Sheet kontentining balandligini o'lchash uchun. Kamera paddingi shundan
  /// hisoblanadi — `map_camera_insets.dart` dagi izohga qarang.
  final GlobalKey _panelContentKey = GlobalKey();

  ml.MapLibreMapController? _mapController;

  /// Oxirgi o'lchangan sheet kontenti balandligi. Faqat kameraga ta'sir
  /// qiladi, vidjet daraxtiga emas — shuning uchun `setState` chaqirilmaydi.
  double? _panelContentHeight;

  @override
  Widget build(BuildContext context) {
    // Sheet balandligi kontentga qarab o'zgaradi (haydovchi tayinlandi,
    // ETA banneri chiqdi, bekor qilish tugmasi yo'qoldi), kamera esa shu
    // balandlikka bog'liq. Har kadrdan keyin o'lchaymiz va O'ZGARGANDA
    // kamerani qayta moslaymiz.
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncPanelHeight());

    return Stack(
      children: [
        _buildTrackingMap(),
        if (widget.topBar != null) widget.topBar!,
        _buildBottomCard(),
      ],
    );
  }

  void _syncPanelHeight() {
    if (!mounted) return;
    final renderObject = _panelContentKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) return;

    final height = renderObject.size.height;
    // 1dp dan kichik farq kameraga sezilmaydi — har kadrda kamerani
    // qo'zg'atmaslik uchun shu chegara.
    if (_panelContentHeight != null &&
        (_panelContentHeight! - height).abs() < 1) {
      return;
    }
    _panelContentHeight = height;
    _fitCamera();
  }

  void _onMapCreated(ml.MapLibreMapController controller) {
    _mapController = controller;
    _fitCamera();
  }

  /// Marshrut uchlarini OCHIQ maydonga (sheet ostida qolmagan qismga)
  /// moslaydi.
  ///
  /// `AppVectorMap.fitToContent` ATAYLAB ishlatilmaydi: u paddingni
  /// ichkarida qat'iy saqlaydi va sheet balandligini bilmaydi. Nuqtalar
  /// to'plami esa o'sha kodnikiga aynan teng (olish + tushish markerlari),
  /// ya'ni o'zgargani faqat chetlar.
  void _fitCamera() {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    final points = <LatLng>[
      LatLng(widget.order.pickup.lat, widget.order.pickup.lng),
      LatLng(widget.order.dropoff.lat, widget.order.dropoff.lng),
    ];

    var minLat = points.first.latitude, maxLat = minLat;
    var minLng = points.first.longitude, maxLng = minLng;
    for (final p in points) {
      minLat = p.latitude < minLat ? p.latitude : minLat;
      maxLat = p.latitude > maxLat ? p.latitude : maxLat;
      minLng = p.longitude < minLng ? p.longitude : minLng;
      maxLng = p.longitude > maxLng ? p.longitude : maxLng;
    }

    final insets = MapCameraInsets.forPanel(
      context,
      panelContentHeight: _panelContentHeight,
    );

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

  Widget _buildTrackingMap() {
    final markers = <AppMapMarker>[
      AppMapMarker(
        point: LatLng(widget.order.pickup.lat, widget.order.pickup.lng),
        icon: AppMapIcon.pickup,
      ),
      AppMapMarker(
        point: LatLng(widget.order.dropoff.lat, widget.order.dropoff.lng),
        icon: AppMapIcon.dropoff,
      ),
    ];

    return ValueListenableBuilder<LatLng?>(
      valueListenable: widget.driverLocation,
      builder: (context, driverLocation, _) {
        return AppVectorMap(
          initialCenter:
              LatLng(widget.order.pickup.lat, widget.order.pickup.lng),
          initialZoom: 14,
          markers: markers,
          // Haydovchi markeri alohida: xarita uni ichkarida interpolyatsiya
          // qiladi, shuning uchun mashina sakramaydi va yo'nalish bo'yicha
          // buriladi. Vidjet daraxti bunda qayta qurilmaydi.
          carLocation: driverLocation,
          // Kamerani O'ZIMIZ boshqaramiz — `_fitCamera` izohiga qarang.
          fitToContent: false,
          onMapCreated: _onMapCreated,
        );
      },
    );
  }

  // --------------------------------------------------------------------
  // QATLAMLI SHEET
  //
  // Panel foni `kSurface2` (`layered: true`), ichidagi bloklar esa oq
  // `AgSurfaceCard`. Chuqurlik ikki yuza FARQIDAN keladi, chegaradan emas —
  // shuning uchun kartalar chegarasiz. Ikkalasi birga ishlatilishi SHART:
  // oq panel ustidagi oq karta ajralmaydi.
  // --------------------------------------------------------------------
  Widget _buildBottomCard() {
    final order = widget.order;

    return AdaptiveMapPanel(
      layered: true,
      child: Column(
        key: _panelContentKey,
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Holat nishoni qisqarishi mumkin, SOS tugmasi esa YO'Q —
              // u qat'iy 48dp tegish maydoniga ega bo'lishi shart.
              // (Tor yon panelda — 360dp — bu qator toshib ketardi.)
              Flexible(child: _buildStatusChip(order.status)),
              const SizedBox(width: kSpace2),
              _buildSosButton(order),
            ],
          ),
          _buildEtaBanner(order),
          // ⚠️ ETA BANNERI O'RNIGA TUSHADI. Haydovchi yetib kelgach ETA
          // yo'qoladi (sanaydigan narsa qolmaydi) va aynan o'sha joyda
          // kutish bloki paydo bo'ladi — yo'lovchining ko'zi allaqachon
          // shu nuqtada.
          _buildWaitingBlock(order),
          const SizedBox(height: kSpace3),
          if (order.driver != null) ...[
            AgSurfaceCard(child: _buildDriverInfo(order)),
            const SizedBox(height: kSpace2),
          ],
          AgSurfaceCard(
            padding: const EdgeInsets.all(kSpace3),
            child: _buildRouteInfo(order),
          ),
          const SizedBox(height: kSpace3),
          _buildActions(order),
        ],
      ),
    );
  }

  /// Safar holati faqat RANG bilan berilmaydi — `AppStatusBadge` ikonka,
  /// matn va rangni birga tashiydi (WCAG 1.4.1).
  Widget _buildStatusChip(OrderStatus status) {
    final tone = switch (status) {
      OrderStatus.searching => AppStatusTone.warning,
      OrderStatus.driverAssigned ||
      OrderStatus.driverEnRoute =>
        AppStatusTone.info,
      OrderStatus.driverArrived ||
      OrderStatus.inProgress ||
      OrderStatus.completed =>
        AppStatusTone.success,
      OrderStatus.cancelled => AppStatusTone.danger,
      _ => AppStatusTone.neutral,
    };
    return Align(
      alignment: Alignment.centerLeft,
      child: AppStatusBadge(label: status.label, tone: tone),
    );
  }

  // --------------------------------------------------------------------
  // AMALLAR
  //
  // Ilgari qo'ng'iroq va chat haydovchi kartasining ichida kichik ikonka
  // tugmalar edi, bekor qilish esa to'liq kenglikdagi QIZIL tugma — ya'ni
  // eng buzg'unchi amal ekrandagi eng og'ir element bo'lib turardi.
  //
  // Endi to'rttasi ham bir xil vaznda, teng kenglikda: bu "bularning
  // hammasi bir darajadagi ikkilamchi tanlov" degan ma'noni kompozitsiya
  // orqali beradi. Bekor qilish oxirgi o'rinda va `destructive` — u
  // qo'ng'iroq bilan yonma-yon TURMAYDI (`AgActionRow` hujjatidagi
  // ogohlantirish).
  //
  // Amal mavjud bo'lmasa tugma yo'qolmaydi, `onTap: null` bo'ladi: qator
  // elementlari joyini o'zgartirsa foydalanuvchi mushak xotirasiga tayanib
  // noto'g'ri tugmani bosardi.
  // --------------------------------------------------------------------
  Widget _buildActions(Order order) {
    final driver = order.driver;
    // Bekor qilish shartlari o'zgarmagan: haydovchi izlanayotganda yoki
    // endi tayinlanganda. So'rov uchayotganda tugma vaqtincha o'chadi.
    final canCancel = !widget.isBusy &&
        (order.status == OrderStatus.searching ||
            order.status == OrderStatus.driverAssigned);

    return AgActionRow(
      items: [
        AgActionItem(
          icon: Icons.phone_rounded,
          label: "Qo'ng'iroq",
          onTap: driver == null || driver.phone.isEmpty
              ? null
              : () => _callDriver(driver.phone),
        ),
        AgActionItem(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Xabar',
          onTap: driver == null ? null : () => _openChat(order),
        ),
        AgActionItem(
          icon: Icons.ios_share_rounded,
          label: 'Ulashish',
          onTap: () => _shareTrip(order),
        ),
        AgActionItem(
          icon: Icons.close_rounded,
          label: 'Bekor qilish',
          destructive: true,
          onTap: canCancel ? _confirmCancel : null,
        ),
      ],
    );
  }

  /// Small red circular SOS button shown in the active-order status row.
  /// Opens [_showSosSheet] with emergency-call and dispatcher-alert options.
  Widget _buildSosButton(Order order) {
    return Semantics(
      button: true,
      label: 'SOS — favqulodda yordam',
      excludeSemantics: true,
      child: AppPressable(
        haptic: AppHapticLevel.none,
        pressedScale: 0.92,
        minTapTarget: false,
        onTap: () {
          // Xavfsizlik harakati — boshqa tugmalardan farqli, aniqroq javob.
          AppHaptics.warning();
          _showSosSheet(order);
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: kError,
                shape: BoxShape.circle,
                // Qizil "halo" — kShadowCta yashil, bu yerga mos emas.
                boxShadow: [
                  BoxShadow(
                    color: kError.withValues(alpha: 0.4),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.sos_rounded, color: kOnPrimary, size: 20),
            ),
          ),
        ),
      ),
    );
  }

  // Emergency services number (Uzbekistan combined police/fire line). The
  // sheet also mentions 103 (ambulance) in its label, but tel: only accepts
  // a single number to dial.
  static const String _emergencyPhoneNumber = '102';

  Future<void> _callEmergency() async {
    final uri = Uri(scheme: 'tel', path: _emergencyPhoneNumber);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Qo'ng'iroq qilib bo'lmadi")),
      );
    }
  }

  Future<void> _alertDispatchers(String orderId) async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    final lat = position?.latitude ?? widget.fallbackLocation.latitude;
    final lng = position?.longitude ?? widget.fallbackLocation.longitude;
    try {
      await _sosService.reportSos(orderId: orderId, lat: lat, lng: lng);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispetcherlarga xabar yuborildi'),
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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding:
              const EdgeInsets.fromLTRB(kSpace5, kSpace5, kSpace5, kSpace6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Favqulodda yordam',
                style: TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace1 + 2),
              const Text(
                "Xavfsizligingiz biz uchun muhim. Kerak bo'lsa, quyidagi "
                'tugmalardan birini bosing.',
                style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
              ),
              const SizedBox(height: kSpace5),
              AppButton(
                label: 'Favqulodda chaqiruv (102/103)',
                backgroundColor: kError,
                foregroundColor: kOnPrimary,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _callEmergency();
                },
              ),
              const SizedBox(height: kSpace3),
              AppButton(
                label: 'Dispetcherlarga xabar berish',
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _alertDispatchers(order.id);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Rough ETA (in minutes) from the driver's live location to the pickup
  /// point, assuming an average city driving speed of 25 km/h. Only
  /// meaningful before the driver has arrived — once `driverArrived` (or
  /// later), there's nothing left to count down to.
  static const double _averageCitySpeedKmh = 25;

  int? _etaMinutesToPickup(Order order) {
    if (order.status != OrderStatus.driverAssigned &&
        order.status != OrderStatus.driverEnRoute) {
      return null;
    }
    final driverLocation = widget.driverLocation.value;
    if (driverLocation == null) return null;

    const distanceCalculator = Distance();
    final distanceKm = distanceCalculator.as(
      LengthUnit.Kilometer,
      driverLocation,
      LatLng(order.pickup.lat, order.pickup.lng),
    );
    final minutes = (distanceKm / _averageCitySpeedKmh) * 60;
    return minutes.round();
  }

  /// ⚠️ ETA O'ZI OBUNA BO'LADI. Haydovchi joylashuvi `notifyListeners()`
  /// CHAQIRMAYDI — `OrderProvider._setDriverLocation` faqat
  /// `driverLocationListenable` ni yangilaydi (ataylab: har ping butun
  /// ekranni, xarita bilan birga, qayta qurmasligi uchun). Shuning uchun
  /// banner ham o'sha kanalga obuna bo'lishi SHART; aks holda "5 daqiqada
  /// yetib keladi" haydovchi yaqinlashsa ham qotib turardi va faqat
  /// holat o'zgarganda (masalan "yetib keldi") yangilanardi.
  Widget _buildEtaBanner(Order order) {
    return ValueListenableBuilder<LatLng?>(
      valueListenable: widget.driverLocation,
      builder: (context, _, __) {
        // Banner paydo bo'lganda/yo'qolganda sheet balandligi o'zgaradi,
        // kamera paddingi esa shundan hisoblanadi — qayta o'lchaymiz.
        // (`_syncPanelHeight` balandlik o'zgarmagan bo'lsa hech narsa
        // qilmaydi, ya'ni har ping kamerani qo'zg'atmaydi.)
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _syncPanelHeight());
        return _buildEtaContent(order);
      },
    );
  }

  Widget _buildEtaContent(Order order) {
    final etaMinutes = _etaMinutesToPickup(order);
    if (etaMinutes == null) return const SizedBox.shrink();

    final text = etaMinutes < 1
        ? 'Haydovchi deyarli yetib keldi'
        : 'Haydovchi $etaMinutes daqiqada yetib keladi';

    return Padding(
      padding: const EdgeInsets.only(top: kSpace2),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: kSpace3, vertical: kSpace2),
          decoration: BoxDecoration(
            // Mint tinted yuza — ustidagi matn/ikona kPrimary (5.38:1).
            color: kMintTint,
            borderRadius: BorderRadius.circular(kRadiusSm),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ExcludeSemantics(
                child:
                    Icon(Icons.access_time_rounded, size: 16, color: kPrimary),
              ),
              const SizedBox(width: kSpace1 + 2),
              Flexible(
                child: Text(
                  text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontLabel,
                    color: kPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------
  // KUTISH BLOKI — YO'LOVCHI TOMONI.
  //
  // ⚠️ NEGA UMUMAN BOR. Kutish haqi yo'lovchi ilovasida UMUMAN
  // ko'rsatilmasdi: hisoblagich faqat haydovchi ekranida, lokal edi.
  // Endi kutish PUL undiradi, ya'ni ko'rinmay yig'ilgan summa chekda
  // paydo bo'lardi — bu toifadagi eng nizoli raqam va unga albatta
  // e'tiroz bildirilardi.
  //
  // ⚠️ HAYDOVCHI BILAN BIR XIL RAQAM. Ikkalasi ham `order.arrivedAt` dan
  // (SERVER vaqti) hisoblaydi, o'z soatidan emas, va yaxlitlash ham
  // bir xil — har BOSHLANGAN daqiqa to'liq
  // (lib/shared/utils/waiting_charge.dart). Ikki ekranda ikki xil son
  // chiqishi hisoblagichni butunlay ishonchsiz qilib qo'yardi.
  //
  // ⚠️ "SAFAR NARXIGA QO'SHILADI" — MAJBURIY JUMLA. Yo'lovchiga
  // buyurtma berayotganda qat'iy narx ko'rsatilgan; kutish esa o'sha
  // kafolatdan TASHQARIDA (backend `waiting-charge.ts`). Agar blok buni
  // aytmasa, yo'lovchi yig'ilayotgan summani "shunchaki ma'lumot" deb
  // o'qib, chekda uni ko'rganda aldanganday his qilardi.
  // --------------------------------------------------------------------
  Widget _buildWaitingBlock(Order order) {
    // Kutish oynasi FAQAT "yetib keldi" holatida ochiq. Safar boshlangach
    // (`inProgress`) hisoblagich TO'XTAYDI: undan keyingi vaqt server
    // tomonda `timeFare` ga o'tadi, ya'ni ikki marta undirilmaydi.
    if (order.status != OrderStatus.driverArrived) {
      return const SizedBox.shrink();
    }
    // `arrivedAt` yo'q — eski buyurtma yoki soket paketi hali yetib
    // kelmagan. Hisoblagich UMUMAN ko'rsatilmaydi; nol turgan hisoblagich
    // "kutish boshlandi" degan yolg'on ma'no berardi.
    if (order.arrivedAt == null) return const SizedBox.shrink();

    return WaitingChargeTicker(
      arrivedAt: order.arrivedAt,
      freeWaitMinutes: order.freeWaitMinutes,
      waitingPricePerMinute: order.waitingPricePerMinute,
      builder: (context, charge) {
        // Blok paydo bo'lganda va bepul→hisoblanmoqda o'tishida sheet
        // balandligi o'zgaradi, kamera paddingi esa shundan hisoblanadi.
        // (`_syncPanelHeight` balandlik o'zgarmagan bo'lsa hech narsa
        // qilmaydi, ya'ni har soniya kamerani qo'zg'atmaydi.)
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _syncPanelHeight());
        return _buildWaitingContent(order, charge);
      },
    );
  }

  Widget _buildWaitingContent(Order order, WaitingCharge charge) {
    final perMinute = Formatters.formatSom(
      order.waitingPricePerMinute.toDouble(),
    );

    final billing = charge.isBilling;
    final headline = billing
        ? '+${Formatters.formatSom(charge.fare.toDouble())}'
        : formatWaitClock(charge.freeRemaining);
    final title = billing ? 'Kutish haqi' : 'Bepul kutish';
    final caption = billing
        ? "Jami ${formatWaitElapsed(charge.elapsed)} · safar narxiga qo'shiladi"
        : "Keyin $perMinute/daqiqa, safar narxiga qo'shiladi";

    final accent = billing ? kWarningDeep : kPrimary;

    final semanticsLabel = billing
        ? 'Kutish haqi ${Formatters.formatSom(charge.fare.toDouble())}, '
            'jami ${formatWaitElapsed(charge.elapsed)} kutildi. '
            "Safar narxiga qo'shiladi."
        : 'Bepul kutish tugashiga ${formatWaitClock(charge.freeRemaining)} '
            "qoldi, keyin har daqiqa uchun $perMinute safar narxiga "
            "qo'shiladi";

    return Padding(
      padding: const EdgeInsets.only(top: kSpace2),
      child: Semantics(
        label: semanticsLabel,
        // Raqam sekundiga o'zgaradi — jonli soha bo'lsa ekran o'quvchi uni
        // har soniyada qayta o'qib, qolgan hamma narsani bosib ketardi.
        liveRegion: false,
        excludeSemantics: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: kSpace3,
            vertical: kSpace3,
          ),
          decoration: BoxDecoration(
            // Mint tint ustida kPrimary 5.38:1, amber tint ustida
            // kWarningDeep ~4.9:1 — ikkalasi ham AA.
            color: billing ? kWarningLight : kMintTint,
            borderRadius: BorderRadius.circular(kRadiusSm),
            // Holat FAQAT rang bilan berilmaydi (WCAG 1.4.1): fon, ikona,
            // yorliq matni va raqam turi (soat → pul) birga o'zgaradi.
            // Chegara — to'rtinchi belgi.
            border: billing ? Border.all(color: kWarning) : null,
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  billing ? Icons.timer : Icons.timer_outlined,
                  size: 18,
                  color: accent,
                ),
              ),
              const SizedBox(width: kSpace2),
              // ⚠️ MATN EGILADI, SUMMA EGILMAYDI: uzun summa yoki
              // kattalashtirilgan tizim shrifti bilan qator toshmasligi
              // uchun avval yorliq qisqaradi. Kesilgan PUL raqami — bu
              // blokdagi eng yomon xato.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: kFontLabel,
                        color: accent,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      caption,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: kFontMicro,
                        // `kInkSubtle` EMAS — yozuvda AA'dan past.
                        color: kInkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: kSpace3),
              Text(
                headline,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontH2,
                  color: kInk,
                  // Raqam sekundiga o'zgaradi; qat'iy balandlik qatorning
                  // "sakrashini" oldini oladi.
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _callDriver(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Qo'ng'iroq qilib bo'lmadi")),
      );
    }
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

  /// Safar ma'lumotini yaqin kishiga yuborish uchun buferga nusxalaydi.
  ///
  /// ⚠️ NEGA TIZIM "SHARE" OYNASI EMAS: `share_plus` loyihada yo'q va uni
  /// qo'shish bu vazifaning doirasidan tashqarida. Xuddi shu yechim
  /// `referral_screen.dart` da ham qo'llangan — ikkalasi bir xil xatti
  /// harakat qilsin. Paket qo'shilganda faqat shu metod almashadi.
  Future<void> _shareTrip(Order order) async {
    final driver = order.driver;
    final lines = <String>[
      'Angren Taxi — safarim',
      "Qayerdan: ${order.pickup.address}",
      'Qayerga: ${order.dropoff.address}',
      if (driver != null) 'Haydovchi: ${driver.name}, ${driver.carInfo}',
      'Holat: ${order.status.label}',
    ];
    await Clipboard.setData(ClipboardData(text: lines.join('\n')));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Safar ma'lumoti nusxalandi")),
    );
  }

  Widget _buildDriverInfo(Order order) {
    final driver = order.driver!;
    return Row(
      children: [
        // ATAYLAB SAQLANADI: haydovchi avatarining mint gradient halqasi —
        // sof dekorativ, ma'no tashimaydi.
        const ExcludeSemantics(
          child: Padding(
            padding: EdgeInsets.all(2.5),
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: kGradientMint,
              ),
              child: CircleAvatar(
                radius: 24,
                backgroundColor: kSurface,
                child: Icon(Icons.person_rounded, color: kPrimary, size: 26),
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
                driver.name,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: kFontTitle,
                  color: kInk,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                driver.carInfo,
                style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
              ),
              const SizedBox(height: kSpace1),
              Row(
                children: [
                  const ExcludeSemantics(
                    child:
                        Icon(Icons.star_rounded, color: kWarningDeep, size: 16),
                  ),
                  const SizedBox(width: kSpace1),
                  Text(
                    Formatters.formatRating(driver.rating),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: kFontLabel,
                      color: kInk,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        // Qo'ng'iroq va chat tugmalari bu kartadan CHIQARILDI — ular endi
        // pastdagi `AgActionRow` da yashaydi. Ikki joyda takrorlansa
        // foydalanuvchi qaysi biri "asl" ekanini o'ylab qolardi.
      ],
    );
  }

  Widget _buildRouteInfo(Order order) {
    return Column(
      children: [
        Row(
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.location_on, color: kPrimary, size: 18),
            ),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Text(
                order.pickup.address,
                style: const TextStyle(fontSize: kFontLabel, color: kInk),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: kSpace1),
        Row(
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.flag, color: kError, size: 18),
            ),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Text(
                order.dropoff.address,
                style: const TextStyle(fontSize: kFontLabel, color: kInk),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              Formatters.formatPrice(order.estimatedPrice),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
          ],
        ),
      ],
    );
  }

  static const List<String> _cancelReasons = [
    'Juda uzoq kutdim',
    "Fikrimni o'zgartirdim",
    'Narx juda qimmat',
    'Boshqa sabab',
  ];
  static const String _otherCancelReason = 'Boshqa sabab';

  void _confirmCancel() {
    String selectedReason = _cancelReasons.first;
    final customReasonController = TextEditingController();

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return AlertDialog(
            title: const Text('Bekor qilish sababi'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Buyurtmani bekor qilish sababini tanlang:',
                    style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
                  ),
                  for (final reason in _cancelReasons)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: reason,
                      groupValue: selectedReason,
                      title: Text(reason),
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => selectedReason = value);
                        }
                      },
                    ),
                  if (selectedReason == _otherCancelReason)
                    Padding(
                      padding:
                          const EdgeInsets.only(top: kSpace1, bottom: kSpace1),
                      child: TextField(
                        controller: customReasonController,
                        autofocus: true,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          hintText: 'Sababni yozing...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text("Yo'q"),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  final reason = selectedReason == _otherCancelReason
                      ? customReasonController.text.trim()
                      : selectedReason;
                  widget.onCancel(reason.isEmpty ? null : reason);
                },
                child: const Text(
                  'Ha, bekor qilish',
                  style: TextStyle(color: kErrorDeep),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
