import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// QATLAMLI TUZILMANING IKKI ASOSI — xarita ustidagi suzuvchi tugma va
// sheet ichidagi oq karta.
//
// Yandex Go ning tuzilma tili "chegara bilan ajratish" emas, "QATLAM bilan
// ajratish" ustiga qurilgan. Ekranda uch qatlam bor:
//   1. xarita        — eng past, hech narsa yopmaydi
//   2. suzuvchi tugma — xarita USTIDA, soya bilan uziladi (`AgMapFab`)
//   3. sheet         — eng yuqori, ichida oq kartalar (`AgSurfaceCard`)
//
// Ikkalasi bitta faylda, chunki ikkalasi ham juda kichik va faqat shu
// qatlamli tuzilma kontekstida ma'no kasb etadi — alohida fayl ochish
// import shovqinini oshiradi, foydani emas.
//
// Ranglar o'zgarmaydi: kanonik `k*` tokenlar (`app_theme.dart`). Bu yerda
// faqat KOMPOZITSIYA yangi.
// ============================================================================

// O'lchamlar mahalliy konstantalarda: bular shkala tokenlari emas, aynan
// shu komponentning geometriyasi (`kSpace*` bo'lsa ular tokendan olinardi).
// Sabab bilan yozilgani muhim — keyingi o'quvchi raqamni "shunchaki chiroyli"
// deb o'zgartirib yubormasligi kerak.

/// Ikkilamchi tugma diametri. `kMinTapTarget` (48dp) dan kichik ATAYLAB:
/// xaritada bunday tugmalar zanjir bo'lib turadi va 48dp doiralar ko'rinishni
/// haddan tashqari yopadi. Tegish maydoni pastda baribir 48dp ga kengaytiriladi.
const double _kFabSize = 44;

/// Asosiy tugma (xaritani markazlashtirish) diametri — ierarxiya rangda emas,
/// O'LCHAMDA beriladi, chunki xarita foni ustida rang farqi ishonchsiz.
const double _kFabSizeLarge = 48;

const double _kFabIconSize = 20;
const double _kFabIconSizeLarge = 22;

/// Nuqta diametri. 2dp oq halqadan keyin ichkarida 6dp rangli yadro qoladi —
/// bundan kichigi xarita ustida dog'ga o'xshab ko'rinmay qoladi.
const double _kBadgeDotSize = 10;

/// Nuqta atrofidagi `kSurface` halqa — doira chegarasi bilan qo'shilib
/// ketmasligi uchun.
const double _kBadgeRingWidth = 2;

/// Xarita ustida suzuvchi doira tugma (markazlashtirish, ulashish, SOS).
///
/// ```dart
/// AgMapFab(
///   icon: Icons.my_location,
///   semanticsLabel: 'Meni topish',
///   onTap: _centerOnUser,
/// )
/// ```
///
/// **Nega `kLineInteractive`, `kLine` emas.** Bu tugma XARITA ustida turadi
/// — orqa fon oldindan noma'lum (yo'l, ko'k suv, yashil park, sun'iy yo'ldosh
/// tasviri). Oq doira yorqin fonda "yo'qoladi", shuning uchun uni fondan
/// ajratuvchi ikkita mustaqil vosita kerak: soya (`kShadowPop`) va chegara.
/// Soya yolg'iz yetarli emas — u och fonda deyarli ko'rinmaydi. `kLine`
/// (oq ustida 1.22:1) bezak ajratkichi bo'lgani uchun bu vazifani bajara
/// olmaydi; WCAG 1.4.11 boshqaruvni ANIQLASH uchun 3:1 talab qiladi va
/// `kLineInteractive` (3.67:1) shuni beradi.
///
/// **Nega vizual o'lcham 44dp, tegish maydoni 48dp.** Xaritada bir nechta
/// tugma ustma-ust turadi; 48dp doiralar zanjiri xarita ko'rinishini
/// haddan tashqari yopadi. Vizual doira 44dp qoladi, tegish maydoni esa
/// `kMinTapTarget` gacha kengaytiriladi — ko'z kichik ko'radi, barmoq
/// kattaga tegadi.
class AgMapFab extends StatelessWidget {
  const AgMapFab({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.large = false,
    this.badge = false,
  });

  final IconData icon;

  final VoidCallback onTap;

  /// Ekran o'quvchi uchun nom. Ikonka YOLG'IZ turgani uchun MAJBURIY —
  /// aks holda tugma "tugma" deb o'qiladi-yu, nima qilishi aytilmaydi.
  final String semanticsLabel;

  /// Asosiy harakat (xaritani markazlashtirish) uchun 48dp doira.
  /// Ikkilamchi tugmalar 44dp bo'lib qoladi — ierarxiya o'lchamda beriladi.
  final bool large;

  /// O'ng yuqorida `kError` nuqta — "e'tibor talab qiladi" belgisi.
  ///
  /// Ataylab `bool`, matn emas: xarita ustidagi tugmada raqam o'qilmaydi
  /// (fon tinch emas) va u yerda hisob KERAK ham emas — nuqta faqat
  /// "shu yerga qara" deydi, tafsilot bosgandan keyin ochiladi.
  ///
  /// Yoqilganda `semanticsLabel` ga holat qo'shiladi — nuqta ekran
  /// o'quvchidan yashirin qolmasligi uchun.
  final bool badge;

  @override
  Widget build(BuildContext context) {
    final double size = large ? _kFabSizeLarge : _kFabSize;
    // Vizual doira 48dp dan kichik bo'lsa, tegish maydoni kengaytiriladi.
    final double tapSize = size < kMinTapTarget ? kMinTapTarget : size;

    return AppPressable(
      onTap: onTap,
      // Nuqta faqat VIZUAL ishora — ekran o'quvchi uni umuman ko'rmaydi.
      // Shu sababli holat yorliqqa qo'shiladi: aks holda ko'rmaydigan
      // foydalanuvchi uchun badge mavjud emas va u "e'tibor talab
      // qilinayotganini" hech qachon bilmaydi.
      semanticsLabel:
          badge ? '$semanticsLabel, e\'tibor talab qiladi' : semanticsLabel,
      // Kichik element uchun 0.97 sezilmaydi — doira uchun kuchliroq masshtab.
      pressedScale: 0.92,
      // Tegish maydonini o'zimiz beramiz: `AppPressable` faqat balandlikni
      // cheklaydi, bu yerda esa kenglik ham 48dp bo'lishi kerak.
      minTapTarget: false,
      child: SizedBox(
        width: tapSize,
        height: tapSize,
        child: Center(
          child: Stack(
            // Nuqta doira chekkasida turadi — kesilmasligi kerak.
            clipBehavior: Clip.none,
            children: [
              Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: kSurface,
                  shape: BoxShape.circle,
                  border: Border.all(color: kLineInteractive),
                  boxShadow: kShadowPop,
                ),
                child: Icon(
                  icon,
                  size: large ? _kFabIconSizeLarge : _kFabIconSize,
                  color: kInk,
                ),
              ),
              if (badge)
                // 45° burchakda — doiraning bounding box burchagi doira
                // chetidan tashqarida qoladi, `top/right: 0` esa nuqtani
                // aynan doira konturiga o'tirg'izadi.
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    width: _kBadgeDotSize,
                    height: _kBadgeDotSize,
                    decoration: BoxDecoration(
                      color: kError,
                      shape: BoxShape.circle,
                      // Oq halqa nuqtani doira konturidan uzadi — aks holda
                      // ikki chegara qo'shilib, dog' kabi ko'rinadi.
                      border: Border.all(
                        color: kSurface,
                        width: _kBadgeRingWidth,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Qatlamli sheet ichidagi oq karta — CHEGARASIZ.
///
/// ```dart
/// ColoredBox(
///   color: kSurface2,          // sheet foni
///   child: Column(children: [
///     AgSurfaceCard(child: PriceRow()),
///     SizedBox(height: kSpace2),
///     AgSurfaceCard(child: PaymentRow()),
///   ]),
/// )
/// ```
///
/// **Nega chegara YO'Q.** Bu karta `kSurface2` (#EDF3F4) fonli sheet ichida
/// yashaydi — fon farqi ajratishni allaqachon beradi va guruhlash uchun
/// SHU yetarli. Chegara qo'shilsa, bitta sheetda 4-5 ta karta bo'lganda
/// ekran to'rga aylanadi: ko'z kontentni emas, ramkalarni o'qiy boshlaydi.
/// Yandex Go ning qatlamli tili aynan shuni — "chegara emas, yuza" ni —
/// tanlagan, chunki xarita ustidagi sheet allaqachon vizual jihatdan
/// zich va har bir qo'shimcha chiziq shovqin.
///
/// ⚠️ Farq nozik (#FFFFFF ga nisbatan 1.12:1) va bu ATAYLAB shunday —
/// bu GURUHLASH ishorasi, boshqaruv chegarasi emas. Karta BOSILADIGAN
/// bo'lsa, WCAG 1.4.11 kuchga kiradi: u holda kartani `AppPressable` ga
/// o'rang (masshtab + haptika javob beradi) yoki `kLineInteractive`
/// chegarali alohida komponent ishlating — bu karta o'zi interaktivlikni
/// bildirmaydi.
///
/// Karta oq bo'lmagan yuzada (masalan `kBackground` ustida) ishlatilsa,
/// ajratish yo'qoladi — `background` ni o'zgartiring yoki soyali
/// komponentga o'ting.
class AgSurfaceCard extends StatelessWidget {
  const AgSurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(kSpace4),
    this.background = kSurface,
  });

  final Widget child;

  final EdgeInsetsGeometry padding;

  /// Odatda `kSurface`. `kSurface2` fonli sheet ichida `kSurface3` ga
  /// o'tkazish mumkin — muhimi, karta va sheet BIR XIL bo'lmasin.
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: child,
    );
  }
}
