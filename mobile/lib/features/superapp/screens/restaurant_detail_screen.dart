import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/deals.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/menu_category.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';

// ============================================================================
// RESTORAN MENYUSI — kategoriyalar alohida, taomlar 2 ustunli to'rda.
//
// Asoschi fikri (2026-10-16): "kategoriyalar chiqishi kerak, bir qator emas
// 2 qatorli, kategoriyalar alohida". Shuning uchun:
//   • tepada YOPISHQOQ gorizontal kategoriya chiplari — bosilsa o'sha
//     bo'limga aylantiradi, aylantirganda faol chip o'zi almashadi;
//   • har bir kategoriya — o'z sarlavhasi bilan alohida bo'lim;
//   • taomlar 2 ustunli to'rda (planshetda 3–4): rasm, nom, narx,
//     chegirma belgisi, qo'shish tugmasi.
// Ro'yxat SLIVERLARDA qoladi — faqat ko'ringan kartalar quriladi.
// ============================================================================

/// Bitta karta uchun maqsadli maksimal kenglik — 360/393dp telefonda 2
/// ustun, 600dp+ planshetda 3 va undan ko'p.
const double _kDishTileMaxWidth = 220;

/// Yopishqoq chiplar qatorining balandligi.
const double _kChipsBarHeight = 56;

class _MenuSection {
  const _MenuSection({required this.id, required this.title, required this.dishes});
  final String id;
  final String title;
  final List<Dish> dishes;
}

/// Taomlarni kategoriyalar bo'yicha bo'limlarga ajratadi (tartib —
/// kategoriyalar `sortOrder` i). Kategoriyasiz yoki noma'lum kategoriyali
/// taomlar oxirida "Boshqa" bo'limida.
List<_MenuSection> _buildSections(
  List<MenuCategory> categories,
  List<Dish> dishes,
  String otherTitle,
) {
  final byCategory = <String, List<Dish>>{};
  final rest = <Dish>[];
  final known = {for (final c in categories) c.id};
  for (final d in dishes) {
    final id = d.categoryId;
    if (id != null && known.contains(id)) {
      (byCategory[id] ??= []).add(d);
    } else {
      rest.add(d);
    }
  }
  return [
    for (final c in categories)
      if (byCategory[c.id] case final list? when list.isNotEmpty)
        _MenuSection(id: c.id, title: c.name, dishes: list),
    if (rest.isNotEmpty) _MenuSection(id: '_other', title: otherTitle, dishes: rest),
  ];
}

class RestaurantDetailScreen extends StatefulWidget {
  const RestaurantDetailScreen({super.key, required this.restaurantId});
  final String restaurantId;

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  final ScrollController _scroll = ScrollController();
  final Map<String, GlobalKey> _sectionKeys = {};
  final ValueNotifier<String?> _activeSection = ValueNotifier<String?>(null);
  bool _jumping = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_syncActiveChip);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final food = context.read<FoodProvider>();
      await food.loadRestaurantDetail(widget.restaurantId);
      if (mounted && food.restaurant != null) {
        context.read<SuperappProvider>().setActiveContext('food', food.restaurant!.id);
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _activeSection.dispose();
    super.dispose();
  }

  GlobalKey _keyFor(String id) => _sectionKeys.putIfAbsent(id, GlobalKey.new);

  /// Yopishqoq qatorlar (app bar + chiplar) pastki chegarasi — ekran
  /// yuqorisidan.
  double get _pinnedBottom =>
      MediaQuery.paddingOf(context).top + kToolbarHeight + _kChipsBarHeight;

  void _syncActiveChip() {
    if (_jumping) return;
    String? current;
    for (final entry in _sectionKeys.entries) {
      final box = entry.value.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.attached) continue;
      final top = box.localToGlobal(Offset.zero).dy;
      if (top <= _pinnedBottom + 8) {
        if (current == null) {
          current = entry.key;
        } else {
          final currentBox = _sectionKeys[current]!.currentContext!.findRenderObject()! as RenderBox;
          if (top > currentBox.localToGlobal(Offset.zero).dy) current = entry.key;
        }
      }
    }
    if (current != null && current != _activeSection.value) _activeSection.value = current;
  }

  /// Chip bosilganda bo'limga aylantiradi. Uzoqdagi bo'lim hali qurilmagan
  /// bo'lishi mumkin (dangasa sliverlar) — u holda u qurilguncha ekranma-
  /// ekran siljiymiz, keyin aniq joyga.
  Future<void> _scrollToSection(String id, List<_MenuSection> sections) async {
    AppHaptics.select();
    _activeSection.value = id;
    _jumping = true;
    try {
      final key = _keyFor(id);
      final targetIndex = sections.indexWhere((s) => s.id == id);
      var guard = 0;
      while (key.currentContext == null && guard++ < 40 && _scroll.hasClients) {
        final visibleIndex = sections.indexWhere((s) => _sectionKeys[s.id]?.currentContext != null);
        final down = visibleIndex == -1 || visibleIndex < targetIndex;
        final position = _scroll.position;
        final step = position.viewportDimension * 0.9;
        final next = (position.pixels + (down ? step : -step))
            .clamp(position.minScrollExtent, position.maxScrollExtent);
        if (next == position.pixels) break;
        _scroll.jumpTo(next);
        await WidgetsBinding.instance.endOfFrame;
      }
      final box = key.currentContext?.findRenderObject();
      if (box == null || !_scroll.hasClients) return;
      final viewport = RenderAbstractViewport.of(box);
      final reveal = viewport.getOffsetToReveal(box, 0).offset;
      // `getOffsetToReveal` yopishqoq app bar + chiplar balandligini o'zi
      // hisobga oladi — bo'lim sarlavhasi aynan chiplar ostiga tushadi.
      final target = reveal
          .clamp(_scroll.position.minScrollExtent, _scroll.position.maxScrollExtent);
      await _scroll.animateTo(target, duration: kDurationBase, curve: kEaseStandard);
    } finally {
      _jumping = false;
    }
  }

  void _add(BuildContext context, Dish d) {
    AppHaptics.tap();
    context.read<SuperappProvider>().addToCart(
          CartItem(
            id: d.id,
            name: d.name,
            price: d.effectivePrice,
            qty: 1,
            icon: d.icon,
            color: d.color,
            imageUrl: d.imageUrl,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final food = context.watch<FoodProvider>();
    final provider = context.watch<SuperappProvider>();

    if (food.state == FoodProviderState.loading && food.restaurant == null) {
      return const Scaffold(
        backgroundColor: agSurface,
        body: SafeArea(child: AppSkeletonList(itemCount: 5, hasTrailing: true)),
      );
    }
    if (food.restaurant == null) {
      return Scaffold(
        backgroundColor: agSurface,
        body: SafeArea(
          child: AppErrorState(
            message: food.error ?? context.l10n.saRestaurantNotFound,
            onRetry: () => context.read<FoodProvider>().loadRestaurantDetail(widget.restaurantId),
          ),
        ),
      );
    }

    final r = food.restaurant!;
    final sections = _buildSections(food.categories, food.dishes, context.l10n.saMenuOther);
    final showChips = sections.length > 1;
    if (showChips && _activeSection.value == null) _activeSection.value = sections.first.id;

    return Scaffold(
      backgroundColor: agSurface,
      body: Stack(
        children: [
          CustomScrollView(
            controller: _scroll,
            slivers: [
              _HeroAppBar(restaurant: r),
              SliverToBoxAdapter(
                child: _RestaurantInfo(restaurant: r, promotions: food.restaurantPromotions),
              ),
              if (showChips)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _ChipsBarDelegate(
                    sections: sections,
                    active: _activeSection,
                    onTap: (id) => _scrollToSection(id, sections),
                  ),
                ),
              if (sections.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 120),
                  sliver: SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.restaurant_menu_rounded,
                      title: context.l10n.saMenuEmptyTitle,
                      message: context.l10n.saMenuEmptyMessage,
                      compact: true,
                    ),
                  ),
                )
              else
                for (final section in sections) ...[
                  SliverToBoxAdapter(
                    child: Padding(
                      key: _keyFor(section.id),
                      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, kSpace3),
                      child: Text(
                        section.title,
                        style: const TextStyle(fontSize: kFontH3, fontWeight: FontWeight.w800, color: agText),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                    sliver: _DishGrid(
                      dishes: section.dishes,
                      onAdd: (d) => _add(context, d),
                    ),
                  ),
                ],
              // Savat paneli va pastki xavfsiz zona uchun joy.
              SliverToBoxAdapter(
                child: SizedBox(height: 120 + MediaQuery.paddingOf(context).bottom),
              ),
            ],
          ),
          if (provider.cartCount > 0)
            Positioned(
              left: kSpace4,
              right: kSpace4,
              bottom: MediaQuery.of(context).padding.bottom + kSpace4,
              child: AgCartBar(
                count: provider.cartCount,
                label: context.l10n.saGoToCart,
                trailing: Formatters.formatSom(provider.cartSubtotal),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
              ),
            ),
        ],
      ),
    );
  }
}

/// Rasm — yig'ilganda oq toolbar (orqaga + restoran nomi) qoladi.
class _HeroAppBar extends StatelessWidget {
  const _HeroAppBar({required this.restaurant});
  final FoodRestaurant restaurant;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    final topPad = MediaQuery.paddingOf(context).top;
    // Kichik telefonda (640dp balandlik) rasm ekranning uchdan biridan
    // oshmasin — menyu birinchi ekranda ko'rinsin.
    final expanded = (MediaQuery.sizeOf(context).height * 0.28).clamp(150.0, 260.0);
    return SliverAppBar(
      pinned: true,
      expandedHeight: expanded,
      backgroundColor: agSurface,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      leadingWidth: 64,
      leading: Padding(
        padding: const EdgeInsets.only(left: kSpace4),
        child: Center(
          child: AgIconButton(
            icon: Icons.arrow_back_rounded,
            onTap: () => Navigator.of(context).pop(),
            semanticsLabel: context.l10n.saBack,
            background: agSurface,
            size: 40,
          ),
        ),
      ),
      flexibleSpace: LayoutBuilder(
        builder: (context, constraints) {
          final collapsed = constraints.maxHeight <= kToolbarHeight + topPad + 8;
          return Stack(
            fit: StackFit.expand,
            children: [
              if (!collapsed)
                CatalogImage(
                  imageUrl: r.imageUrl,
                  placeholder: Container(
                    color: agOrange,
                    alignment: Alignment.center,
                    child: ExcludeSemantics(
                      child: Icon(Icons.restaurant_rounded, size: 80, color: agOnPrimary.withValues(alpha: 0.7)),
                    ),
                  ),
                ),
              if (collapsed)
                Padding(
                  padding: EdgeInsets.only(top: topPad, left: 72, right: kSpace4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      r.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _RestaurantInfo extends StatelessWidget {
  const _RestaurantInfo({required this.restaurant, required this.promotions});
  final FoodRestaurant restaurant;
  final List<PromotionBadge> promotions;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppStatusBadge(
            label: r.isOpen ? context.l10n.saOpen : context.l10n.saClosed,
            tone: r.isOpen ? AppStatusTone.success : AppStatusTone.danger,
          ),
          const SizedBox(height: kSpace2),
          Text(r.name,
              style: const TextStyle(
                  fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
          if (r.address != null) ...[
            const SizedBox(height: kSpace2),
            Row(
              children: [
                const ExcludeSemantics(child: Icon(Icons.location_on_rounded, size: 17, color: agSubtle)),
                const SizedBox(width: kSpace2),
                Expanded(
                  child: Text(r.address!,
                      style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ],
          // Restoranning faol aksiyalari — menyudan OLDIN, ko'zga tashlanadigan joyda.
          if (promotions.isNotEmpty) ...[
            const SizedBox(height: kSpace3),
            Wrap(
              spacing: kSpace2,
              runSpacing: kSpace2,
              children: [
                for (final p in promotions)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace2),
                    decoration: BoxDecoration(
                      color: kErrorLight,
                      borderRadius: BorderRadius.circular(kRadiusSm),
                      border: Border.all(color: kErrorBorder),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        DiscountBadge(label: p.shortLabel, dense: true),
                        if (p.title.isNotEmpty || p.minOrderAmount != null) ...[
                          const SizedBox(width: kSpace2),
                          Flexible(
                            child: Text(
                                [
                                  if (p.title.isNotEmpty) p.title,
                                  if (p.minOrderAmount case final min?)
                                    context.l10n.saDealMinOrder(Formatters.formatSom(min)),
                                ].join(' · '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: kFontCaption, fontWeight: FontWeight.w700, color: kErrorDeep)),
                          ),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ChipsBarDelegate extends SliverPersistentHeaderDelegate {
  _ChipsBarDelegate({required this.sections, required this.active, required this.onTap});

  final List<_MenuSection> sections;
  final ValueNotifier<String?> active;
  final ValueChanged<String> onTap;

  @override
  double get minExtent => _kChipsBarHeight;
  @override
  double get maxExtent => _kChipsBarHeight;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Material(
      color: agSurface,
      elevation: overlapsContent || shrinkOffset > 0 ? 2 : 0,
      shadowColor: agInk.withValues(alpha: 0.2),
      child: ValueListenableBuilder<String?>(
        valueListenable: active,
        builder: (context, activeId, _) => ListView.separated(
          key: const ValueKey('menu-category-chips'),
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
          itemCount: sections.length,
          separatorBuilder: (_, __) => const SizedBox(width: kSpace2),
          itemBuilder: (context, i) {
            final s = sections[i];
            final selected = s.id == activeId;
            return ChoiceChip(
              key: ValueKey('menu-chip-${s.id}'),
              label: Text(s.title, maxLines: 1),
              selected: selected,
              showCheckmark: false,
              selectedColor: agPrimary,
              labelStyle: TextStyle(
                fontWeight: FontWeight.w700,
                color: selected ? agOnPrimary : agText,
              ),
              onSelected: (_) => onTap(s.id),
            );
          },
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_ChipsBarDelegate oldDelegate) =>
      oldDelegate.sections != sections || oldDelegate.active != active;
}

/// Taomlar to'ri. Ustunlar soni kenglikdan, karta balandligi esa karta
/// kengligi VA matn shkalasidan hisoblanadi — 360dp + 1.3x shriftda ham
/// hech narsa toshmaydi.
class _DishGrid extends StatelessWidget {
  const _DishGrid({required this.dishes, required this.onAdd});

  final List<Dish> dishes;
  final ValueChanged<Dish> onAdd;

  @override
  Widget build(BuildContext context) {
    return SliverLayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.crossAxisExtent;
        final columns = (width / _kDishTileMaxWidth).ceil().clamp(2, 5);
        final tileWidth = (width - kSpace3 * (columns - 1)) / columns;
        final scale = MediaQuery.textScalerOf(context).scale(1);
        final extent = tileWidth * 0.75 + 124 * scale + kSpace3;
        return SliverGrid(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: kSpace3,
            crossAxisSpacing: kSpace3,
            mainAxisExtent: extent,
          ),
          delegate: SliverChildBuilderDelegate(
            (context, i) {
              final d = dishes[i];
              return DishTile(dish: d, onAdd: d.isAvailable ? () => onAdd(d) : null);
            },
            childCount: dishes.length,
          ),
        );
      },
    );
  }
}

/// To'rdagi bitta taom: rasm (+ chegirma belgisi), nom, narx, "+" tugma.
class DishTile extends StatelessWidget {
  const DishTile({super.key, required this.dish, required this.onAdd});
  final Dish dish;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final d = dish;
    return Opacity(
      opacity: d.isAvailable ? 1 : 0.55,
      child: Container(
        decoration: BoxDecoration(
          color: agSurface2,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 4 / 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ExcludeSemantics(
                    child: CatalogImage(
                      imageUrl: d.imageUrl,
                      placeholder: Container(
                        color: d.color,
                        child: Icon(d.icon, size: 34, color: agOnPrimary.withValues(alpha: 0.95)),
                      ),
                    ),
                  ),
                  if (d.hasDiscount && d.discount != null)
                    Positioned(
                      left: kSpace2,
                      top: kSpace2,
                      child: DiscountBadge(label: d.discount!.shortLabel, dense: true),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(kSpace3, kSpace2, kSpace1, kSpace1),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      d.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontLabel, color: agText, height: 1.25),
                    ),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: d.isAvailable
                              ? PriceTag(
                                  price: d.effectivePrice,
                                  oldPrice: d.hasDiscount ? d.price : null,
                                  fontSize: kFontLabel,
                                )
                              : Text(
                                  context.l10n.saProductOutOfStock,
                                  maxLines: 2,
                                  style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w700),
                                ),
                        ),
                        if (onAdd != null)
                          Semantics(
                            button: true,
                            label: context.l10n.saAddItemToCartLabel(d.name),
                            excludeSemantics: true,
                            child: GestureDetector(
                              onTap: onAdd,
                              behavior: HitTestBehavior.opaque,
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(minWidth: kMinTapTarget, minHeight: kMinTapTarget),
                                child: Center(
                                  child: Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: agPrimary,
                                      borderRadius: BorderRadius.circular(kRadiusSm),
                                      boxShadow: agCtaShadow,
                                    ),
                                    child: const Icon(Icons.add_rounded, color: agOnPrimary, size: 22),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
