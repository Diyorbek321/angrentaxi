import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/models/driver_earnings_breakdown.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/ag_option_chips.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// DAROMAD EKRANI — haydovchi bu ekranga bitta savol bilan keladi:
// "men bugun QANCHA topdim va nega shuncha?".
//
// Tuzilma shu savolga qarab qurilgan:
//
//   1. SOF DAROMAD siyoh hero kartada, ekrandagi ENG KATTA element.
//      1,5 soniyalik qarashda faqat shu raqam o'qilsa ham ekran o'z
//      vazifasini bajargan bo'ladi.
//   2. USHLAB QOLINGANLAR SHU YERDA, o'sha kartaning ichida — pastdagi
//      alohida kartada emas. Sof raqamni tushuntirishsiz ko'rsatish
//      qo'llab-quvvatlashga murojaat va churn keltiradi: haydovchi
//      "menga kam to'landi" deb o'ylaydi, chunki safarlar summasi bilan
//      qo'lga tekkan pul orasidagi farqni hech kim ko'rsatmagan.
//      Zanjir: safarlardan jami → platforma komissiyasi → qo'lga tekkani.
//   3. Davr (Bugun / Hafta / Oy) hero USTIDA turadi: u butun kartaning
//      ma'nosini o'zgartiradi, shuning uchun raqamdan OLDIN o'qilishi kerak.
//
// ⚠️ CHAQIM (tips) QATORI YO'Q — MA'LUMOT YO'QLIGI UCHUN, unutilgani uchun
// emas. Backend chaqimni alohida daftar yozuvi sifatida saqlaydi
// (`transaction.external_id = 'tip'`, komissiyasiz — backend/src/modules/
// orders/orders-tips.service.ts), lekin GET /orders/earnings/breakdown uni
// qaytarmaydi: javobda faqat `gross` / `commission` / `net` / `trips` bor
// (backend/src/modules/orders/orders-earnings.service.ts). Shu sababli
// chaqim `gross` ichiga ham, `net` ichiga ham kirmaydi — ya'ni hamyondagi
// pul bu ekrandagi sof daromaddan KATTA bo'lishi mumkin. To'liq zanjir
// uchun avval backendga `tips` maydoni qo'shilishi kerak, keyin bu yerga
// bitta `_LedgerRow` (kMintSoft, "+" bilan) qo'shiladi.
//
// Ranglar: siyoh yuzada haydovchining asosiy raqami kMintSoft (11.22:1) —
// oq (17.5:1) qatorlar uchun qoldirilgan, shunda "pul" rangi ledger
// qiymatlaridan ajralib turadi.
//
// ⚠️ QORONG'I YUZADAGI KONTRAST GRADIENT BO'YLAB O'LCHANADI. Hero foni
// `kGradientInk` — yuqori chapda kInk (#0F1B22), pastki o'ngda
// kInkGradientEnd (#1D3A2F, ANCHA yorug'). Ichki bloklar esa ustiga
// `kOnPrimary` ni 10% shaffoflikda qo'yadi, ya'ni matn haqiqatda #273238
// (yuqorida) … #344E44 (pastda) ustida turadi — YALANG'OCH kInk ustida EMAS.
// Shu sababli kErrorDark (#FF6369) bu kartada YARAMAYDI: u yalang'och kInk
// ustida 6.03:1 bo'lsa ham, ichki blokda 4.53:1 ga, kartaning pastki
// o'ngida esa 3.12:1 ga tushadi — AA dan past. Kamayish/ogohlantirish
// qiymatlari uchun kWarningDark (#FBBF24) olinadi: o'sha bloklarda
// 7.86:1 … 5.42:1, ya'ni butun gradient bo'ylab AA dan yuqori.
// QARZ esa umuman shaffof yuzada CHIZILMAYDI — pastdagi `_WalletRow`
// izohiga qarang.
// ============================================================================

// Which rolling window of GET /orders/earnings/breakdown is currently shown
// in the period chips on the earnings screen.
enum _EarningsPeriod { today, week, month }

/// Chip `id` si — `AgOptionChips` yorliq emas, BARQAROR id qaytaradi.
String _periodId(_EarningsPeriod period) => switch (period) {
      _EarningsPeriod.today => 'today',
      _EarningsPeriod.week => 'week',
      _EarningsPeriod.month => 'month',
    };

/// Chipdagi qisqa yorliq — barmoq ostidagi qator tor ekranda ham sig'sin.
String _periodChipLabel(_EarningsPeriod period) => switch (period) {
      _EarningsPeriod.today => 'Bugun',
      _EarningsPeriod.week => 'Hafta',
      _EarningsPeriod.month => 'Oy',
    };

/// Hero kartadagi to'liq yorliq. Chipda "Hafta" yozilgan, lekin backend
/// SURILUVCHI oyna qaytaradi (oxirgi 7/30 kun) — haydovchi buni kalendar
/// haftasi deb o'ylab, dushanba kuni "nega raqam nolga tushmadi?" demasligi
/// uchun aniq aytiladi.
String _periodTitle(_EarningsPeriod period) => switch (period) {
      _EarningsPeriod.today => 'Bugun',
      _EarningsPeriod.week => "So'nggi 7 kun",
      _EarningsPeriod.month => "So'nggi 30 kun",
    };

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  _EarningsPeriod _selectedPeriod = _EarningsPeriod.today;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<DriverProvider>();
      provider.loadEarnings();
      provider.loadOrderHistory();
      provider.loadProfile();
      provider.loadWithdrawals();
      provider.loadWalletBalance();
      provider.loadEarningsBreakdown();
      provider.loadBonusProgress();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Qatlamli til: ekran foni kSurface2, bloklar esa oq `AgSurfaceCard`.
      // Ikkalasi BIRGA ishlatiladi — oq fon ustidagi oq karta ajralmaydi.
      backgroundColor: kSurface2,
      appBar: AppBar(title: const Text('Daromad')),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          // Uch holat: yuklanmoqda → SKELETON (spinner emas),
          // xato → AppErrorState, bo'sh ro'yxatlar → AppEmptyState.
          if (provider.state == DriverProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const SingleChildScrollView(
              child: AppSkeletonGroup(
                child: Column(
                  children: [
                    Padding(
                      padding: EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 0),
                      child: AppSkeleton(
                        width: double.infinity,
                        height: 44,
                        radius: kRadiusFull,
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.all(kSpace4),
                      child: AppSkeleton(
                        width: double.infinity,
                        height: 260,
                        radius: kRadiusLg,
                      ),
                    ),
                    AppSkeletonTile(hasTrailing: true),
                    SizedBox(height: kSpace3),
                    AppSkeletonTile(hasTrailing: true),
                    SizedBox(height: kSpace3),
                    AppSkeletonTile(hasTrailing: true),
                  ],
                ),
              ),
            );
          }

          if (provider.state == DriverProviderState.error &&
              provider.orderHistory.isEmpty) {
            return AppErrorState(
              message: provider.error ?? 'Xatolik yuz berdi',
              onRetry: () {
                provider.loadEarnings();
                provider.loadOrderHistory();
              },
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadEarnings();
              await provider.loadOrderHistory();
              await provider.loadEarningsBreakdown();
              await provider.loadBonusProgress();
              // Yechish so'rovi tasdiqlangan yoki rad etilgan bo'lishi
              // mumkin — ikkalasi ham qoldiqni o'zgartiradi.
              await provider.loadWalletBalance();
            },
            color: kPrimary,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _buildPeriodChips()),
                SliverToBoxAdapter(
                  child: _buildEarningsHero(context, provider),
                ),
                if (provider.bonusProgress.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _buildBonusSection(context, provider),
                  ),
                const SliverToBoxAdapter(
                  child: _SectionHeader("Pul yechish so'rovlari"),
                ),
                if (provider.withdrawals.isEmpty)
                  // Bo'sh holat OQ kartada: `AppEmptyState` ikonkasi
                  // `kSurface2` doira ichida chiziladi va ekran foni ham
                  // `kSurface2` — kartasiz u fonda butunlay yo'qolardi.
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace2),
                      child: AgSurfaceCard(
                        padding: EdgeInsets.zero,
                        child: AppEmptyState(
                          icon: Icons.request_quote_outlined,
                          title: "Hozircha so'rovlar yo'q",
                          compact: true,
                        ),
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _WithdrawalCard(
                        withdrawal: provider.withdrawals[index],
                      ),
                      childCount: provider.withdrawals.length,
                    ),
                  ),
                const SliverToBoxAdapter(
                  child: _SectionHeader('Buyurtmalar tarixi'),
                ),
                if (provider.orderHistory.isEmpty)
                  // A plain padded box rather than SliverFillRemaining: the
                  // withdrawal-requests section above this one means the
                  // remaining viewport space can be smaller than this
                  // content's intrinsic height, and SliverFillRemaining
                  // forces its child into exactly that (possibly too small)
                  // space, overflowing instead of just taking what it needs.
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace2),
                      child: AgSurfaceCard(
                        padding: EdgeInsets.zero,
                        child: AppEmptyState(
                          icon: Icons.history,
                          title: 'Buyurtmalar tarixi yo\'q',
                          compact: true,
                        ),
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _DriverOrderCard(
                        order: provider.orderHistory[index],
                      ),
                      childCount: provider.orderHistory.length,
                    ),
                  ),
                // Oxirgi karta tizim jest paneli ostida qolmasin.
                const SliverToBoxAdapter(child: SizedBox(height: kSpace6)),
              ],
            ),
          );
        },
      ),
    );
  }

  // Davr tanlash — `AgOptionChips`. Ilgari bu uchta teng kenglikdagi
  // "segmented" tab edi; chiplar qatori tor ekranda ham sig'adi va tizim
  // shrifti kattalashtirilganda kesilmaydi (chip minHeight bilan o'sadi,
  // tegish maydoni esa 48dp bo'lib qoladi).
  Widget _buildPeriodChips() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace3),
      child: AgOptionChips(
        items: [
          for (final period in _EarningsPeriod.values)
            AgOptionChipItem(
              id: _periodId(period),
              label: _periodChipLabel(period),
              active: _selectedPeriod == period,
              // Yolg'iz "Oy" ekran o'quvchida ma'nosiz — davrning to'liq
              // nomi aytiladi.
              semanticsLabel: '${_periodTitle(period)} daromadi',
            ),
        ],
        onTap: (id) {
          final period = _EarningsPeriod.values
              .firstWhere((p) => _periodId(p) == id);
          setState(() => _selectedPeriod = period);
        },
      ),
    );
  }

  // Siyoh hero: sof daromad + uni tushuntiruvchi zanjir + hamyon + yechish.
  Widget _buildEarningsHero(BuildContext context, DriverProvider provider) {
    final breakdown = provider.earningsBreakdown;
    final DriverEarningsPeriod period = switch (_selectedPeriod) {
      _EarningsPeriod.today => breakdown.today,
      _EarningsPeriod.week => breakdown.week,
      _EarningsPeriod.month => breakdown.month,
    };

    return Container(
      margin: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: kGradientInk,
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sof daromad · ${_periodTitle(_selectedPeriod)}',
            style: TextStyle(
              color: kOnPrimary.withValues(alpha: 0.78),
              fontSize: kFontLabel,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            Formatters.formatPrice(period.net),
            key: const ValueKey('earnings_net_value'),
            style: const TextStyle(
              // Haydovchining ASOSIY raqami quyoshda o'qilishi kerak.
              // kMintSoft siyoh ustida 11.22:1 — pul rangi saqlanadi,
              // lekin ledgerdagi oq qiymatlardan ajralib turadi.
              // (Ilgari kMint edi — 8.8:1; bu ekranda eng katta raqam
              // uchun eng yuqori kontrastli mint tanlandi.)
              color: kMintSoft,
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
              height: 1.05,
            ),
          ),
          const SizedBox(height: kSpace4),
          _buildLedger(period),
          // ⚠️ Manba — DAFTAR (`/payments/wallet`), `Driver.balance` ustuni
          // EMAS. Ustun yechib olingan pulni hisobga olmasdi, ya'ni birinchi
          // yechishdan keyin ekranda haqiqiy qoldiqdan katta raqam turardi va
          // haydovchi "yechish" bosganda serverdan rad javob olardi.
          //
          // `null` (hali yuklanmagan) holatida blok UMUMAN ko'rsatilmaydi:
          // nol chizish "puling yo'q" degan yolg'on bo'lardi.
          if (provider.walletBalance != null) ...[
            const SizedBox(height: kSpace3),
            // Qarz holatida OQIBAT ham shu blokning ICHIDA aytiladi (faqat
            // raqam emas): haydovchi nega onlayn chiqa olmayotganini bilishi
            // kerak, aks holda u buni ilova nosozligi deb o'ylaydi. Ilgari
            // bu jumla blokdan tashqarida, gradient ustida turardi —
            // kartaning pastida kErrorDark u yerda 4.26:1 ga tushardi.
            _WalletRow(
              balance: provider.walletBalance!,
              isDebt: provider.hasWalletDebt,
            ),
          ],
          const SizedBox(height: kSpace4),
          SizedBox(
            width: double.infinity,
            // Haydovchi nishoni — `kControlHeight` (54, yo'lovchi uchun)
            // emas, `kControlHeightDriver`. Bu ekran ko'pincha mashinada,
            // yo'l chetida ochiladi.
            height: kControlHeightDriver,
            child: ElevatedButton.icon(
              key: const ValueKey('withdraw_button'),
              onPressed: () => _showWithdrawDialog(context),
              style: ElevatedButton.styleFrom(
                // Tugmaga mint QO'YILMAYDI; qorong'i yuzada interaktiv
                // to'ldirish uchun kPrimaryOnDark + oq matn (4.50:1).
                backgroundColor: kPrimaryOnDark,
                foregroundColor: kOnPrimary,
                padding: const EdgeInsets.symmetric(vertical: kSpace3),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
              ),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: const Text(
                'Pul yechish',
                style: TextStyle(
                  fontSize: kFontTitle,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// USHLAB QOLINGANLAR — sof raqamning YONIDA, yashirilmagan holda.
  ///
  /// Zanjir yuqoridan pastga o'qiladi va yuqoridagi katta raqam bilan
  /// tugaydi: safarlardan jami → komissiya → qo'lga tekkani. Oxirgi qator
  /// summani QAYTA ko'rsatadi (kalitsiz — kalit hero raqamida), chunki
  /// oxirigacha yetmagan hisob "isbot" bo'la olmaydi.
  Widget _buildLedger(DriverEarningsPeriod period) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        // Siyoh karta ichidagi ikkinchi qatlam — chegara emas, YUZA farqi.
        color: kOnPrimary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          _LedgerRow(
            label: 'Yakunlangan safarlar',
            value: period.trips.toString(),
            valueKey: const ValueKey('earnings_trips_value'),
          ),
          _LedgerRow(
            label: 'Safarlardan jami',
            value: Formatters.formatPrice(period.gross),
            valueKey: const ValueKey('earnings_gross_value'),
          ),
          _LedgerRow(
            label: 'Platforma komissiyasi',
            value: '- ${Formatters.formatPrice(period.commission)}',
            // Kamayish — kWarningDark. Ilgari kErrorDark edi, izohda
            // "6.12:1" deb yozilgandi; o'sha raqam YALANG'OCH kInk uchun
            // hisoblangan, holbuki qator `kOnPrimary` 10% blok ichida va
            // gradient ustida turadi: haqiqiy qiymat 4.53:1 (yuqorida) …
            // 3.12:1 (pastda) — AA dan past. kWarningDark shu blokda
            // 7.86:1 … 5.42:1. Ma'no rangda EMAS: "- " belgisi va yorliq
            // aytadi (WCAG 1.4.1), shuning uchun rang almashuvi mazmunni
            // o'zgartirmaydi. Komissiya XATO emas, kutilgan ushlanma —
            // ogohlantirish rangi semantik jihatdan ham to'g'riroq.
            valueColor: kWarningDark,
            valueKey: const ValueKey('earnings_commission_value'),
          ),
          Divider(
            height: kSpace5,
            thickness: 1,
            color: kOnPrimary.withValues(alpha: 0.18),
          ),
          _LedgerRow(
            label: 'Qo\'lingizga qoladi',
            value: Formatters.formatPrice(period.net),
            valueColor: kMintSoft,
            bold: true,
          ),
        ],
      ),
    );
  }

  // Progress toward each active bonus rule, from
  // GET /driver-bonus-rules/me/progress.
  Widget _buildBonusSection(BuildContext context, DriverProvider provider) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
      child: AgSurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                ExcludeSemantics(
                  child: Icon(Icons.emoji_events_outlined,
                      color: kPrimary, size: 20),
                ),
                SizedBox(width: kSpace2),
                Text(
                  'Bonus dasturi',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: kFontTitle,
                    color: kInk,
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace3),
            for (final bonus in provider.bonusProgress)
              _BonusProgressTile(bonus: bonus),
          ],
        ),
      ),
    );
  }

  Future<void> _showWithdrawDialog(BuildContext context) async {
    final provider = context.read<DriverProvider>();
    provider.clearWithdrawalError();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ChangeNotifierProvider<DriverProvider>.value(
        value: provider,
        child: const _WithdrawDialog(),
      ),
    );
  }
}

// Dialog for filing a withdrawal (payout) request: amount + destination
// (card or phone number). Validates the amount against the driver's current
// wallet balance client-side before ever calling the API — the backend also
// enforces this (400 if amount > balance) but surfacing it immediately here
// avoids a pointless round trip for the common mistake of over-requesting.
class _WithdrawDialog extends StatefulWidget {
  const _WithdrawDialog();

  @override
  State<_WithdrawDialog> createState() => _WithdrawDialogState();
}

class _WithdrawDialogState extends State<_WithdrawDialog> {
  final _amountController = TextEditingController();
  final _destinationController = TextEditingController();
  String? _validationError;

  @override
  void dispose() {
    _amountController.dispose();
    _destinationController.dispose();
    super.dispose();
  }

  Future<void> _submit(DriverProvider provider) async {
    // ⚠️ Tekshiruv DAFTAR qoldig'iga qarshi — server ham aynan shunga
    // qaraydi. Ilgari bu yerda `driver.balance` ustuni ishlatilardi, ya'ni
    // ilova va server ikki xil raqamni tekshirardi: ilova o'tkazib
    // yuborardi, server esa rad etardi.
    //
    // `null` = qoldiq hali o'qilmagan. Bunda mahalliy chegara qo'llanmaydi
    // va qaror serverga qoladi — noma'lum qiymatni 0 deb olish haydovchiga
    // "pulingiz yo'q" degan yolg'on xabar bo'lardi.
    final balance = provider.walletBalance;
    final rawAmount = _amountController.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(rawAmount);
    final destination = _destinationController.text.trim();

    if (amount == null || amount <= 0) {
      setState(() => _validationError = "To'g'ri summa kiriting");
      return;
    }
    if (destination.length < 3) {
      setState(
        () => _validationError = "Karta yoki telefon raqamini kiriting",
      );
      return;
    }
    if (balance != null && balance <= 0) {
      setState(
        () => _validationError = provider.hasWalletDebt
            ? "Hisobingiz manfiy (${Formatters.formatPrice(balance)}). "
                "Avval qarzni yoping."
            : "Yechish uchun mablag' yo'q",
      );
      return;
    }
    if (balance != null && amount > balance) {
      setState(
        () => _validationError =
            "Summa hamyondan oshib ketdi. Hamyon: ${Formatters.formatPrice(balance)}",
      );
      return;
    }

    setState(() => _validationError = null);

    final success = await provider.requestWithdrawal(
      amount: amount,
      payoutDestination: destination,
    );

    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DriverProvider>(
      builder: (context, provider, _) {
        final error = _validationError ?? provider.withdrawalError;
        return AlertDialog(
          title: const Text('Pul yechish'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (provider.walletBalance != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: kSpace3),
                    child: Text(
                      provider.hasWalletDebt
                          ? 'Qarz: ${Formatters.formatPrice(provider.walletBalance!)}'
                          : 'Hamyon: ${Formatters.formatPrice(provider.walletBalance!)}',
                      style: TextStyle(
                        color: provider.hasWalletDebt ? kErrorDeep : kInkMuted,
                        fontSize: kFontBody,
                      ),
                    ),
                  ),
                TextField(
                  key: const ValueKey('withdraw_amount_field'),
                  controller: _amountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Summa',
                    hintText: 'Masalan: 60000',
                  ),
                ),
                const SizedBox(height: kSpace3),
                TextField(
                  key: const ValueKey('withdraw_destination_field'),
                  controller: _destinationController,
                  decoration: const InputDecoration(
                    labelText: 'Karta yoki telefon raqami',
                    hintText: '+998901234567',
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: kSpace3),
                  Text(
                    error,
                    key: const ValueKey('withdraw_error_text'),
                    // Xato MATNI — kErrorDeep (6.47:1).
                    style: const TextStyle(
                      color: kErrorDeep,
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Bekor qilish va Yuborish ORASIDA 12dp. `OverflowBar` ni
          // standart holatda 0 bo'shliq bilan taxlaydi — ikki tugma
          // bir-biriga tegib turadi va mashinada, qo'l qaltiraganda
          // noto'g'ri tugma bosiladi. Bu ekranda "noto'g'ri tugma"
          // to'ldirilgan formani yo'qotadi.
          actionsOverflowButtonSpacing: kSpace3,
          // Dialog tugmalari ham HAYDOVCHI nishoni: global mavzu
          // `ElevatedButton` ga `kControlHeight` (54) beradi, `TextButton`
          // esa Material'ning 48dp standartida qoladi — ikkalasi ham
          // `kMinTapTargetDriver` (56) dan past.
          actions: [
            TextButton(
              onPressed: provider.isSubmittingWithdrawal
                  ? null
                  : () => Navigator.of(context).pop(),
              style: TextButton.styleFrom(
                // Kenglik Material standartida (64) qoladi: bekor qilish
                // to'liq kenglikdagi "Yuborish" dan SHAKLI bilan ham
                // farq qilib tursin.
                minimumSize: const Size(64, kMinTapTargetDriver),
              ),
              child: const Text('Bekor qilish'),
            ),
            ElevatedButton(
              key: const ValueKey('withdraw_submit_button'),
              style: ElevatedButton.styleFrom(
                minimumSize:
                    const Size(double.infinity, kMinTapTargetDriver),
              ),
              onPressed: provider.isSubmittingWithdrawal
                  ? null
                  : () => _submit(provider),
              child: provider.isSubmittingWithdrawal
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Yuborish'),
            ),
          ],
        );
      },
    );
  }
}

// Maps a withdrawal request's status to its localized label and color for
// display on the earnings screen's withdrawal-history list.
// `AppStatusTone` ikonka + matn + rang uchtasini birga beradi — holat hech
// qachon faqat rang bilan berilmaydi (WCAG 1.4.1).
(String, AppStatusTone) _withdrawalStatusDisplay(WithdrawalStatus status) {
  switch (status) {
    case WithdrawalStatus.pending:
      return ('Kutilmoqda', AppStatusTone.warning);
    case WithdrawalStatus.approved:
      return ('Tasdiqlandi', AppStatusTone.success);
    case WithdrawalStatus.rejected:
      return ('Rad etildi', AppStatusTone.danger);
    case WithdrawalStatus.paid:
      return ("To'landi", AppStatusTone.success);
  }
}

/// Ro'yxat sarlavhasi — qatlamli fon (`kSurface2`) ustida, kartadan
/// TASHQARIDA turadi, shunda u guruh nomi bo'lib o'qiladi.
class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace2, kSpace4, kSpace3),
      child: Text(
        title,
        style: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: kFontTitle,
          color: kInk,
        ),
      ),
    );
  }
}

/// Hamyon qoldig'i — hero ichidagi bitta blok.
///
/// Ma'no hech qachon faqat rangda qolmaydi: qarz holatida yorliq "Qarz" ga,
/// ikonka esa ogohlantirishga o'zgaradi (WCAG 1.4.1).
///
/// ⚠️ QARZ BLOKI SHAFFOF YUZADA CHIZILMAYDI. Oddiy holatda blok foni
/// `kOnPrimary` 10% — u gradient ustida suzadi va rangi kartaning qayerida
/// turishiga qarab o'zgaradi (#273238 … #344E44). Oq raqam u yerda 13.13:1 …
/// 9.05:1, ya'ni xavfsiz. Qizil esa xavfsiz EMAS: kErrorDark o'sha blokda
/// 4.53:1 dan 3.12:1 gacha tushadi. Qarz — bu ekrandagi eng oqibatli fakt
/// (u haydovchini onlayn chiqishdan to'sadi), shuning uchun u gradientga
/// UMUMAN bog'liq bo'lmagan OPAQ `kErrorLight` yuzaga ko'chiriladi:
/// kErrorDeep matn 5.91:1, kInk yorliq 16.0:1 — kartaning istalgan joyida
/// bir xil. Yon ta'siri ham foydali: siyoh karta ustidagi yagona yorug'
/// blok 1,5 soniyalik qarashda birinchi bo'lib ko'zga tashlanadi.
class _WalletRow extends StatelessWidget {
  const _WalletRow({required this.balance, required this.isDebt});

  final double balance;
  final bool isDebt;

  static const String _debtConsequence =
      "Naqd safarlar komissiyasi. Qarz yopilmaguncha onlayn chiqib "
      "bo'lmaydi.";

  @override
  Widget build(BuildContext context) {
    final Color surface =
        isDebt ? kErrorLight : kOnPrimary.withValues(alpha: 0.1);
    final Color labelColor =
        isDebt ? kInk : kOnPrimary.withValues(alpha: 0.78);
    final Color valueColor = isDebt ? kErrorDeep : kOnPrimary;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  isDebt
                      ? Icons.warning_amber_rounded
                      : Icons.account_balance_wallet_outlined,
                  size: 18,
                  color: isDebt
                      ? kErrorDeep
                      : kOnPrimary.withValues(alpha: 0.78),
                ),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  isDebt ? 'Qarz' : 'Hamyon',
                  style: TextStyle(
                    color: labelColor,
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                Formatters.formatPrice(balance),
                style: TextStyle(
                  color: valueColor,
                  fontSize: kFontBodyLg,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (isDebt) ...[
            const SizedBox(height: kSpace2),
            const Text(
              _debtConsequence,
              style: TextStyle(
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
                // Yorug' yuzada — kErrorDeep (kErrorLight ustida 5.91:1).
                color: kErrorDeep,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Hero ichidagi hisob qatori: "yorliq .......... qiymat".
class _LedgerRow extends StatelessWidget {
  const _LedgerRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
    this.valueKey,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: kSpace1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                // Siyoh yuzada ikkilamchi matn — 0.78 shaffoflik (≈10:1).
                // kInkMuted bu yerda ISHLAMAYDI: u yorug' fon uchun.
                color: kOnPrimary.withValues(alpha: 0.78),
                fontSize: kFontLabel,
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          Text(
            value,
            key: valueKey,
            style: TextStyle(
              fontSize: bold ? kFontBodyLg : kFontBody,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
              color: valueColor ?? kOnPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _WithdrawalCard extends StatelessWidget {
  const _WithdrawalCard({required this.withdrawal});

  final WithdrawalRequest withdrawal;

  @override
  Widget build(BuildContext context) {
    final (statusLabel, statusTone) =
        _withdrawalStatusDisplay(withdrawal.status);
    return Padding(
      key: ValueKey('withdrawal_${withdrawal.id}'),
      padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace2),
      child: AgSurfaceCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Formatters.formatPrice(withdrawal.amount),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: kFontBodyLg,
                      color: kInk,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    withdrawal.payoutDestination,
                    style: const TextStyle(
                      color: kInkMuted,
                      // 11dp (kFontMicro) mashinadan o'qilmaydi — bu
                      // ekrandagi barcha ikkilamchi matn kabi bir pog'ona
                      // yuqori.
                      fontSize: kFontCaption,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    Formatters.formatRelativeDate(withdrawal.requestedAt),
                    style: const TextStyle(
                      color: kInkMuted,
                      // 11dp (kFontMicro) mashinadan o'qilmaydi — bu
                      // ekrandagi barcha ikkilamchi matn kabi bir pog'ona
                      // yuqori.
                      fontSize: kFontCaption,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: kSpace3),
            AppStatusBadge(label: statusLabel, tone: statusTone),
          ],
        ),
      ),
    );
  }
}

class _DriverOrderCard extends StatelessWidget {
  const _DriverOrderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace2),
      child: AgSurfaceCard(
        child: Row(
          children: [
            ExcludeSemantics(
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: order.status == OrderStatus.completed
                      ? kMintTint
                      : kErrorLight,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                ),
                child: Icon(
                  order.status == OrderStatus.completed
                      ? Icons.check_circle_outline
                      : Icons.cancel_outlined,
                  // Tint yuzada ikona kPrimary/kErrorDeep — mint 2.12:1.
                  color: order.status == OrderStatus.completed
                      ? kPrimary
                      : kErrorDeep,
                  size: 22,
                ),
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.dropoff.address,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: kFontBody,
                      color: kInk,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    Formatters.formatRelativeDate(order.createdAt),
                    style: const TextStyle(
                      color: kInkMuted,
                      // 11dp (kFontMicro) mashinadan o'qilmaydi — bu
                      // ekrandagi barcha ikkilamchi matn kabi bir pog'ona
                      // yuqori.
                      fontSize: kFontCaption,
                    ),
                  ),
                ],
              ),
            ),
            if (order.status == OrderStatus.completed) ...[
              const SizedBox(width: kSpace3),
              Text(
                Formatters.formatPrice(
                  order.actualPrice ?? order.estimatedPrice,
                ),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontBodyLg,
                  color: kPrimary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// A single bonus rule's progress bar + reward amount on the earnings
// screen's bonus section.
class _BonusProgressTile extends StatelessWidget {
  const _BonusProgressTile({required this.bonus});

  final DriverBonusProgress bonus;

  @override
  Widget build(BuildContext context) {
    final isComplete = bonus.currentCount >= bonus.tripThreshold;
    return Padding(
      key: ValueKey('bonus_progress_${bonus.ruleId}'),
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  bonus.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontBody,
                    color: kInk,
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Text(
                '+${Formatters.formatPrice(bonus.bonusAmount)}',
                style: const TextStyle(
                  // Oq fonda muvaffaqiyat MATNI — kPrimary.
                  color: kPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: kFontBody,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace2),
          ClipRRect(
            borderRadius: BorderRadius.circular(kRadiusXs),
            child: LinearProgressIndicator(
              value: bonus.progressFraction,
              // Chiziq balandligi 10dp: mashinadan qaraganda 8dp chiziq
              // "bor-yo'qligi" bilinmaydi.
              minHeight: 10,
              backgroundColor: kSurface2,
              // Progress = interaktiv qatlam; tugallanganda to'qroq.
              valueColor: AlwaysStoppedAnimation<Color>(
                isComplete ? kPrimaryPressed : kPrimary,
              ),
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            '${bonus.currentCount}/${bonus.tripThreshold} safar',
            style: const TextStyle(color: kInkMuted, fontSize: kFontCaption),
          ),
        ],
      ),
    );
  }
}
