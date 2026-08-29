import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
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
import 'package:provider/provider.dart';

// ============================================================================
// BUYURTMALAR — BITTA KUZATUVCHI.
//
// ⚠️ SUPER-APP ARXITEKTURASIDAGI ENG KENG TARQALGAN XATO — har vertikalga
// alohida kuzatuvchi yozish. Ilgari shu ekranda TO'RTTA turli karta bor edi:
// taksi uchun "faol karta", taksi tarixi uchun `_HistoryRow`, ovqat uchun
// `_FoodHistoryRow`, market uchun `_MarketHistoryRow` — to'rttasi ham bir
// xil ma'lumotni (ikonka · sarlavha · izoh · narx · holat) ko'rsatardi,
// lekin har biri o'z qo'li bilan chizilgani uchun ular asta-sekin bir-biridan
// uzoqlashardi va beshinchi vertikal qo'shilganda beshinchi karta yozilishi
// kerak bo'lardi.
//
// Endi hammasi BITTA `_TrackedOrder` modeliga aylantiriladi va BITTA
// `_OrderCard` bilan chiziladi. Vertikallar orasidagi farq faqat uch narsada:
//   1. IKONKA   — `ServiceCatalogEntry` dan (yagona katalog)
//   2. RANG     — `_Vertical` dagi tint/deep juftligi (AppStatusBadge bilan
//                 bir xil, AA dan o'tgan juftliklar)
//   3. BOSQICH NOMLARI — "Tayyorlanmoqda" ovqatda, "Yig'ilmoqda" marketda
//
// BOSQICHLAR CHIZIQLAR BILAN. Foiz emas: "60%" yo'lovchiga hech narsa
// aytmaydi, to'rtta chiziqning ikkitasi to'lgani esa bir qarashda
// tushuniladi.
//
// QATLAMLI YUZA: ekran foni `kSurface2`, har bir buyurtma `AgSurfaceCard`
// (oq, chegarasiz). Soya bilan ajratish o'rniga yuza bilan ajratish —
// yo'lovchi va haydovchi ekranlaridagi til shu yerda ham davom etadi.
//
// ⚠️ MANTIQ O'ZGARMADI: buyurtma yaratish, holat o'zgarishi, narx — hammasi
// provayderlarda. Bu yerda faqat KO'RINISH va guruhlash.
// ============================================================================

/// Ekran foni — kartalar undan uziladi.
const Color _kScreenSurface = kSurface2;

/// Bosqich chizig'ining balandligi. 4dp dan ingichkasi telefonda
/// "chiziq bormi yo'qmi" degan savol tug'diradi, qalinrog'i esa kartani
/// diagrammaga aylantiradi.
const double _kStageBarHeight = 4;

/// Ro'yxat filtri. Ilgari "Faol"/"Tarix" chiplari SOXTA edi — ikkalasi ham
/// qattiq yozilgan (`active: true` / `active: false`) va bosilganda hech
/// narsa qilmasdi. Endi ular haqiqiy filtr.
enum _OrdersFilter { active, history }

/// Vertikalning vizual kimligi. Rang juftliklari `AppStatusBadge` dagi
/// tekshirilgan juftliklar bilan bir xil — tint fon + `*Deep` old plan,
/// hammasi AA (4.5:1) dan yuqori.
enum _Vertical {
  taxi(kMintTint, kPrimary),
  cargo(kInfoLight, kInfoDeep),
  food(kWarningLight, kWarningDeep),
  market(kAccentVioletLight, kAccentVioletDeep);

  const _Vertical(this.tint, this.accent);

  /// Ikonka konteyneri foni.
  final Color tint;

  /// Ikonka, bosqich chizig'i va urg'u rangi — tint ustida AA dan o'tadi.
  final Color accent;
}

/// Har qanday vertikaldagi buyurtmaning BITTA ko'rinishi.
///
/// Bu model ataylab "taksi" yoki "ovqat" haqida hech narsa bilmaydi —
/// u faqat kartani chizish uchun kerak bo'lgan narsani saqlaydi. Yangi
/// vertikal qo'shilganda yangi karta emas, yangi ADAPTER yoziladi.
@immutable
class _TrackedOrder {
  const _TrackedOrder({
    required this.id,
    required this.createdAt,
    required this.icon,
    required this.vertical,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.statusLabel,
    required this.tone,
    required this.stages,
    required this.stageIndex,
    required this.isActive,
    this.onTap,
  });

  final String id;
  final DateTime createdAt;
  final IconData icon;
  final _Vertical vertical;

  /// Birinchi qator — yo'lovchi buyurtmani shundan tanidi
  /// ("Markaz → Uy", "2 ta taom").
  final String title;

  /// Ikkinchi qator — xizmat nomi va qo'shimcha ("Taksi · Bobur A.").
  final String subtitle;

  final String amount;
  final String statusLabel;
  final AppStatusTone tone;

  /// Shu vertikalning bosqich nomlari. Uzunligi har xil bo'lishi mumkin.
  final List<String> stages;

  /// Hozirgi bosqich indeksi. `null` — bekor qilingan buyurtma: bunday
  /// buyurtmada bosqich chizig'i UMUMAN chizilmaydi, chunki "yarim to'lgan
  /// chiziq" bekor qilingan buyurtmada yolg'on gapiradi.
  final int? stageIndex;

  final bool isActive;
  final VoidCallback? onTap;
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  /// Yo'lovchi O'ZI tanlagan filtr. `null` — hali tanlamagan, bunday holda
  /// filtr ma'lumotdan kelib chiqadi (`build` dagi `filter`).
  _OrdersFilter? _chosenFilter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _reloadAll();
    });
  }

  void _reloadAll() {
    context.read<MarketProvider>().loadOrderHistory();
    context.read<FoodProvider>().loadOrderHistory();
    context.read<OrderProvider>().loadOrderHistory();
  }

  bool get embedded => widget.embedded;

  // --- Adapterlar: har bir vertikal -> bitta umumiy model ------------------

  _TrackedOrder _fromRide(Order order) {
    // Yuk safari ham SHU ro'yxatda: `serviceType` faqat ikonka va yorliqni
    // o'zgartiradi, kartani emas. Ilgari yuk safari taksi ikonkasi bilan
    // chizilardi — yo'lovchi buyurtmasini turi bo'yicha ajrata olmasdi.
    final entry = ServiceCatalogEntry.of(order.serviceType);
    final isCargo = order.serviceType == kServiceTypeCargo;
    final driver = order.driver;

    final subtitleParts = <String>[
      entry.label,
      if (order.isActive)
        if (driver == null)
          'Haydovchi qidirilmoqda'
        else ...[
          driver.name,
          if (driver.carNumber.isNotEmpty) driver.carNumber,
        ]
      else
        Formatters.formatDateTime(order.createdAt),
    ];

    return _TrackedOrder(
      id: order.id,
      createdAt: order.createdAt,
      icon: entry.icon,
      vertical: isCargo ? _Vertical.cargo : _Vertical.taxi,
      title: '${order.pickup.address} → ${order.dropoff.address}',
      subtitle: subtitleParts.join(' · '),
      amount: Formatters.formatSom(order.actualPrice ?? order.estimatedPrice),
      statusLabel: order.status.label,
      tone: switch (order.status) {
        OrderStatus.cancelled => AppStatusTone.danger,
        OrderStatus.completed => AppStatusTone.success,
        _ => AppStatusTone.info,
      },
      stages: const ['Qidirilmoqda', "Haydovchi yo'lda", 'Safarda', 'Yakunlandi'],
      stageIndex: switch (order.status) {
        OrderStatus.cancelled => null,
        OrderStatus.scheduled ||
        OrderStatus.pending ||
        OrderStatus.searching =>
          0,
        OrderStatus.driverAssigned ||
        OrderStatus.driverEnRoute ||
        OrderStatus.driverArrived =>
          1,
        OrderStatus.inProgress => 2,
        OrderStatus.completed => 3,
      },
      isActive: order.isActive,
      onTap: order.isActive
          // Jonli safar — kuzatuv ekraniga qaytaradi (o'sha-o'sha yo'l).
          ? () => Navigator.of(context).pushNamed('/passenger/home')
          : () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OrderDetailScreen(order: order),
                ),
              ),
    );
  }

  _TrackedOrder _fromFood(FoodOrder order) {
    return _TrackedOrder(
      id: order.id,
      createdAt: order.createdAt,
      icon: ServiceCatalogEntry.food.icon,
      vertical: _Vertical.food,
      title: '${order.itemsCount} ta taom',
      subtitle: '${ServiceCatalogEntry.food.label} · #${_shortId(order.id)}',
      amount: Formatters.formatSom(order.totalPrice),
      statusLabel: order.status.label,
      tone: switch (order.status) {
        FoodOrderStatus.cancelled => AppStatusTone.danger,
        FoodOrderStatus.delivered => AppStatusTone.success,
        _ => AppStatusTone.info,
      },
      stages: const ['Qabul qilindi', 'Tayyorlanmoqda', "Yo'lda", 'Yetkazildi'],
      stageIndex: switch (order.status) {
        FoodOrderStatus.cancelled => null,
        FoodOrderStatus.newOrder => 0,
        FoodOrderStatus.preparing => 1,
        FoodOrderStatus.ready => 2,
        FoodOrderStatus.delivered => 3,
      },
      isActive: order.status.isActive,
    );
  }

  _TrackedOrder _fromMarket(MarketOrder order) {
    return _TrackedOrder(
      id: order.id,
      createdAt: order.createdAt,
      icon: ServiceCatalogEntry.market.icon,
      vertical: _Vertical.market,
      title: '${order.itemsCount} ta mahsulot',
      subtitle: '${ServiceCatalogEntry.market.label} · #${_shortId(order.id)}',
      amount: Formatters.formatSom(order.totalPrice),
      statusLabel: order.status.label,
      tone: switch (order.status) {
        MarketOrderStatus.cancelled => AppStatusTone.danger,
        MarketOrderStatus.delivered => AppStatusTone.success,
        _ => AppStatusTone.info,
      },
      stages: const ['Qabul qilindi', "Yig'ilmoqda", "Yo'lda", 'Yetkazildi'],
      stageIndex: switch (order.status) {
        MarketOrderStatus.cancelled => null,
        MarketOrderStatus.newOrder => 0,
        MarketOrderStatus.packing => 1,
        MarketOrderStatus.shipped => 2,
        MarketOrderStatus.delivered => 3,
      },
      isActive: order.status.isActive,
    );
  }

  /// `substring(0, 6)` qisqa id kutadi — server qisqaroq id yuborsa
  /// ekran yiqilmasligi kerak.
  static String _shortId(String id) =>
      id.length <= 6 ? id : id.substring(0, 6);

  @override
  Widget build(BuildContext context) {
    final market = context.watch<MarketProvider>();
    final food = context.watch<FoodProvider>();
    final taxi = context.watch<OrderProvider>();

    // ⚠️ JONLI SAFAR YO'QOLIB QOLMASIN.
    // Ekran ochilganda faqat `loadOrderHistory()` chaqiriladi, u esa
    // `OrderProvider._activeOrder` ni to'ldirmaydi (uni faqat
    // `checkActiveOrder()` to'ldiradi). Ilgari tarix ro'yxati `!o.isActive`
    // bo'yicha filtrlangani uchun, ilova qayta ochilib yo'lovchi to'g'ridan-
    // to'g'ri shu bo'limga kirsa, JONLI safar ekranda umuman qolmasdi.
    // Endi faol safar SERVERDAN KELGAN tarixning o'zidan olinadi.
    final rides = <Order>[...taxi.orderHistory];
    final providerActive = taxi.activeOrder;
    if (providerActive != null &&
        providerActive.isActive &&
        !rides.any((o) => o.id == providerActive.id)) {
      rides.insert(0, providerActive);
    }

    final tracked = <_TrackedOrder>[
      ...rides.map(_fromRide),
      ...food.orderHistory.map(_fromFood),
      ...market.orderHistory.map(_fromMarket),
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final active = tracked.where((o) => o.isActive).toList();
    final history = tracked.where((o) => !o.isActive).toList();

    // Sukut bo'yicha "Faol", LEKIN faol buyurtma bo'lmasa-yu tarix bo'lsa —
    // darhol tarix ochiladi. Aks holda ekran "Faol buyurtma yo'q" degan
    // boshi berk ko'chaga tushardi va yo'lovchi o'z tarixini ko'rish uchun
    // ikkinchi chipni topishi kerak bo'lardi.
    final filter = _chosenFilter ??
        (active.isEmpty && history.isNotEmpty
            ? _OrdersFilter.history
            : _OrdersFilter.active);
    final visible = filter == _OrdersFilter.active ? active : history;

    // Xato/yuklanish holati faqat TAKSI provayderidan o'qiladi.
    // `FoodProvider`/`MarketProvider` dagi `loadOrderHistory` xatoni yutadi
    // va `state` ga TEGMAYDI — ya'ni ulardagi `state == error` boshqa
    // so'rovdan (masalan restoranlar ro'yxatidan) qolgan bo'lishi mumkin.
    // Ilgari shu ekran o'sha begona xatoni "buyurtmalar yuklanmadi" deb
    // ko'rsatardi.
    final isLoading =
        tracked.isEmpty && taxi.state == OrderProviderState.loading;
    final errorMessage = tracked.isEmpty && taxi.state == OrderProviderState.error
        ? (taxi.error ?? 'Xatolik yuz berdi')
        : null;

    return Scaffold(
      backgroundColor: _kScreenSurface,
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(
                kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace4),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: agCardShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (!embedded) ...[
                      AgIconButton(
                          icon: Icons.arrow_back_rounded,
                          onTap: () => Navigator.of(context).pop(),
                          semanticsLabel: 'Orqaga'),
                      const SizedBox(width: kSpace3),
                    ],
                    const Text('Buyurtmalar',
                        style: TextStyle(
                            fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText)),
                  ],
                ),
                const SizedBox(height: kSpace4),
                Row(
                  children: [
                    _SegChip(
                      label: 'Faol',
                      count: active.length,
                      active: filter == _OrdersFilter.active,
                      onTap: () =>
                          setState(() => _chosenFilter = _OrdersFilter.active),
                    ),
                    const SizedBox(width: kSpace2),
                    _SegChip(
                      label: 'Tarix',
                      count: history.length,
                      active: filter == _OrdersFilter.history,
                      onTap: () =>
                          setState(() => _chosenFilter = _OrdersFilter.history),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _OrdersBody(
              isLoading: isLoading,
              errorMessage: errorMessage,
              onRetry: _reloadAll,
              filter: filter,
              orders: visible,
            ),
          ),
        ],
      ),
    );
  }
}

/// Ro'yxatning to'rt holati: yuklanmoqda · xato · bo'sh · ro'yxat.
class _OrdersBody extends StatelessWidget {
  const _OrdersBody({
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
    required this.filter,
    required this.orders,
  });

  final bool isLoading;
  final String? errorMessage;
  final VoidCallback onRetry;
  final _OrdersFilter filter;
  final List<_TrackedOrder> orders;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const AppSkeletonList(
        itemCount: 3,
        hasTrailing: true,
        padding: EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace4),
      );
    }
    if (errorMessage != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace6, kSpace4, 110),
        child: InlineErrorWidget(message: errorMessage!, onRetry: onRetry),
      );
    }
    if (orders.isEmpty) {
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace6, kSpace4, 110),
        child: filter == _OrdersFilter.active
            ? const AppEmptyState(
                icon: Icons.local_taxi_rounded,
                title: "Faol buyurtma yo'q",
                message:
                    "Taksi chaqiring yoki ovqat buyurtma qiling — jonli buyurtma shu yerda kuzatiladi.",
              )
            : const AppEmptyState(
                icon: Icons.receipt_long_rounded,
                title: "Buyurtmalar tarixi yo'q",
                message: 'Yakunlangan buyurtmalar shu yerda saqlanadi.',
              ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 110),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
      itemBuilder: (_, i) => _OrderCard(order: orders[i]),
    );
  }
}

/// Faol/tarix filtri. Yorliq bilan birga SON ham ko'rsatiladi — yo'lovchi
/// bo'limga kirmasdan turib u yerda nimadir borligini biladi.
class _SegChip extends StatelessWidget {
  const _SegChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppPressable(
      onTap: onTap,
      semanticsLabel: '$label, $count ta${active ? ', tanlangan' : ''}',
      pressedScale: 0.96,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
        decoration: BoxDecoration(
          color: active ? agPrimary : _kScreenSurface,
          borderRadius: BorderRadius.circular(kRadiusSm),
          // Tanlanmagan chip ham BOSHQARUV — WCAG 1.4.11 uchun 3:1
          // chegara kerak (`kLineInteractive` = 3.67:1).
          border: active ? null : Border.all(color: kLineInteractive),
        ),
        child: Text(
          count > 0 ? '$label · $count' : label,
          style: TextStyle(
            fontSize: kFontLabel,
            fontWeight: FontWeight.w700,
            color: active ? agOnPrimary : agText,
          ),
        ),
      ),
    );
  }
}

/// BITTA KUZATUVCHI — taksi, yuk, ovqat va market shu karta bilan chiziladi.
class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final _TrackedOrder order;

  @override
  Widget build(BuildContext context) {
    final stageIndex = order.stageIndex;

    final card = AgSurfaceCard(
      child: Column(
        children: [
          Row(
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: order.vertical.tint,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(order.icon, color: order.vertical.accent, size: 23),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontBody,
                        color: agText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      order.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      // Kichik yozuv `kInkMuted` (5.47:1) — `kInkSubtle`
                      // yozuvda ishlatilmaydi (3.67:1).
                      style: const TextStyle(
                        fontSize: kFontCaption,
                        color: kInkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: kSpace2),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    order.amount,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: kFontBody,
                      color: agText,
                    ),
                  ),
                  const SizedBox(height: kSpace1),
                  AppStatusBadge(
                    label: order.statusLabel,
                    tone: order.tone,
                    dense: true,
                  ),
                ],
              ),
            ],
          ),
          // Bosqich chizig'i faqat JONLI buyurtmada. Tugagan yoki bekor
          // qilingan buyurtmada u yangilik bermaydi — holat belgisi
          // allaqachon aytdi.
          if (order.isActive && stageIndex != null) ...[
            const SizedBox(height: kSpace3),
            _StageBar(
              stages: order.stages,
              index: stageIndex,
              accent: order.vertical.accent,
            ),
          ],
        ],
      ),
    );

    if (order.onTap == null) return card;

    // `AgSurfaceCard` o'zi interaktivlikni bildirmaydi (chegarasi yo'q),
    // shuning uchun bosiladigan karta `AppPressable` ga o'raladi —
    // masshtab va haptika javob beradi.
    return AppPressable(
      onTap: order.onTap,
      semanticsLabel: '${order.title}, ${order.statusLabel}, ${order.amount}',
      pressedScale: 0.98,
      minTapTarget: false,
      child: card,
    );
  }
}

/// Bosqichlar — CHIZIQLAR bilan.
///
/// Foiz ("60%") ataylab ishlatilmaydi: u yo'lovchiga bosqich nomini
/// aytmaydi va aniqlik illyuziyasini beradi. To'rtta chiziqning ikkitasi
/// to'lgani esa bir qarashda o'qiladi. Chiziq yolg'iz qolmaydi — pastida
/// hozirgi bosqich NOMI turadi (rang ko'rmaydigan foydalanuvchi uchun ham,
/// WCAG 1.4.1).
class _StageBar extends StatelessWidget {
  const _StageBar({
    required this.stages,
    required this.index,
    required this.accent,
  });

  final List<String> stages;
  final int index;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: '${stages.length} bosqichdan ${index + 1}: ${stages[index]}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < stages.length; i++)
                Expanded(
                  child: Container(
                    height: _kStageBarHeight,
                    margin: EdgeInsets.only(left: i == 0 ? 0 : kSpace1),
                    decoration: BoxDecoration(
                      color: i <= index ? accent : kSurface3,
                      borderRadius: BorderRadius.circular(kRadiusFull),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: kSpace2),
          Row(
            children: [
              Expanded(
                child: Text(
                  stages[index],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                    color: agText,
                  ),
                ),
              ),
              const SizedBox(width: kSpace2),
              // O'rin ko'rsatkichi, foiz EMAS: "2/4" — nechanchi bosqich.
              Text(
                '${index + 1}/${stages.length}',
                style: const TextStyle(
                  fontSize: kFontCaption,
                  fontWeight: FontWeight.w600,
                  color: kInkMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
