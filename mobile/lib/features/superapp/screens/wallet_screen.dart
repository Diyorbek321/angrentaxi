import 'package:angren_taxi/features/superapp/models/wallet_transaction.dart';
import 'package:angren_taxi/features/superapp/screens/topup_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// HAMYON — qatlamli yuza va bitta hamyon qoidasi.
//
// QATLAM. Ekran foni `agSurface2` (#EDF3F4), ichidagi bloklar esa oq va
// CHEGARASIZ `AgSurfaceCard`. Ilgari fon `agBg` edi va har bir blok o'z
// soyasini ko'tarib yurardi — beshta soyali quti bitta ro'yxatda ko'zni
// charchatadi. Endi ajratishni FON farqi beradi, soya emas: bu til
// yo'lovchi va haydovchi ekranlarida allaqachon bor, super-app undan
// ajralib qolmasligi kerak.
//
// BITTA HAMYON. Taksi, yuk, ovqat va market — hammasi BITTA balansdan
// to'lanadi va bitta daftarga yoziladi. Shu sababli bu ekranda xizmat
// bo'yicha tab, filtr yoki alohida ro'yxat YO'Q va bo'lmasligi kerak:
// safar to'lovi, hisob to'ldirish va pul yechish bitta uzluksiz oqimda,
// serverdan kelgan tartibda turadi. Xizmatga bo'lingan hamyon
// foydalanuvchini "qaysi hamyonda pulim bor?" degan savolga majbur qiladi
// — bu savolning javobi bo'lmasligi kerak.
// ============================================================================

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  @override
  void initState() {
    super.initState();
    // Always re-read on open: the balance may have moved since the home tab
    // last fetched it (an order was paid, a withdrawal cleared, ...).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final superapp = context.read<SuperappProvider>();
      superapp.loadWalletBalance();
      superapp.loadTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final superapp = context.watch<SuperappProvider>();
    final balance = superapp.walletBalance;
    final walletError = superapp.walletError;
    final transactions = superapp.transactions;
    final loadingTxns = superapp.isTransactionsLoading && transactions.isEmpty;

    return Scaffold(
      // QATLAM 1 — ekran foni. Oq emas: ustidagi oq kartalar aynan shu
      // farq hisobiga chegarasiz ajralib turadi.
      backgroundColor: agSurface2,
      body: Column(
        children: [
          AgHeader(title: 'Hamyon', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                kSpace4,
                kSpace5,
                kSpace4,
                kSpace6,
              ),
              children: [
                _BalanceCard(
                  balance: balance,
                  onTopUp: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const TopUpScreen()),
                  ),
                ),
                if (balance == null && walletError != null) ...[
                  const SizedBox(height: kSpace3),
                  // Matn o'zgarmaydi — faqat umumiy `InlineErrorWidget`
                  // ko'rinishiga (kErrorDeep matn, 6.47:1) o'tkazildi.
                  // O'z yuzasi (kErrorLight + chegara) bor, shuning uchun
                  // `AgSurfaceCard` ichiga solinmaydi.
                  InlineErrorWidget(
                    message: walletError,
                    onRetry: () => superapp.loadWalletBalance(),
                  ),
                ],
                const SizedBox(height: kSpace6),
                const AgSectionTitle('Kartalar'),
                const SizedBox(height: kSpace3),
                // Saved cards need a Payme/Click merchant agreement before a
                // card can be bound and charged. Until then the screen says so
                // plainly instead of showing two invented cards ("Uzcard 8600
                // •••• 4421") that belonged to nobody and could not be used.
                const _CardsUnavailableNotice(),
                const SizedBox(height: kSpace6),
                const AgSectionTitle('So\'nggi amallar'),
                const SizedBox(height: 2),
                // Bitta hamyon qoidasini YOZIB qo'yamiz. Aks holda
                // foydalanuvchi ro'yxatda taksi va ovqat qatorlarini
                // aralash ko'rib, "bu qaysi hisob?" deb o'ylaydi.
                const Text(
                  'Taksi, yuk, ovqat va market — bitta hamyon, bitta daftar.',
                  style: TextStyle(
                    fontSize: kFontCaption,
                    fontWeight: FontWeight.w600,
                    // Kichik yozuv: `kInkMuted` (5.47:1). `kInkSubtle`
                    // yozuvda ishlatilmaydi.
                    color: agSubtle,
                  ),
                ),
                const SizedBox(height: kSpace3),
                if (loadingTxns)
                  const AgSurfaceCard(
                    padding: EdgeInsets.symmetric(vertical: kSpace2),
                    child: AppSkeletonList(
                      itemCount: 3,
                      hasTrailing: true,
                      padding: EdgeInsets.symmetric(
                        horizontal: kSpace4,
                        vertical: kSpace2,
                      ),
                    ),
                  )
                else if (superapp.transactionsError != null &&
                    transactions.isEmpty)
                  InlineErrorWidget(
                    message: superapp.transactionsError!,
                    onRetry: () => superapp.loadTransactions(),
                  )
                else if (transactions.isEmpty)
                  const _NoTransactions()
                else
                  AgSurfaceCard(
                    // Vertikal bo'shliqni qatorlarning o'zi beradi —
                    // shuning uchun kartada faqat yon gutter.
                    padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                    child: Column(
                      children: [
                        for (var i = 0; i < transactions.length; i++)
                          _TxnRow(
                            txn: transactions[i],
                            last: i == transactions.length - 1,
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Balans hero kartasi — ekrandagi ENG ishonchli element.
///
/// **Nega tekis `agInk`, gradient emas.** Ilgari bu karta `kGradientInk`
/// (#0F1B22 → #1D3A2F) edi. Gradientning och uchida oq matn 12.36:1 —
/// AA dan ancha yuqori, lekin BIR XIL emas: raqam kartaning qayerida
/// turishiga qarab kontrast o'zgaradi. Pul raqami — foydalanuvchi eng
/// ko'p ishonadigan va eng tez o'qiydigan element, shuning uchun u
/// tizimdagi ENG YUQORI kontrastni oladi: tekis `kInk` ustida oq matn
/// 17.5:1, kartaning har bir nuqtasida bir xil.
class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance, required this.onTopUp});

  /// `null` while loading or after a failed load — shown as a placeholder so
  /// the passenger is never given a fabricated figure.
  final double? balance;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) {
    final amount = balance == null ? '—' : Formatters.formatAmount(balance!);

    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        color: agInk,
        borderRadius: BorderRadius.circular(kRadiusXl),
        boxShadow: agInkShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Semantika FAQAT O'QILADIGAN qismni o'raydi.
          //
          // ⚠️ Ilgari bu `Semantics(excludeSemantics: true)` butun kartani
          // o'rab turardi — natijada ostidagi "To'ldirish" tugmasi ekran
          // o'quvchi uchun BUTUNLAY yo'qolgan edi (`excludeSemantics`
          // avlodlarning barcha tugunlarini tashlab yuboradi). Endi u
          // sarlavha + raqamni bitta jumlaga birlashtiradi, tugmalar esa
          // o'z tugunlari bilan tashqarida qoladi.
          Semantics(
            container: true,
            label: balance == null
                ? 'Hamyon balansi hali yuklanmadi'
                : "Hamyon balansi $amount so'm",
            excludeSemantics: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Angren Go balans',
                      style: TextStyle(
                        color: agOnPrimary.withValues(alpha: 0.75),
                        fontSize: kFontLabel,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    // "Bitta hamyon" ishorasi kartaning o'zida: balans qaysi
                    // xizmatga tegishli degan savol tug'ilmasligi uchun.
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: kSpace2,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: agOnPrimary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(kRadiusFull),
                      ),
                      child: Text(
                        'Barcha xizmatlar',
                        style: TextStyle(
                          color: agOnPrimary.withValues(alpha: 0.85),
                          fontSize: kFontMicro,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: kSpace1 + 2),
                // Pul formati: yirik va INGICHKA raqam + kichik harfli birlik.
                // Qalin (w800) raqam bu o'lchamda "baqiradi"; w700 esa
                // sarlavhadek tinch o'qiladi va e'tiborni O'LCHAM ushlaydi.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        amount,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: agOnPrimary,
                          // Shkaladagi eng katta o'lcham — ekranda bundan
                          // yirikroq matn yo'q, ierarxiya shundan aniq.
                          fontSize: kFontDisplay,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -1,
                        ),
                      ),
                    ),
                    const SizedBox(width: kSpace1 + 2),
                    Text(
                      "so'm",
                      style: TextStyle(
                        color: agOnPrimary.withValues(alpha: 0.7),
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: kSpace5),
          Row(
            children: [
              Expanded(
                child: Semantics(
                  // `container: true` bo'lmasa bu yorliq yonidagi
                  // "O'tkazish" matni bilan BITTA tugunga qo'shilib
                  // ketadi va ekran o'quvchi "To'ldirish O'tkazish" degan
                  // bitta tugmani e'lon qiladi. Chegara qo'yilgani uchun
                  // ishlaydigan tugma o'z tuguniga ega.
                  container: true,
                  button: true,
                  label: "To'ldirish",
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: onTopUp,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: kMinTapTarget,
                        minWidth: kMinTapTarget,
                      ),
                      height: kControlHeightSm,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: agBright,
                        borderRadius: BorderRadius.circular(kRadiusSm),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ExcludeSemantics(
                            child: Icon(Icons.add_rounded,
                                color: agOnMint, size: 19),
                          ),
                          SizedBox(width: kSpace2),
                          Text("To'ldirish",
                              style: TextStyle(
                                  color: agOnMint,
                                  fontSize: kFontLabel,
                                  fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                // ⚠️ "O'tkazish" hozircha HECH QAYERGA olib bormaydi —
                // `onTap` yo'q, bu qayta qurishdan OLDIN ham shunday edi.
                // Ataylab `Semantics(button: true)` QO'YILMAYDI: ekran
                // o'quvchiga ishlamaydigan tugmani "tugma" deb e'lon qilish
                // mavjud holatdan ham yomonroq bo'lardi. To'g'ri yechim —
                // pul o'tkazish oqimini ulash yoki elementni olib tashlash;
                // ikkalasi ham mantiq o'zgarishi, shuning uchun bu yerda
                // emas.
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: kMinTapTarget,
                    minWidth: kMinTapTarget,
                  ),
                  height: kControlHeightSm,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: agOnPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.north_east_rounded,
                            color: agOnPrimary, size: 19),
                      ),
                      SizedBox(width: kSpace2),
                      Text("O'tkazish",
                          style: TextStyle(
                              color: agOnPrimary,
                              fontSize: kFontLabel,
                              fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardsUnavailableNotice extends StatelessWidget {
  const _CardsUnavailableNotice();

  @override
  Widget build(BuildContext context) {
    return const AgSurfaceCard(
      child: Row(
        children: [
          ExcludeSemantics(
            child: _RowIcon(
              icon: Icons.credit_card_off_rounded,
              // Dekorativ ikonka — `kInkSubtle` (3.67:1) UI elementi
              // sifatida ruxsat etilgan, yozuvda esa yo'q.
              color: agMuted,
            ),
          ),
          SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Karta bog\'lash hali mavjud emas',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontBody,
                    color: agText,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Hozircha safarlarni naqd pul yoki hamyon balansi bilan to\'lang.',
                  style: TextStyle(
                    fontSize: kFontCaption,
                    color: agSubtle,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NoTransactions extends StatelessWidget {
  const _NoTransactions();

  @override
  Widget build(BuildContext context) {
    return const AgSurfaceCard(
      padding: EdgeInsets.symmetric(vertical: kSpace6, horizontal: kSpace4),
      child: Column(
        children: [
          ExcludeSemantics(
            child: Icon(Icons.receipt_long_rounded, size: 34, color: agMuted),
          ),
          SizedBox(height: kSpace2),
          Text(
            'Hozircha amallar yo\'q',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: kFontBody,
              color: agText,
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Birinchi safar yoki to\'ldirishdan keyin bu yerda ko\'rinadi.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: kFontCaption,
              color: agSubtle,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Daftar qatori va "karta yo'q" bloki uchun bir xil 40dp ikonka uyasi.
///
/// Oq karta ichida turgani uchun uya foni `agSurface2` — ekran foni bilan
/// bir xil rang, ya'ni qatlam tili bu yerda ham davom etadi.
class _RowIcon extends StatelessWidget {
  const _RowIcon({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: agSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Icon(icon, size: 21, color: color),
    );
  }
}

/// Daftarning bitta qatori — taksi, ovqat, market yoki to'ldirish, farqi yo'q.
///
/// **Yo'nalish UCH signal bilan beriladi.** Rang yolg'iz yetarli emas:
/// rang ajratolmaydigan foydalanuvchi uchun yashil va qora bir xil.
/// Shuning uchun har qatorda birga turadi:
///   1. ISHORA — `+` yoki `−` (matnning o'zida, ko'chiriladi ham);
///   2. RANG — kirim `kPrimary`, chiqim `kInk`;
///   3. SO'Z — semantika yorlig'ida "kirim" / "chiqim", ekran o'quvchi uchun.
class _TxnRow extends StatelessWidget {
  const _TxnRow({required this.txn, this.last = false});

  final WalletTransaction txn;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final icon = txn.isCredit
        ? Icons.add_rounded
        : (txn.orderId != null
              ? Icons.local_taxi_rounded
              : Icons.north_east_rounded);

    // A pending row has not moved the balance yet, so it must not be coloured
    // like settled money.
    final amountColor = txn.isPending
        ? agSubtle
        : (txn.isCredit ? agGreenText : agText);

    final sign = txn.isCredit ? '+' : '−';
    final when = Formatters.formatDateTime(txn.createdAt);
    final subtitle = txn.isPending ? '$when · kutilmoqda' : when;
    final direction = txn.isCredit ? 'kirim' : 'chiqim';

    return Semantics(
      container: true,
      label: '${txn.title}, '
          "${Formatters.formatAmount(txn.amount)} so'm $direction, "
          '$subtitle',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: kSpace3),
        decoration: BoxDecoration(
          border:
              last ? null : const Border(bottom: BorderSide(color: agDivider)),
        ),
        child: Row(
          children: [
            _RowIcon(
              icon: icon,
              color: txn.isCredit && !txn.isPending ? agGreenText : agSubtle,
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    txn.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: kFontBody,
                      color: agText,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: kFontCaption,
                      color: agSubtle,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: kSpace2),
            Text(
              '$sign${Formatters.formatAmount(txn.amount)}',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: kFontBody,
                color: amountColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
