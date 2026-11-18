import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/reorder.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// "Yana buyurtma qilish": eski buyurtma hozirgi menyu va narx bo'yicha
/// savatga solinadi va savat ochiladi. Savatda boshqa narsa bo'lsa —
/// avval so'raladi. `true` — savat ochildi.
///
/// [order] — `FoodOrder` yoki `MarketOrder`.
Future<bool> runReorderFlow(BuildContext context, Object order) async {
  final l10n = context.l10n;
  final superapp = context.read<SuperappProvider>();
  final food = context.read<FoodProvider>();
  final market = context.read<MarketProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);

  final (kind, entityId) = switch (order) {
    FoodOrder o => ('food', o.restaurantId),
    MarketOrder o => ('market', o.storeId),
    _ => throw ArgumentError.value(order, 'order', 'FoodOrder yoki MarketOrder'),
  };

  if (!superapp.isCartEmpty) {
    final replace = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.saReorderReplaceTitle),
        content: Text(l10n.saReorderReplaceMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(l10n.saDialogCancel),
          ),
          FilledButton(
            key: const ValueKey('reorder-replace-confirm'),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(l10n.saReorderReplaceConfirm),
          ),
        ],
      ),
    );
    if (replace != true) return false;
  }

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(l10n.saReorderLoading)));

  final ReorderPlan? plan;
  try {
    plan = order is FoodOrder
        ? await planFoodReorder(food, order)
        : await planMarketReorder(market, order as MarketOrder);
  } catch (e) {
    debugPrint('[Reorder] plan failed: $e');
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.saReorderUnavailable)));
    return false;
  }
  messenger.hideCurrentSnackBar();

  if (plan == null) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.saReorderUnavailable)));
    return false;
  }
  if (plan.isEmpty) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.saReorderNothingAvailable)));
    return false;
  }

  // Kontekst boshqa joy bo'lsa savat o'zi tozalanadi; bir xil joy bo'lsa
  // ham eski savat almashtiriladi (yuqorida rozilik olingan).
  superapp
    ..setActiveContext(kind, entityId)
    ..clearCart();
  for (final item in plan.items) {
    superapp.addToCart(item);
  }
  AppHaptics.success();
  if (plan.isPartial) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.saReorderPartial(plan.missing))));
  }
  await navigator.push(MaterialPageRoute<void>(builder: (_) => const CartScreen()));
  return true;
}
