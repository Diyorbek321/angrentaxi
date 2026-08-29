import 'dart:async';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class OrderOfferScreen extends StatefulWidget {
  const OrderOfferScreen({super.key});

  @override
  State<OrderOfferScreen> createState() => _OrderOfferScreenState();
}

class _OrderOfferScreenState extends State<OrderOfferScreen>
    with SingleTickerProviderStateMixin {
  Timer? _timer;
  int _secondsLeft = 0;
  late AnimationController _progressController;
  double? _distanceToPickup;

  @override
  void initState() {
    super.initState();
    _secondsLeft = AppConfig.orderOfferTimeout.inSeconds;

    _progressController = AnimationController(
      vsync: this,
      duration: AppConfig.orderOfferTimeout,
    )..forward();

    // Buyurtma taklifi keldi — haydovchi telefonga qaramayotgan bo'lishi
    // mumkin (yo'lda, cho'ntakda). Bu ilovadagi eng kuchli haptik signal
    // bo'lishi kerak, chunki taklif vaqt bilan chegaralangan.
    AppHaptics.heavy();

    _startCountdown();
    _calculateDistance();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _progressController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 0) {
        timer.cancel();
        if (mounted) _autoDecline();
        return;
      }
      if (mounted) {
        setState(() => _secondsLeft--);
        // Oxirgi 5 soniyada har soniyada yengil "tik" — vaqt tugayotgani
        // ekranga qaramasdan ham seziladi.
        if (_secondsLeft <= 5 && _secondsLeft > 0) AppHaptics.select();
      }
    });
  }

  Future<void> _calculateDistance() async {
    final provider = context.read<DriverProvider>();
    final offer = provider.pendingOffer;
    if (offer == null) return;

    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      final dist = locationService.calculateDistance(
        position.latitude,
        position.longitude,
        offer.pickup.lat,
        offer.pickup.lng,
      );
      setState(() => _distanceToPickup = dist);
    }
  }

  /// Vaqt tugadi — JIMGINA rad etiladi.
  ///
  /// ⚠️ Bu yerga modal, dialog yoki snackbar QO'SHMANG. Taklif muddati
  /// tugaganda haydovchi ko'pincha yo'lga qarab turadi; "kechikdingiz"
  /// degan ekran — jazo, va uni yopish uchun yana bir teginish talab
  /// qilinadi. Ekran shunchaki yopiladi, haydovchi bosh ekranga qaytadi.
  void _autoDecline() {
    final provider = context.read<DriverProvider>();
    final offer = provider.pendingOffer;
    if (offer != null) {
      provider.declineOrder(offer.id);
    }
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _onAccept(Order offer) async {
    _timer?.cancel();
    final provider = context.read<DriverProvider>();
    await provider.acceptOrder(offer.id);

    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      AppHaptics.success();
      Navigator.of(context).pushReplacementNamed('/driver/navigation');
    } else {
      AppHaptics.error();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(provider.error ?? 'Buyurtmani qabul qilib bo\'lmadi')),
      );
    }
  }

  Future<void> _onDecline(Order offer) async {
    _timer?.cancel();
    final provider = context.read<DriverProvider>();
    await provider.declineOrder(offer.id);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DriverProvider>(
      builder: (context, provider, _) {
        final offer = provider.pendingOffer;
        if (offer == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.of(context).pop();
          });
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        // ⚠️ Butun ekran matni SHU YERDAN: haydovchi nima qabul
        // qilayotganini (taksi? ovqat?) bilishi shart.
        final wording = offer.wording;

        return Scaffold(
          backgroundColor: kInk,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(wording),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(kRadiusXl),
                      ),
                    ),
                    // ⚠️ XAVFSIZLIK: amallar SKROLLDAN TASHQARIDA, pastga
                    // MIXLANGAN.
                    //
                    // Avval butun tarkib (taymer + to'lov + marshrut +
                    // tugmalar) bitta `SingleChildScrollView` ichida edi.
                    // 360×640 ekranda — ya'ni arzon Android telefonda, aynan
                    // haydovchilarning ko'pchiligida — tarkib balandligi 878dp
                    // chiqardi va "Qabul qilish" ekran chekkasidan 238dp PASTDA
                    // qolardi. Ya'ni vaqti chegaralangan taklifni qabul qilish
                    // uchun haydovchi avval SKROLL qilishi kerak edi: eng
                    // muhim nishon ko'rinmas, taymer esa sanayotgan bo'lardi.
                    //
                    // Endi qaror MA'LUMOTI suriladi (taymer → to'lov →
                    // marshrut), qaror AMALLARI esa har qanday ekranda,
                    // skrollning har qanday holatida joyida turadi.
                    child: Column(
                      children: [
                        Expanded(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(kSpace4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildCountdownTimer(),
                                const SizedBox(height: kSpace6),
                                _buildPriceCard(offer),
                                const SizedBox(height: kSpace5),
                                _buildRouteInfo(offer, wording),
                              ],
                            ),
                          ),
                        ),
                        // Tarkib mixlangan panel ostida kesiladi — bu BEZAK
                        // ajratkichi kesilish chizig'ini ko'rsatadi, shuning
                        // uchun `kLine` (interaktiv emas).
                        const Divider(height: 1, thickness: 1, color: kLine),
                        Padding(
                          padding: const EdgeInsets.all(kSpace4),
                          child: _buildActionButtons(offer, provider),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Buyurtma TURI birinchi ko'rinadigan narsa: haydovchi 60 soniya ichida
  /// qaror qiladi va "taksi deb o'ylab ovqat oldim" holati bo'lmasligi
  /// kerak. Ikonka yolg'iz qolmaydi — yonida [DriverServiceWording.typeLabel].
  Widget _buildHeader(DriverServiceWording wording) {
    return Padding(
      padding: const EdgeInsets.all(kSpace5),
      child: Column(
        children: [
          // Mint TO'LDIRISH — ustida faqat ink ikona (7.84:1), oq emas.
          ExcludeSemantics(
            child: SizedBox(
              width: 56,
              height: 56,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: kMint,
                  shape: BoxShape.circle,
                ),
                child: Icon(wording.icon, color: kOnMint, size: 28),
              ),
            ),
          ),
          const SizedBox(height: kSpace2),
          const Text(
            'Yangi buyurtma!',
            style: TextStyle(
              color: kOnPrimary,
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: kSpace2),
          Container(
            key: const ValueKey('offer_service_type'),
            padding: const EdgeInsets.symmetric(
              horizontal: kSpace3,
              vertical: kSpace1 + 2,
            ),
            decoration: BoxDecoration(
              // To'q fon ustida oq matn — 15:1 dan yuqori.
              color: kOnPrimary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(kRadiusFull),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ExcludeSemantics(
                  child: Icon(wording.icon, color: kOnPrimary, size: 16),
                ),
                const SizedBox(width: kSpace1 + 2),
                Text(
                  wording.typeLabel,
                  style: const TextStyle(
                    color: kOnPrimary,
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Taymerning DOMINANT signali — HALQA, raqam emas.
  ///
  /// Shakl bir qarashda idrok qilinadi, raqam esa O'QILADI: harakatdagi
  /// avtomobilda o'qishga vaqt yo'q. Avval markazdagi son kFontDisplay
  /// (30) edi — ya'ni ekrandagi eng katta element sanoq raqami bo'lib,
  /// TO'LOV bilan raqobatlashardi. Endi son yorliq o'lchamida, halqa
  /// chizig'i esa qalinlashtirildi (5 → 8) — masofadan ko'rinadigan
  /// yagona narsa halqaning qanchasi qolgani.
  ///
  /// Halqa + son ExcludeSemantics ichida: ekran o'quvchi pastdagi to'liq
  /// jumlani o'qiydi, "45" ni ikki marta emas.
  Widget _buildCountdownTimer() {
    // Oxirgi 5 soniya — shoshilinch holat (haptik "tik" bilan bir xil chegara).
    final isUrgent = _secondsLeft <= 5;
    // Ota Column `crossAxisAlignment.start` bo'lgani uchun taymer chapga
    // yopishib qolardi; Center uni to'lov kartasining o'qi bilan tenglashtiradi.
    return Center(
      child: Column(
        children: [
          ExcludeSemantics(
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _progressController,
                  builder: (context, _) => SizedBox(
                    width: 80,
                    height: 80,
                    child: CircularProgressIndicator(
                      value: 1 - _progressController.value,
                      strokeWidth: 8,
                      backgroundColor: kSurface2,
                      // Progress = interaktiv qatlam → kPrimary.
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isUrgent ? kError : kPrimary,
                      ),
                    ),
                  ),
                ),
                Text(
                  '$_secondsLeft',
                  style: TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                    // Odatdagi holatda kInkMuted (5.47:1) — o'qilarli, lekin
                    // to'lov raqami bilan raqobatlashmaydi.
                    color: isUrgent ? kErrorDeep : kInkMuted,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: kSpace2),
          Text(
            'Qabul qilish uchun $_secondsLeft soniya qoldi',
            style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
          ),
        ],
      ),
    );
  }

  /// TO'LOV — ekrandagi eng katta element.
  ///
  /// Haydovchi taklifni bitta savol bilan baholaydi: "qancha?". Shu bois
  /// summa kFontDisplay da yolg'iz qoladi (taymer raqami kichraytirildi) va
  /// to'q yashil karta ustida oq matnda turadi — quyoshda ham o'qiladi.
  Widget _buildPriceCard(Order offer) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        // To'q yashil CTA gradienti — oq matn butun diapazonda AA.
        gradient: kGradientCta,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          Text(
            'Taxminiy daromad',
            style: TextStyle(
              fontSize: kFontLabel,
              color: kOnPrimary.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            Formatters.formatPrice(offer.estimatedPrice),
            style: const TextStyle(
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
              color: kOnPrimary,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }

  /// Qaror tartibi: avval "borishga arziydimi" (MASOFA), keyin "qayerga"
  /// (manzillar).
  ///
  /// Olish masofasi avval ekranning eng pastida, tugmalar ustida turardi —
  /// haydovchi uni qidirishga majbur edi, holbuki taklifni rad etish yoki
  /// qabul qilish aynan shu raqamga bog'liq. Endi u marshrut kartasining
  /// BOSHIDA: masofa → ajratkich → olish nuqtasi → manzil.
  Widget _buildRouteInfo(Order offer, DriverServiceWording wording) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          if (_distanceToPickup != null) ...[
            _buildDistanceInfo(wording),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: kSpace3),
              child: Divider(height: 1, thickness: 1, color: kLineStrong),
            ),
          ],
          _buildRouteRow(
            Icons.radio_button_checked,
            kPrimary,
            wording.pickupTitle,
            offer.pickup.address,
          ),
          const Padding(
            padding: EdgeInsets.only(left: 9),
            child: SizedBox(
              height: kSpace4,
              child: VerticalDivider(width: 1, color: kLineStrong),
            ),
          ),
          _buildRouteRow(
            Icons.location_on,
            kError,
            wording.dropoffTitle,
            offer.dropoff.address,
          ),
        ],
      ),
    );
  }

  Widget _buildRouteRow(
    IconData icon,
    Color color,
    String label,
    String address,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, color: color, size: 20)),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontMicro,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                address,
                style: const TextStyle(
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w600,
                  color: kInk,
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Masofa — taklifni baholash RAQAMI, shuning uchun manzil matnidan katta
  /// (kFontH3) va to'q siyohda. Yorliq ("Restorangacha", "Yo'lovchigacha")
  /// ustida kichik va kInkMuted: u kontekst, raqam esa qarorning o'zi.
  /// Ikonka yo'nalish ma'nosini beradi va yolg'iz qolmaydi.
  Widget _buildDistanceInfo(DriverServiceWording wording) {
    return MergeSemantics(
      child: Row(
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.near_me_rounded, color: kPrimary, size: 20),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  wording.distanceToPickupLabel,
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  Formatters.formatDistance(_distanceToPickup!),
                  style: const TextStyle(
                    color: kInk,
                    fontSize: kFontH3,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// ⚠️ XAVFSIZLIK: bu ikki amal TENG EMAS, shuning uchun teng ko'rinmaydi.
  ///
  /// Avval "Rad etish" va "Qabul qilish" bitta Row da, ikkalasi ham Expanded
  /// va bir xil balandlikda (kControlHeight, 54) yonma-yon turardi. Harakatdagi
  /// avtomobilda xato teginish buyurtmani RAD ETADI — bu qaytarib bo'lmaydigan
  /// amal: taklif boshqa haydovchiga ketadi va daromad yo'qoladi. Qabul qilishda
  /// xato teginishning narxi esa nolga yaqin (safar ekrani ochiladi).
  ///
  /// Shuning uchun:
  ///   • Qabul qilish — TO'LIQ kenglik, kControlHeightDriver (64), to'ldirilgan
  ///     kPrimary: ekrandagi eng katta va eng ko'rinadigan nishon;
  ///   • Rad etish — PASTDA, alohida qatorda, tor va to'ldirilmagan.
  ///     Balandligi kMinTapTargetDriver (56) — qo'lqopli barmoq uchun yetarli,
  ///     lekin vizual og'irligi past va butun kenglikni egallamaydi;
  ///   • orada kSpace4 (16dp) — buzg'unchi amal uchun talab qilingan 12dp dan
  ///     ham keng, chunki bosh barmoq "Qabul qilish" ning pastki chetidan
  ///     sirg'alib tushishi mumkin.
  ///
  /// Chegara rangi kError dan kLineInteractive ga o'zgartirildi: qizil ramka
  /// e'tiborni tortadi, holbuki bu xohlanmagan amal. Avvalgi izohdagi qaror —
  /// "xavf MATNI kErrorDeep (6.47:1), kError faqat chegara" — saqlanadi:
  /// ma'no endi to'liq matn rangida, chegara esa neytral interaktiv chiziq.
  Widget _buildActionButtons(Order offer, DriverProvider provider) {
    final isLoading = provider.state == DriverProviderState.loading;

    return Column(
      children: [
        Semantics(
          button: true,
          enabled: !isLoading,
          label: 'Qabul qilish',
          value: isLoading ? 'Yuklanmoqda' : null,
          excludeSemantics: true,
          child: SizedBox(
            width: double.infinity,
            height: kControlHeightDriver,
            child: ElevatedButton(
              onPressed: isLoading ? null : () => _onAccept(offer),
              style: ElevatedButton.styleFrom(
                // Oldin kSuccess (mint) + oq matn = 2.12:1 edi.
                backgroundColor: kPrimary,
                foregroundColor: kOnPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: kOnPrimary,
                      ),
                    )
                  : const Text(
                      'Qabul qilish',
                      style: TextStyle(
                        fontSize: kFontH2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: kSpace4),
        Semantics(
          button: true,
          enabled: !isLoading,
          label: 'Rad etish',
          excludeSemantics: true,
          child: TextButton(
            onPressed: isLoading ? null : () => _onDecline(offer),
            style: TextButton.styleFrom(
              // Kenglik matnga qarab qisqaradi — nishon ataylab tor.
              minimumSize: const Size(0, kMinTapTargetDriver),
              padding: const EdgeInsets.symmetric(horizontal: kSpace6),
              // Xavf MATNDA: kErrorDeep kSurface ustida 6.47:1.
              foregroundColor: kErrorDeep,
              side: const BorderSide(color: kLineInteractive),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(kRadiusMd),
              ),
            ),
            child: const Text(
              'Rad etish',
              style: TextStyle(
                fontSize: kFontTitle,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
