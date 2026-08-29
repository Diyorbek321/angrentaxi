import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// DAROMAD HERO — haydovchi bosh ekranidagi ENG KATTA element.
//
// NEGA TO'Q SIYOH GRADIENT (`kGradientInk`), oq karta emas:
//   · quyosh aksi ostida oq yuza yuvilib ketadi va undagi qora matn
//     yo'qoladi; to'q yuza esa aksincha, aks yorug'likni yutadi. Haydovchi
//     bu raqamni kunduzi, ochiq derazadan tushayotgan yorug'likda o'qiydi;
//   · sheetdagi qolgan hamma narsa oq (`AgSurfaceCard`), shuning uchun
//     to'q blok birinchi bo'lib ko'zga tushadi — ierarxiya KONTRASTDAN
//     keladi, o'lchamdan emas.
//
// NEGA `kGradientCta` EMAS: yashil CTA gradienti — HARAKAT rangi. Bu karta
// harakat emas, MA'LUMOT; agar u ham yashil bo'lsa, pastdagi asosiy tugma
// bilan raqobatlashib, "qaysi biri tugma?" degan savol tug'ilardi.
//
// KONTRAST:
//   oq matn (`kOnPrimary`) siyoh ustida  → 17.5:1  (asosiy raqam)
//   `kMintSoft` siyoh ustida             → 11.22:1 (yordamchi ko'rsatkich)
// Ikkalasi ham AAA'dan yuqori — yordamchi raqamlar ham quyoshda o'qiladi.
// ============================================================================

/// "Jonli" nuqta diametri.
///
/// Shkalada bu o'lcham yo'q, chunki u boshqaruv ham, bo'shliq ham emas —
/// bu holat NUQTASI. 8dp dan kichigi to'q fonda ko'rinmay qoladi, kattasi
/// esa yonidagi yozuv bilan bir vaznga chiqib, "Online" so'zini bosadi.
const double _kStatusDotSize = 9;

/// Bonus chizig'ining qalinligi. Ingichka chiziq harakatdagi mashinada
/// umuman ilg'anmaydi; 8dp — "to'lgan/to'lmagan" farqini bir qarashda
/// beradigan eng kichik qalinlik.
const double _kBonusBarHeight = 8;

/// Yordamchi ko'rsatkich ikonkasi. `kFontLabel` (13) yozuv bilan bir
/// qatorda turadi, shuning uchun shkaladagi 20dp standart ikonkadan kichik.
const double _kMetricIconSize = 15;

/// Siyoh fondagi ajratkich va chiziq yo'lagining shaffofligi.
///
/// `kLine`/`kLineStrong` bu yerda YARAMAYDI — ular OQ yuza uchun
/// tanlangan va to'q siyoh ustida deyarli ko'rinmaydi. Shuning uchun
/// ajratkich fon rangidan emas, ustidagi OQ matndan hosil qilinadi.
const double _kOnInkDividerAlpha = 0.16;
const double _kOnInkTrackAlpha = 0.18;

/// Kunlik daromad kartasi — safar soni, haftalik daromad va haftalik
/// bonus chizig'i bilan.
///
/// ⚠️ Hech qanday raqamni O'ZI HISOBLAMAYDI: hammasi serverdan kelgan
/// qiymatlar. Bu karta faqat ko'rsatadi.
class DriverEarningsHero extends StatefulWidget {
  const DriverEarningsHero({
    super.key,
    required this.todayEarnings,
    required this.todayTrips,
    required this.weekNet,
    required this.isOnline,
    required this.onTap,
    this.bonus,
  });

  /// Bugungi daromad — kartaning asosiy raqami.
  final double todayEarnings;

  /// Bugun bajarilgan safarlar soni.
  final int todayTrips;

  /// So'nggi 7 kunlik SOF daromad (komissiya ayirilgan).
  final double weekNet;

  final bool isOnline;

  /// Haftalik maqsad bonusi. `null` bo'lsa chiziq umuman chizilmaydi —
  /// bo'sh yo'lak "sizda bonus yo'q" emas, "bonus nolda" deb o'qilardi.
  final DriverBonusProgress? bonus;

  /// Odatda daromad tarixiga o'tish.
  final VoidCallback onTap;

  @override
  State<DriverEarningsHero> createState() => _DriverEarningsHeroState();
}

class _DriverEarningsHeroState extends State<DriverEarningsHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // `AppMotion.reduced` — `MediaQuery` ga bog'liq, shuning uchun puls
    // aynan shu yerdan boshqariladi.
    _syncPulse();
  }

  @override
  void didUpdateWidget(covariant DriverEarningsHero oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isOnline != widget.isOnline) _syncPulse();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  /// Puls FAQAT kerak bo'lganda aylanadi.
  ///
  /// ⚠️ To'xtatilmagan `repeat()` nuqta EKRANDA BO'LMASA ham tikerni har
  /// kadrda uyg'otib turadi: oflayn haydovchida ekranda hech narsa
  /// harakatlanmasa ham telefon 60 kadr/sek chizishda davom etardi.
  /// Haydovchi ilovasi butun smena davomida ochiq turadi va uning
  /// telefoni ayni paytda navigatsiya ham qiladi — bu quruq batareya
  /// sarfi. Shu sababli kontroller holat bilan birga yoqiladi va
  /// o'chiriladi (ko'rinish shartlari `_buildStatus` da o'sha-o'sha).
  void _syncPulse() {
    final shouldRun = widget.isOnline && !AppMotion.reduced(context);
    if (shouldRun && !_pulseController.isAnimating) {
      _pulseController.repeat(reverse: true);
    } else if (!shouldRun && _pulseController.isAnimating) {
      _pulseController.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bonus = widget.bonus;

    return AppPressable(
      onTap: widget.onTap,
      // Ekran o'quvchi uchun butun karta BITTA gap bo'lib o'qiladi —
      // ichidagi bo'laklar alohida-alohida o'qilsa, ma'no yo'qoladi.
      semanticsLabel: _semanticsLabel(bonus),
      // Karta katta — 0.97 masshtab bu o'lchamda "sakrash" bo'lib ko'rinadi.
      pressedScale: 0.99,
      minTapTarget: false,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          gradient: kGradientInk,
          borderRadius: BorderRadius.circular(kRadiusMd),
          boxShadow: kShadowInk,
        ),
        child: ExcludeSemantics(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Bugungi daromad',
                      style: TextStyle(
                        color: kMintSoft,
                        fontSize: kFontLabel,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  _buildStatus(),
                ],
              ),
              const SizedBox(height: kSpace1),
              _buildAmount(),
              const SizedBox(height: kSpace2),
              _buildMetrics(),
              if (bonus != null) ...[
                const SizedBox(height: kSpace3),
                Divider(
                  height: 1,
                  thickness: 1,
                  color: kOnPrimary.withValues(alpha: _kOnInkDividerAlpha),
                ),
                const SizedBox(height: kSpace3),
                _buildBonusLine(bonus),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Asosiy raqam va birlik AJRATILGAN: "so'm" ham 30dp bo'lsa, u raqam
  /// bilan bir vaznga chiqib, ko'z qayerga qarashini bilmay qoladi.
  Widget _buildAmount() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(
          child: Text(
            Formatters.formatAmount(widget.todayEarnings),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: kOnPrimary,
              // Shkaladagi ENG KATTA token — bu ekrandagi eng katta
              // element bo'lishi kerak.
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
              height: 1.1,
              letterSpacing: -0.5,
            ),
          ),
        ),
        const SizedBox(width: kSpace2),
        const Text(
          "so'm",
          style: TextStyle(
            color: kMintSoft,
            fontSize: kFontBodyLg,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  /// Yordamchi ko'rsatkichlar.
  ///
  /// ⚠️ Faqat HAQIQIY ma'lumot ko'rsatiladi: safar soni va haftalik sof
  /// daromad serverdan keladi. "Onlayn vaqti" va "qabul foizi" hozircha
  /// API'da YO'Q, shuning uchun ular chizilmaydi — soxta ko'rsatkich
  /// haydovchining pul haqidagi ishonchini butunlay buzadi.
  Widget _buildMetrics() {
    return Row(
      children: [
        _HeroMetric(
          icon: Icons.route_rounded,
          text: '${widget.todayTrips} ta safar',
        ),
        const SizedBox(width: kSpace4),
        Flexible(
          child: _HeroMetric(
            icon: Icons.calendar_view_week_rounded,
            text: 'Hafta: ${Formatters.formatAmount(widget.weekNet)}',
          ),
        ),
      ],
    );
  }

  /// Onlayn/oflayn belgisi — UCH mustaqil signal.
  ///
  /// Nuqta SHAKLI (to'la/kontur), RANG (`kMintSoft` / `kOnPrimary`) va
  /// MATN ("Online" / "Offline"). Rangni ajratmaydigan haydovchi ham,
  /// quyosh aksida kulrang tusga tushgan ekran ham holatni yo'qotmaydi
  /// (WCAG 1.4.1 — ma'no faqat rangda bo'lmasin).
  Widget _buildStatus() {
    final online = widget.isOnline;
    final color = online ? kMintSoft : kOnPrimary;
    final dot = Container(
      width: _kStatusDotSize,
      height: _kStatusDotSize,
      decoration: BoxDecoration(
        color: online ? color : null,
        shape: BoxShape.circle,
        border: online ? null : Border.all(color: color, width: 1.5),
      ),
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // "Jonli" puls faqat ONLAYN holatda va harakat kamaytirilmagan
        // bo'lsa: oflaynda pulsatsiya qiladigan narsa yo'q, tizim
        // sozlamasida esa u chalg'ituvchi (va haydovchi uchun bu
        // sozlama ayniqsa muhim).
        if (online && !AppMotion.reduced(context))
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) =>
                Transform.scale(scale: _pulseAnimation.value, child: child),
            child: dot,
          )
        else
          dot,
        const SizedBox(width: kSpace2),
        Text(
          online ? 'Online' : 'Offline',
          style: TextStyle(
            color: color,
            fontSize: kFontLabel,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------------
  // HAFTALIK BONUS — CHIZIQ, FOIZ EMAS.
  //
  // "80%" ni tushunish uchun haydovchi miyada bo'lish amalini bajarishi
  // kerak: 40 ta safarning 80 foizi nechta edi? "32/40" esa tayyor
  // javob beradi, yonidagi chiziq uni bir qarashda tasdiqlaydi, ostidagi
  // qator esa qolgan masofani ("Yana 8 ta safar") aytadi. Harakatdagi
  // mashinada hisob-kitobga vaqt yo'q.
  //
  // ⚠️ Chegara ham, summa ham SERVERDAN (`driver_bonus_progress.dart`) —
  // bu yerda hech narsa qattiq kodlanmagan.
  // ------------------------------------------------------------------
  Widget _buildBonusLine(DriverBonusProgress bonus) {
    final remaining = bonus.tripThreshold - bonus.currentCount;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                bonus.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: kMintSoft,
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: kSpace2),
            // Nisbat OQ va qalin: bu bonus blokining asosiy raqami.
            Text(
              '${bonus.currentCount}/${bonus.tripThreshold}',
              style: const TextStyle(
                color: kOnPrimary,
                fontSize: kFontBodyLg,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: kSpace2),
        ClipRRect(
          borderRadius: BorderRadius.circular(kRadiusFull),
          child: LinearProgressIndicator(
            value: bonus.progressFraction,
            minHeight: _kBonusBarHeight,
            // Yo'lak siyoh fonda ko'rinishi kerak, lekin to'lgan qismdan
            // sezilarli darajada past turishi shart — aks holda chiziq
            // butunlay "to'lgan" ko'rinadi.
            backgroundColor: kOnPrimary.withValues(alpha: _kOnInkTrackAlpha),
            valueColor: const AlwaysStoppedAnimation<Color>(kMintSoft),
          ),
        ),
        const SizedBox(height: kSpace2),
        Text(
          remaining > 0
              ? 'Yana $remaining ta safar — '
                  '${Formatters.formatSom(bonus.bonusAmount)}'
              : 'Bajarildi — ${Formatters.formatSom(bonus.bonusAmount)}',
          style: const TextStyle(
            color: kMintSoft,
            fontSize: kFontCaption,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  String _semanticsLabel(DriverBonusProgress? bonus) {
    final buffer = StringBuffer()
      ..write('Bugungi daromad ')
      ..write(Formatters.formatSom(widget.todayEarnings))
      ..write(', ${widget.todayTrips} ta safar')
      ..write(widget.isOnline ? ', online' : ', offline');
    if (bonus != null) {
      buffer.write(
        ', ${bonus.name}: ${bonus.tripThreshold} tadan '
        '${bonus.currentCount} ta bajarildi',
      );
    }
    buffer.write('. Daromad tarixini ochish');
    return buffer.toString();
  }
}

/// Hero ichidagi bitta yordamchi ko'rsatkich.
///
/// `kMintSoft` — siyoh ustida 11.22:1. Ikkilamchi bo'lsa ham AAA:
/// haydovchi bu raqamlarni ham quyoshda o'qiy olishi kerak. (`kInkSubtle`
/// kabi "bo'shashgan" rang bu yerda umuman ishlatilmaydi.)
class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: _kMetricIconSize, color: kMintSoft),
        const SizedBox(width: kSpace1 + 2),
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: kMintSoft,
              fontSize: kFontLabel,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
