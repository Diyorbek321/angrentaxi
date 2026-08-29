import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/screens/notifications_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/search_screen.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/service_catalog.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

// ============================================================================
// SUPER-APP BOSH EKRANI — TAKSI IMTIYOZLI.
//
// ⚠️ NEGA TO'RTTA TENG PLITKA OLIB TASHLANDI.
// Ilgari bu ekran taksi / ovqat / market / cargo ni bitta `Row` da TENG
// kvadrat qilib chizardi, pastida esa alohida "Qayoqqa boramiz?" CTA
// turardi — ya'ni taksi ikki marta, ikki xil joyda va boshqa hamma bilan
// bir xil vaznda ko'rinardi.
//
// Sessiyalarning katta qismi taksi. Yandex Go saboqi shu: asosiy vertikal
// tanlov EMAS, sukut bo'yicha YUZA bo'lishi kerak. Shuning uchun endi:
//   1. yuqorida bitta katta taksi bloki — manzil maydoni bilan,
//   2. pastida uchta KICHIK ikkilamchi xizmat (Yuk / Ovqat / Market),
//   3. faol buyurtma bo'lsa — xizmatdan qat'i nazar BITTA ko'rinishdagi
//      karta ikkalasining orasida.
//
// QATLAMLI YUZA. Ekran foni `kSurface2`, ichidagi bloklar `AgSurfaceCard`
// (oq, chegarasiz). Ikkalasi birga ishlaydi: farq fonda beriladi, ramkada
// emas — shu til endi yo'lovchi va haydovchi ekranlarida ham bor.
//
// ⚠️ SIGNAL YO'Q JOYI. Taksi blokida "yaqin atrofda N ta mashina" kabi
// jonli signal bo'lishi kerak edi, lekin ilovada bunday ma'lumot manbai
// YO'Q (`nearby drivers` endpointi ham, provider ham). O'ylab topilgan
// raqam yolg'on ishonch beradi, shuning uchun blok signalsiz qoldirildi.
// ============================================================================

/// Yashil header gradienti balandligi (xavfsiz zonadan pastda). Taksi
/// bloki uning pastki chekkasi USTIGA tushadi — shuning uchun gradient
/// blokning taxminan yarmigacha yetadi.
const double _kHeroGradientHeight = 148;

/// Ikkilamchi xizmat plitkasidagi ikonka o'lchami.
///
/// Ierarxiya rangda emas, O'LCHAMDA beriladi: taksi bloki 34dp li ikonka
/// nishoni, `kFontH3` sarlavha va 54dp li manzil maydonidan iborat; bu
/// plitkalar esa 24dp ikonka + `kFontCaption` yorliqdan. Rang bilan
/// ajratish ishonchsiz — to'rttala xizmatning rangi ham to'yingan.
const double _kSecondaryIconSize = 24;

/// Angren Go bosh ekrani — taksi imtiyozli hero, ikkilamchi xizmatlar
/// qatori, birlashtirilgan faol buyurtma kartasi va mashhur restoranlar.
class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final food = context.read<FoodProvider>();
      if (food.restaurants.isEmpty) food.loadRestaurants();
      final superapp = context.read<SuperappProvider>();
      if (superapp.walletBalance == null) superapp.loadWalletBalance();
      // Delivery fee comes from the server so the cart total always matches
      // what the order will actually be recorded as.
      superapp.loadPlatformSettings();
    });
  }

  void _openTaxi(BuildContext context) {
    context.read<OrderProvider>().setServiceType('taxi');
    Navigator.of(context).pushNamed('/passenger/home');
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  /// Jonli buyurtmani XIZMATDAN QAT'I NAZAR bitta ko'rinishga keltiradi.
  ///
  /// Har bir vertikal o'z holatini o'zi saqlaydi (taksi va yuk —
  /// [OrderProvider], ovqat — [FoodProvider], market — [MarketProvider]),
  /// lekin foydalanuvchi uchun ular bitta narsa: "hozir ketayotgan
  /// buyurtmam". Shuning uchun bu yerda faqat KO'RINISH birlashtiriladi,
  /// holat emas — hech qanday yangi so'rov yuborilmaydi, mavjud provider
  /// qiymatlari o'qiladi.
  ///
  /// Tartib ataylab taksi/yukdan boshlanadi: yo'lda ketayotgan safar
  /// yetkazib berishdan ko'ra tezroq e'tibor talab qiladi.
  _ActiveOrderSummary? _activeOrder(BuildContext context) {
    final ride = context.watch<OrderProvider>();
    if (ride.hasActiveOrder) {
      final order = ride.activeOrder!;
      final entry = ServiceCatalogEntry.of(order.serviceType);
      return _ActiveOrderSummary(
        icon: entry.icon,
        service: entry.label,
        title: '${order.pickup.address} → ${order.dropoff.address}',
        stage: order.status.label,
        // Safarni kuzatish ekrani — "Buyurtmalar" ro'yxatidagi faol karta
        // ham aynan shu yerga olib boradi, oqim bir xil qoladi.
        onOpen: () => Navigator.of(context).pushNamed('/passenger/home'),
      );
    }

    final food = context.watch<FoodProvider>();
    if (food.hasActiveOrder) {
      final order = food.activeOrder!;
      return _ActiveOrderSummary(
        icon: ServiceCatalogEntry.food.icon,
        service: ServiceCatalogEntry.food.label,
        title: order.deliveryAddress,
        stage: order.status.label,
        onOpen: () => _openOrdersTab(context),
      );
    }

    final market = context.watch<MarketProvider>();
    if (market.hasActiveOrder) {
      final order = market.activeOrder!;
      return _ActiveOrderSummary(
        icon: ServiceCatalogEntry.market.icon,
        service: ServiceCatalogEntry.market.label,
        title: order.deliveryAddress,
        stage: order.status.label,
        onOpen: () => _openOrdersTab(context),
      );
    }

    return null;
  }

  /// Yetkazib berish buyurtmalarining tafsiloti "Buyurtmalar" tabida —
  /// yangi ekran ochilmaydi, mavjud pastki navigatsiya ishlatiladi.
  void _openOrdersTab(BuildContext context) {
    context.read<SuperappProvider>().tabIndex = 1;
  }

  @override
  Widget build(BuildContext context) {
    final balance =
        context.select<SuperappProvider, double?>((p) => p.walletBalance);
    final unread =
        context.select<NotificationsProvider, int>((p) => p.unreadCount);
    final food = context.watch<FoodProvider>();
    final restaurants = food.restaurants;
    final active = _activeOrder(context);

    return ColoredBox(
      // Qatlamli yuza: ekran foni `kSurface2`, ustidagi bloklar oq.
      color: kSurface2,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          _Hero(
            balance: balance,
            unreadCount: unread,
            onWallet: () => _push(context, const WalletScreen()),
            onNotifs: () => _push(context, const NotificationsScreen()),
            onSearch: () => _push(context, const SearchScreen()),
            onTaxi: () => _openTaxi(context),
          ),
          if (active != null) ...[
            const SizedBox(height: kSpace4),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: context.gutter),
              child: ResponsiveContent(
                child: _ActiveOrderCard(summary: active),
              ),
            ),
          ],
          const SizedBox(height: kSpace6),
          _SecondaryServices(
            onCargo: () => _push(context, const CargoScreen()),
            onFood: () => _push(context, const FoodListScreen()),
            onMarket: () => _push(context, const MarketScreen()),
          )
              .animate()
              .fadeIn(delay: 80.ms, duration: 400.ms)
              .slideY(begin: 0.15, curve: Curves.easeOut),
          const SizedBox(height: kSpace6),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: context.gutter),
            child: AgSectionTitle(
              'Mashhur restoranlar',
              trailing: 'Barchasi',
              onTrailingTap: () => _push(context, const FoodListScreen()),
            ),
          ),
          const SizedBox(height: kSpace3),
          _RestaurantSection(
            state: food.state,
            error: food.error,
            restaurants: restaurants,
            onRetry: () => context.read<FoodProvider>().loadRestaurants(),
            onOpen: (r) =>
                _push(context, RestaurantDetailScreen(restaurantId: r.id)),
          ),
        ],
      ),
    );
  }
}

/// Yashil header + uning pastki chekkasiga tushgan TAKSI BLOKI.
///
/// ⚠️ NEGA `Positioned(bottom: -27)` DAN VOZ KECHILDI.
/// Ilgari suzuvchi qidiruv paneli `Stack` chegarasidan tashqariga
/// chiqarilgan edi. Flutter ota-qutisidan TASHQARIDAGI nuqtani hit-test
/// qilmaydi — natijada 54dp li boshqaruvning pastki yarmi bosilmasdi va
/// buni hech kim sezmagan, chunki ekranda test yo'q edi.
///
/// Endi gradient `Stack` ning eng past qatlami (belgilangan balandlik),
/// mazmun esa uning USTIDA oddiy `Column` bo'lib oqadi: karta gradient
/// chekkasidan pastga chiqadi, lekin `Stack` ning O'Z ichida qoladi va
/// to'liq bosiladi.
class _Hero extends StatelessWidget {
  const _Hero({
    required this.balance,
    required this.unreadCount,
    required this.onWallet,
    required this.onNotifs,
    required this.onSearch,
    required this.onTaxi,
  });

  /// `null` — hamyon balansi hali yuklanmagan yoki yuklanmadi. Bunday
  /// paytda o'ylab topilgan raqam emas, neytral chiziqcha ko'rsatiladi.
  final double? balance;

  /// O'qilmagan bildirishnomalar soni.
  ///
  /// ⚠️ Ilgari bu yerda HAR DOIM qizil nuqta turardi — ya'ni hech qachon
  /// bildirishnoma kelmagan foydalanuvchi ham "sizni kutayotgan narsa bor"
  /// degan yolg'on signalni ko'rardi. Endi nishon faqat haqiqiy son
  /// nolga teng bo'lmaganda chiziladi.
  final int unreadCount;

  final VoidCallback onWallet;
  final VoidCallback onNotifs;
  final VoidCallback onSearch;
  final VoidCallback onTaxi;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    final gutter = context.gutter;

    return Stack(
      children: [
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          child: Container(
            height: topPad + _kHeroGradientHeight,
            decoration: const BoxDecoration(
              gradient: agHeader,
              borderRadius:
                  BorderRadius.vertical(bottom: Radius.circular(kRadiusXl)),
            ),
          ),
        ),
        Column(
          children: [
            SizedBox(height: topPad + kSpace3),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: gutter),
              child: ResponsiveContent(
                child: _HeaderRow(
                  balance: balance,
                  unreadCount: unreadCount,
                  onWallet: onWallet,
                  onNotifs: onNotifs,
                  onSearch: onSearch,
                ),
              ),
            ),
            const SizedBox(height: kSpace5),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: gutter),
              child: ResponsiveContent(child: _TaxiBlock(onTap: onTaxi)),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.balance,
    required this.unreadCount,
    required this.onWallet,
    required this.onNotifs,
    required this.onSearch,
  });

  final double? balance;
  final int unreadCount;
  final VoidCallback onWallet;
  final VoidCallback onNotifs;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const ExcludeSemantics(
          child: Icon(Icons.location_on_rounded, color: agOnPrimary, size: 20),
        ),
        const SizedBox(width: kSpace2),
        // `Expanded` + ellipsis: uchta boshqaruv (hamyon, qidiruv,
        // bildirishnoma) tor ekranda joyni siqib qo'ymasin — manzil
        // qisqaradi, qator taqillab ketmaydi.
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Joriy manzil',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: agOnPrimary,
                  fontSize: kFontMicro,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      'Angren shahri',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: agOnPrimary,
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  ExcludeSemantics(
                    child: Icon(Icons.expand_more_rounded,
                        color: agOnPrimary, size: 16),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: kSpace2),
        _WalletPill(balance: balance, onTap: onWallet),
        const SizedBox(width: kSpace1),
        // Umumiy qidiruv (taom, do'kon, manzil) endi ikonka tugmasi.
        // Sabab: bosh ekranning eng ko'rinadigan maydonini ASOSIY vertikal
        // egallashi kerak, va bitta ekranda ikkita "maydonga o'xshagan"
        // element yonma-yon turishi foydalanuvchini ikkilantiradi.
        AgIconButton(
          icon: Icons.search_rounded,
          onTap: onSearch,
          semanticsLabel: 'Qidiruv',
          background: kSurface.withValues(alpha: 0.18),
          color: agOnPrimary,
          size: 38,
        ),
        AgIconButton(
          icon: Icons.notifications_rounded,
          onTap: onNotifs,
          semanticsLabel: 'Bildirishnomalar',
          background: kSurface.withValues(alpha: 0.18),
          color: agOnPrimary,
          size: 38,
          badge: unreadCount > 0 ? '$unreadCount' : null,
        ),
      ],
    );
  }
}

class _WalletPill extends StatelessWidget {
  const _WalletPill({required this.balance, required this.onTap});

  final double? balance;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Yorliq va QIYMAT ajratiladi: tugmaning nomi "Hamyon", balans esa
    // uning qiymati. Aks holda ekran o'quvchi "Hamyon 125 000" ni bitta
    // nom sifatida o'qirdi va balans o'zgarganda tugma nomi o'zgargandek
    // eshitilardi. `excludeSemantics` ichkaridagi matn tugunini yig'adi.
    return Semantics(
      button: true,
      label: 'Hamyon',
      value: balance == null ? null : Formatters.formatAmount(balance!),
      onTap: onTap,
      excludeSemantics: true,
      child: AppPressable(
        onTap: onTap,
        pressedScale: 0.95,
        child: Center(
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: kSpace3),
            decoration: BoxDecoration(
              color: kSurface.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(kRadiusSm),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.account_balance_wallet_rounded,
                    color: agOnPrimary, size: 17),
                const SizedBox(width: kSpace2),
                Text(
                  // Yuklanmagan balans o'rniga o'ylab topilgan raqam emas,
                  // neytral chiziqcha.
                  balance == null ? '—' : Formatters.formatAmount(balance!),
                  style: const TextStyle(
                    color: agOnPrimary,
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// TAKSI BLOKI — ekranning sukut bo'yicha yuzasi.
///
/// Ichidagi manzil maydoni oddiy tugma emas, MAYDONGA o'xshab chiziladi:
/// foydalanuvchi bu yerdan safar boshlanishini o'qishi kerak. Maydon
/// `kSurface2` fon + `kLineInteractive` chegara bilan beriladi — oq karta
/// ichida faqat fon farqi kifoya qilmasdi, chegara esa WCAG 1.4.11
/// (boshqaruvni aniqlash, 3:1) talabini bajaradi.
///
/// ⚠️ BOSILADIGAN QISM — BUTUN KARTA, faqat maydon emas. Ichma-ich ikkita
/// bosiladigan qatlam bo'lsa (karta + maydon), barmoq qayerga tushishiga
/// qarab javob har xil bo'lardi; bu yerda esa butun blok bitta niyatni
/// bildiradi — "taksi chaqirish".
class _TaxiBlock extends StatelessWidget {
  const _TaxiBlock({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppPressable(
      onTap: onTap,
      semanticsLabel: 'Taksi. Qayerga borasiz?',
      // Katta yuza uchun nozik masshtab — 0.93 bunday blokda "sakragan"
      // ko'rinardi.
      pressedScale: 0.98,
      minTapTarget: false,
      child: AgSurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: agTint,
                    borderRadius: BorderRadius.circular(kRadiusXs),
                  ),
                  child: const Icon(Icons.local_taxi_rounded,
                      color: agGreenText, size: 20),
                ),
                const SizedBox(width: kSpace3),
                Expanded(
                  child: Text(
                    ServiceCatalogEntry.taxi.label,
                    style: TextStyle(
                      fontSize: context.fs(kFontH3),
                      fontWeight: FontWeight.w800,
                      color: agText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace3),
            Container(
              // `minHeight`: tizim shrifti kattalashsa maydon o'sadi,
              // yozuv kesilmaydi.
              constraints: const BoxConstraints(minHeight: kControlHeight),
              padding: const EdgeInsets.symmetric(horizontal: kSpace4),
              decoration: BoxDecoration(
                color: kSurface2,
                borderRadius: BorderRadius.circular(kRadiusMd),
                border: Border.all(color: kLineInteractive),
              ),
              child: Row(
                children: [
                  const ExcludeSemantics(
                    child: Icon(Icons.search_rounded,
                        color: agGreenText, size: 22),
                  ),
                  const SizedBox(width: kSpace3),
                  Expanded(
                    child: Text(
                      'Qayerga borasiz?',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        // Kichik bo'lmagan yozuv, lekin baribir `kInkMuted`
                        // (5.47:1) — `kInkSubtle` yozuvda hech qachon.
                        color: kInkMuted,
                        fontSize: context.fs(kFontBodyLg),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: kSpace2),
                  const ExcludeSemantics(
                    child: Icon(Icons.arrow_forward_rounded,
                        color: agGreenText, size: 20),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ikkilamchi xizmatlar — taksi blokidan PASTDA va KICHIKROQ.
///
/// Yorliqlar [ServiceCatalogEntry] dan olinadi (yo'lovchi tilida qisqa:
/// "Yuk", "Ovqat", "Market"). Ilgari bu yerda "Cargo" turardi — u
/// ilovaning ichki nomi, foydalanuvchi so'zi emas.
class _SecondaryServices extends StatelessWidget {
  const _SecondaryServices({
    required this.onCargo,
    required this.onFood,
    required this.onMarket,
  });

  final VoidCallback onCargo;
  final VoidCallback onFood;
  final VoidCallback onMarket;

  @override
  Widget build(BuildContext context) {
    final items = <(ServiceCatalogEntry, Color, VoidCallback)>[
      (ServiceCatalogEntry.cargo, agPurple, onCargo),
      (ServiceCatalogEntry.food, agOrange, onFood),
      (ServiceCatalogEntry.market, agBlue, onMarket),
    ];

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: context.gutter),
      child: ResponsiveContent(
        child: Row(
          // `stretch` EMAS: qator `ListView` ichida, ya'ni balandligi
          // cheklanmagan — cho'zilish cheksiz balandlik so'rardi. Uchala
          // plitkaning mazmuni bir xil tuzilishda bo'lgani uchun ular
          // baribir teng balandlikda chiqadi.
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i != 0) const SizedBox(width: kSpace3),
              Expanded(
                child: _SecondaryServiceTile(
                  entry: items[i].$1,
                  color: items[i].$2,
                  onTap: items[i].$3,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SecondaryServiceTile extends StatelessWidget {
  const _SecondaryServiceTile({
    required this.entry,
    required this.color,
    required this.onTap,
  });

  final ServiceCatalogEntry entry;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppPressable(
      onTap: onTap,
      semanticsLabel: entry.label,
      pressedScale: 0.95,
      minTapTarget: false,
      child: AgSurfaceCard(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace2,
          vertical: kSpace3,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: Icon(entry.icon, color: color, size: _kSecondaryIconSize),
            ),
            const SizedBox(height: kSpace2),
            Text(
              entry.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.fs(kFontCaption),
                fontWeight: FontWeight.w700,
                color: agText,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Jonli buyurtmaning bitta ko'rinishi — xizmat faqat ikonka, nom va
/// bosqich yozuvi bilan farq qiladi.
@immutable
class _ActiveOrderSummary {
  const _ActiveOrderSummary({
    required this.icon,
    required this.service,
    required this.title,
    required this.stage,
    required this.onOpen,
  });

  final IconData icon;

  /// Yo'lovchi tilidagi qisqa xizmat nomi ("Taksi", "Yuk", "Ovqat").
  final String service;

  /// Safar uchun yo'nalish, yetkazib berish uchun manzil.
  final String title;

  /// Buyurtma bosqichi ("Haydovchi kelmoqda", "Tayyorlanmoqda"…).
  final String stage;

  final VoidCallback onOpen;
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.summary});

  final _ActiveOrderSummary summary;

  @override
  Widget build(BuildContext context) {
    return AppPressable(
      onTap: summary.onOpen,
      semanticsLabel:
          'Faol buyurtma: ${summary.service}. ${summary.title}. ${summary.stage}',
      pressedScale: 0.98,
      minTapTarget: false,
      child: AgSurfaceCard(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: agTint,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: ExcludeSemantics(
                child: Icon(summary.icon, color: agGreenText, size: 22),
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    summary.service,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontMicro,
                      fontWeight: FontWeight.w700,
                      color: kInkMuted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    summary.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontTitle,
                      fontWeight: FontWeight.w800,
                      color: agText,
                    ),
                  ),
                  const SizedBox(height: kSpace2),
                  AppStatusBadge(
                    label: summary.stage,
                    tone: AppStatusTone.info,
                    dense: true,
                  ),
                ],
              ),
            ),
            const SizedBox(width: kSpace2),
            // `kInkSubtle` — faqat ikonka, yozuvda emas.
            const ExcludeSemantics(
              child: Icon(Icons.chevron_right_rounded,
                  color: kInkSubtle, size: 22),
            ),
          ],
        ),
      ),
    );
  }
}

/// Mashhur restoranlar bloki — uchta holat: yuklanmoqda / xato / bo'sh.
class _RestaurantSection extends StatelessWidget {
  const _RestaurantSection({
    required this.state,
    required this.error,
    required this.restaurants,
    required this.onRetry,
    required this.onOpen,
  });

  final FoodProviderState state;
  final String? error;
  final List<FoodRestaurant> restaurants;
  final VoidCallback onRetry;
  final void Function(FoodRestaurant) onOpen;

  @override
  Widget build(BuildContext context) {
    if (restaurants.isEmpty) {
      if (state == FoodProviderState.loading) {
        return AppSkeletonList(
          itemCount: 2,
          lines: 2,
          padding: EdgeInsets.symmetric(horizontal: context.gutter),
        );
      }
      if (state == FoodProviderState.error) {
        return Padding(
          padding: EdgeInsets.symmetric(horizontal: context.gutter),
          child: InlineErrorWidget(
            message: error ?? 'Xatolik yuz berdi',
            onRetry: onRetry,
          ),
        );
      }
      return const AppEmptyState(
        icon: Icons.restaurant_rounded,
        title: 'Restoranlar topilmadi',
        compact: true,
      );
    }

    return SizedBox(
      height: 168,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: context.gutter),
        itemCount: restaurants.length,
        separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
        itemBuilder: (context, i) => _RestaurantCard(
          restaurant: restaurants[i],
          onTap: () => onOpen(restaurants[i]),
        )
            .animate()
            .fadeIn(delay: (200 + i * 70).ms, duration: 380.ms)
            .slideX(begin: 0.2, curve: Curves.easeOut),
      ),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  const _RestaurantCard({required this.restaurant, required this.onTap});
  final FoodRestaurant restaurant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    return Semantics(
      button: true,
      label: r.name,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 168,
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusLg),
            boxShadow: agCardShadow,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  Container(
                    height: 92,
                    width: double.infinity,
                    color: agOrange,
                    child: ExcludeSemantics(
                      child: Icon(Icons.restaurant_rounded,
                          size: 40, color: agSurface.withValues(alpha: 0.7)),
                    ),
                  ),
                  Positioned(
                    top: kSpace2,
                    right: kSpace2,
                    child: AppStatusBadge(
                      label: r.isOpen ? 'Ochiq' : 'Yopiq',
                      tone: r.isOpen
                          ? AppStatusTone.success
                          : AppStatusTone.danger,
                      dense: true,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    kSpace3, kSpace3, kSpace3, kSpace3),
                child: Text(r.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontBody,
                        color: agText)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
