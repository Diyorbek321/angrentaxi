import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/waiting_charge_ticker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ArrivedScreen extends StatefulWidget {
  const ArrivedScreen({super.key, this.clock});

  /// Testlar uchun soatni qotirish nuqtasi. `null` — `DateTime.now`.
  ///
  /// ⚠️ NEGA KERAK. Kutish hisobi `now - order.arrivedAt` dan chiqadi va
  /// `DateTime.now()` widget testida SOXTALASHTIRILMAYDI — `tester.pump`
  /// faqat taymerlarni oldinga suradi, kalendar vaqtni emas. Shu ilmoqsiz
  /// "bepul oyna tugadi" o'tishini umuman sinab bo'lmasdi, ya'ni pul
  /// undiriladigan chegara testsiz qolardi.
  ///
  /// `TariffSelectScreen` dagi `paymentService` ilmog'i bilan bir xil
  /// naqsh — prodakshenda hech qachon berilmaydi.
  final DateTime Function()? clock;

  @override
  State<ArrivedScreen> createState() => _ArrivedScreenState();
}

class _ArrivedScreenState extends State<ArrivedScreen> {
  // ⚠️ BU YERDA LOKAL HISOBLAGICH YO'Q — VA BO'LMASLIGI KERAK.
  //
  // Ilgari ekran `int _waitingSeconds` ni o'zi sanardi: `Timer.periodic`
  // ekran ochilganda noldan boshlanardi, ya'ni ilova qayta ishga tushsa
  // yoki haydovchi navigatsiyaga o'tib qaytsa raqam NOLGA qaytardi.
  // Yo'lovchi esa bu raqamni umuman ko'rmasdi. Endi kutish PUL undiradi,
  // shuning uchun sanoq nuqtasi yagona bo'lishi shart: serverdagi
  // `order.arrivedAt`. `WaitingChargeTicker` faqat qayta chizadi, vaqtni
  // esa har kadrda `now - arrivedAt` dan qayta hisoblaydi.
  Future<void> _onStartTrip() async {
    final provider = context.read<DriverProvider>();
    await provider.startTrip();
    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      Navigator.of(context).pushReplacementNamed('/driver/trip');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yetib keldim'),
        backgroundColor: kSurface,
        foregroundColor: kInk,
        elevation: 0,
      ),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            return const Center(child: CircularProgressIndicator());
          }

          // Ovqat buyurtmasida bu ekran RESTORANDA ochiladi, taksida —
          // yo'lovchi oldida. Barcha matn shu jadvaldan.
          final wording = order.wording;

          // ⚠️ Baland ekranda tugmalar PASTDA yopishib turadi, past
          // ekranda esa sahifa aylanadi. Oddiy `Column` + `Spacer` da
          // matn uzunroq turlarda (masalan "Yetkazishni boshlash") kichik
          // telefonlarda pastki qismi kesilib qolardi.
          return LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.all(kSpace4),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - kSpace8,
                ),
                child: IntrinsicHeight(
                  child: Column(
                    children: [
                      const SizedBox(height: kSpace5),
                      _buildArrivedBanner(wording),
                      // Oraliq blokning O'ZIDA: `arrivedAt` yo'q buyurtmada
                      // (eski yozuv yoki "keldim" bosilmagan) blok umuman
                      // chizilmaydi va bu yerda 48dp bo'sh joy qolib
                      // ketmasligi kerak.
                      _buildWaitingBlock(order),
                      const SizedBox(height: kSpace6),
                      _buildOrderInfo(order, wording),
                      const Spacer(),
                      const SizedBox(height: kSpace6),
                      _buildActionButtons(order, provider, wording),
                      const SizedBox(height: kSpace4),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildArrivedBanner(DriverServiceWording wording) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        color: kMintTint,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
      ),
      child: Column(
        children: [
          // Mint tint ustidagi matn/ikona — kPrimary (mint o'zi 2.12:1).
          const ExcludeSemantics(
            child: Icon(Icons.location_on, color: kPrimary, size: 48),
          ),
          const SizedBox(height: kSpace2),
          Text(
            wording.arrivedTitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kPrimary,
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            wording.pickupActionLabel,
            textAlign: TextAlign.center,
            style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------
  // KUTISH BLOKI — VAQT EMAS, PUL.
  //
  // ⚠️ MANBA SERVER. Sanoq `order.arrivedAt` dan boshlanadi (haydovchi
  // "yetib keldim" bosgan lahza, SERVER vaqti), shuning uchun ilova qayta
  // ishga tushsa ham raqam to'g'ri qoladi va YO'LOVCHI EKRANIDAGI RAQAM
  // BILAN BIR XIL bo'ladi. Yaxlitlash ham serverniki: har BOSHLANGAN
  // daqiqa to'liq hisoblanadi (lib/shared/utils/waiting_charge.dart).
  //
  // ⚠️ IKKI HOLAT, IKKI XIL RAQAM — bu ataylab:
  //
  //   bepul oyna ketmoqda : katta raqam = QOLGAN VAQT ("1:24"), pastda
  //                         keyin qancha turishi
  //   oyna tugadi        : katta raqam = YIG'ILGAN SUMMA ("+1 500 so'm"),
  //                         pastda jami kutilgan vaqt
  //
  // Haydovchi bu blokka bitta savol bilan qaraydi va savol holatga qarab
  // o'zgaradi: avval "yana qancha bepul kutaman?", keyin "qancha yig'ildi?".
  // Ikkala savolga ham javob eng katta raqamda turishi kerak.
  //
  // ⚠️ HOLAT FARQI FAQAT RANGDA EMAS. Quyosh aksida va rangni ajratmaydigan
  // haydovchida rang yo'qoladi, shuning uchun o'tish bir vaqtning o'zida
  // TO'RTTA belgida ko'rinadi: fon, ikona, YORLIQ MATNI va RAQAM TURI
  // (soat → pul).
  // --------------------------------------------------------------------
  Widget _buildWaitingBlock(Order order) {
    // `arrivedAt` yo'q — hisoblagich UMUMAN ko'rsatilmaydi. Nol turgan
    // hisoblagich "kutish boshlandi" degan yolg'on ma'no berardi, holbuki
    // haydovchi hali tugmani bosmagan (yoki bu migratsiyadan oldingi
    // buyurtma).
    if (order.arrivedAt == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: kSpace6),
      child: WaitingChargeTicker(
        arrivedAt: order.arrivedAt,
        freeWaitMinutes: order.freeWaitMinutes,
        waitingPricePerMinute: order.waitingPricePerMinute,
        clock: widget.clock,
        builder: (context, charge) => _buildWaitingCard(order, charge),
      ),
    );
  }

  Widget _buildWaitingCard(Order order, WaitingCharge charge) {
    final perMinute = Formatters.formatSom(
      order.waitingPricePerMinute.toDouble(),
    );

    final billing = charge.isBilling;
    final headline = billing
        ? '+${Formatters.formatSom(charge.fare.toDouble())}'
        : formatWaitClock(charge.freeRemaining);
    final label = billing ? 'Kutish haqi' : 'Bepul kutish';
    final caption = billing
        ? 'Jami ${formatWaitElapsed(charge.elapsed)} · $perMinute/daqiqa'
        : 'Keyin $perMinute/daqiqa';

    // Ekran o'quvchi uchun BUTUN blok bitta jumla. `liveRegion: false` —
    // raqam sekundiga o'zgaradi va jonli soha bo'lsa u boshqa hamma narsani
    // bosib ketardi.
    final semanticsLabel = billing
        ? 'Kutish haqi ${Formatters.formatSom(charge.fare.toDouble())}, '
            'jami ${formatWaitElapsed(charge.elapsed)} kutildi'
        : 'Bepul kutish tugashiga ${formatWaitClock(charge.freeRemaining)} '
            'qoldi, keyin $perMinute har daqiqa uchun';

    return Semantics(
      label: semanticsLabel,
      liveRegion: false,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace5,
          vertical: kSpace4,
        ),
        decoration: BoxDecoration(
          color: billing ? kWarningLight : kSurface2,
          borderRadius: BorderRadius.circular(kRadiusMd),
          // Chegara faqat hisoblanayotgan holatda — bloknining o'zi
          // "endi pul ketyapti" deb turadi.
          border: billing ? Border.all(color: kWarning) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Ikona `kWarningDeep` (5.02:1) — `kWarning` o'zi yozuv va
                // ikona uchun juda och (2.15:1), u faqat chegara/to'ldirish.
                ExcludeSemantics(
                  child: Icon(
                    billing ? Icons.timer : Icons.timer_outlined,
                    color: billing ? kWarningDeep : kInkMuted,
                    size: 22,
                  ),
                ),
                const SizedBox(width: kSpace3),
                // ⚠️ YORLIQ EGILADI, RAQAM EGILMAYDI. Uzun summa
                // ("+1 250 000 so'm") yoki kattalashtirilgan tizim shrifti
                // bilan 320dp li telefonda qator toshib ketardi; kesilgan
                // PUL raqami — haydovchi uchun eng yomon xato.
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                      // `kInkSubtle` EMAS — yozuvda 3.67:1 AA'dan past.
                      color: billing ? kWarningDeep : kInkMuted,
                    ),
                  ),
                ),
                const SizedBox(width: kSpace3),
                Text(
                  headline,
                  style: const TextStyle(
                    fontSize: kFontH1,
                    fontWeight: FontWeight.w800,
                    // Eng muhim raqam eng kuchli kontrastda (17.5:1) —
                    // quyosh aksidagi ekran uchun. Holatni rang emas, fon
                    // va yorliq ajratadi.
                    color: kInk,
                    // Raqamlar sekundiga o'zgaradi; qat'iy balandlik
                    // qatorning "sakrashini" oldini oladi.
                    height: 1.1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace2),
            Text(
              caption,
              style: const TextStyle(
                fontSize: kFontMicro,
                color: kInkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderInfo(Order order, DriverServiceWording wording) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        border: Border.all(color: kLine),
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Buyurtma ma\'lumotlari',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: kFontBodyLg,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace3),
          _buildInfoRow(Icons.radio_button_checked, kPrimary,
              wording.pickupTitle, order.pickup.address),
          const SizedBox(height: kSpace2),
          _buildInfoRow(Icons.location_on, kError, wording.dropoffTitle,
              order.dropoff.address),
          const Divider(height: kSpace5, color: kLine),
          // ⚠️ YORLIQ EGILADI, SUMMA EGILMAYDI. Qator `spaceBetween` bilan
          // qat'iy ikki matndan iborat edi: uzun summa (masalan
          // "1 284 000 UZS") yoki tizim shrifti kattalashtirilgani zahoti
          // qator 320dp li telefonda TOSHIB ketardi. Endi yorliq
          // `Expanded` — bo'sh joy yetmasa AVVAL u qisqaradi; summa esa
          // flekssiz, ya'ni hech qachon kesilmaydi (kesilgan narx —
          // haydovchi uchun eng yomon xato).
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Taxminiy narx:',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: kInkMuted, fontSize: kFontBody),
                ),
              ),
              const SizedBox(width: kSpace3),
              // Pul — haydovchining asosiy raqami, shuning uchun sarlavha
              // o'lchamida (`kFontH2`): tana matni o'lchamidagi summa
              // manzil qatorlari orasida yo'qolib ketardi.
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
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    Color color,
    String label,
    String value,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, color: color, size: 18)),
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
                ),
              ),
              Text(
                value,
                style: const TextStyle(fontSize: kFontLabel, color: kInk),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------
  // AMALLAR — IERARXIYA O'LCHAMDA, RANGDA EMAS.
  //
  // ⚠️ IKKI TUGMA HECH QACHON YONMA-YON QO'YILMAYDI. "Safarni boshlash"
  // va "Yo'lovchi kelmadi" natijalari qarama-qarshi: biri safarni
  // boshlaydi, ikkinchisi buyurtmani BEKOR qiladi. Yonma-yon turganda
  // ular bir xil kenglikda, bir xil balandlikda bo'lib qoladi va
  // tebranayotgan mashinada barmoq birini bosmoqchi bo'lib ikkinchisiga
  // tegadi — bu qaytarib bo'lmaydigan xato. Rang bu xatodan saqlamaydi:
  // rangni ajratmaydigan haydovchi uchun yagona farq — JOY va O'LCHAM.
  //
  //   asosiy    : `kControlHeightDriver` (64dp), to'ldirilgan
  //   ikkilamchi: `kMinTapTargetDriver`  (56dp), konturli, PASTDA
  //   oraliq    : `kSpace5` (20dp) — buzg'unchi amal uchun talab
  //               qilinadigan 12dp dan kengroq, chunki ustidagi tugma
  //               ekrandagi eng ko'p bosiladigan element.
  //
  // Bekor qilish baribir tasdiq dialogidan o'tadi — bu ikkinchi to'siq,
  // birinchisining o'rnini bosmaydi.
  // --------------------------------------------------------------------
  Widget _buildActionButtons(
    Order order,
    DriverProvider provider,
    DriverServiceWording wording,
  ) {
    return Column(
      children: [
        AppButton(
          label: wording.startActionLabel,
          onPressed: _onStartTrip,
          isLoading: provider.state == DriverProviderState.loading,
          height: kControlHeightDriver,
          icon: const Icon(Icons.play_arrow, color: kOnPrimary),
        ),
        const SizedBox(height: kSpace5),
        AppOutlinedButton(
          label: wording.noShowActionLabel,
          onPressed: () => _showNotHandedOverDialog(order, provider, wording),
          height: kMinTapTargetDriver,
          // Xavf MATNI kErrorDeep (6.47:1); kError faqat chegara uchun.
          textColor: kErrorDeep,
          borderColor: kError,
        ),
      ],
    );
  }

  /// Bekor qilishdan oldingi tasdiq.
  ///
  /// ⚠️ MATN LAHZALIK SURAT. Dialog ochilgan payt hisoblanadi va tikilib
  /// turmaydi: haydovchi allaqachon qaror qabul qilgan, raqamning dialog
  /// ichida sekundiga o'zgarishi qarorga hech narsa qo'shmaydi, faqat
  /// e'tiborni tortadi. Raqamning O'ZI esa ekrandagi blok bilan bir xil
  /// manbadan (`order.arrivedAt`) chiqadi.
  void _showNotHandedOverDialog(
    Order order,
    DriverProvider provider,
    DriverServiceWording wording,
  ) {
    final charge = computeWaitingCharge(
      arrivedAt: order.arrivedAt,
      now: DateTime.now(),
      freeWaitMinutes: order.freeWaitMinutes,
      waitingPricePerMinute: order.waitingPricePerMinute,
    );

    // `arrivedAt` yo'q buyurtmada kutish vaqti haqida GAPIRMAYMIZ — soxta
    // "0 soniya kutdingiz" yozuvidan ko'ra savolning o'zi yaxshiroq.
    final waitedLine = order.arrivedAt == null
        ? ''
        : charge.isBilling
            ? '${formatWaitElapsed(charge.elapsed)} kutdingiz, '
                '${Formatters.formatSom(charge.fare.toDouble())} kutish haqi '
                'yig\'ildi. '
            : '${formatWaitElapsed(charge.elapsed)} kutdingiz. ';

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(wording.noShowActionLabel),
        content: Text(
          '${waitedLine}Buyurtmani bekor qilmoqchimisiz?',
        ),
        // ⚠️ TASDIQ DIALOGIDA HAM IKKI TANLOV YONMA-YON QO'YILMAYDI —
        // ekrandagi tugmalar bilan bir xil qoida, chunki xavf ham o'sha:
        // tanlovlardan biri buyurtmani BEKOR qiladi.
        //
        // `AlertDialog` `actions` ro'yxatini gorizontal `OverflowBar` ga
        // tizadi va tugmalar orasida atigi 8dp qoldiradi
        // (`buttonPadding.horizontal / 2`) — buzg'unchi amal uchun talab
        // qilinadigan 12dp dan kam. Bunday holatda ikkala tugma bir xil
        // balandlikda, bir xil tekis ko'rinishda bo'lib qoladi va ularni
        // faqat RANG ajratardi; rang esa quyosh aksida ham, rangni
        // ajratmaydigan haydovchida ham yo'qoladi.
        //
        // Shuning uchun `actions` ga BITTA ustun beriladi:
        //   tepada: xavfsiz tanlov, to'ldirilgan (dialog — TO'SIQ, uning
        //           sukut bo'yicha javobi "bekor qilma")
        //   pastda: bekor qilish, konturli va qizil, `kSpace4` (16dp)
        //           oraliq bilan
        //
        // Yorliqlar ham "Ha"/"Yo'q" emas: qaysi tugma nima qilishini
        // savolni qayta o'qimasdan bilish kerak.
        actionsPadding: const EdgeInsets.fromLTRB(
          kSpace4,
          kSpace2,
          kSpace4,
          kSpace4,
        ),
        actions: [
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppButton(
                key: const ValueKey('no_show_keep_waiting'),
                label: "Yo'q, kutaman",
                height: kMinTapTargetDriver,
                onPressed: () => Navigator.of(ctx).pop(),
              ),
              const SizedBox(height: kSpace4),
              AppOutlinedButton(
                key: const ValueKey('no_show_confirm_cancel'),
                label: 'Ha, bekor qilaman',
                height: kMinTapTargetDriver,
                // Xavf MATNI kErrorDeep (6.47:1); kError faqat chegara uchun.
                textColor: kErrorDeep,
                borderColor: kError,
                onPressed: () async {
                  Navigator.of(ctx).pop();
                  await provider.cancelOrder(reason: 'passenger_no_show');
                  if (!mounted) return;
                  if (provider.state == DriverProviderState.success) {
                    Navigator.of(context).pushNamedAndRemoveUntil(
                      '/driver/home',
                      (route) => false,
                    );
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content:
                            Text(provider.error ?? 'Bekor qilib bo\'lmadi'),
                      ),
                    );
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}
