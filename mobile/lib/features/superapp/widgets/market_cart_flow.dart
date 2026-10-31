import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Market mahsulotini savatga qo'shadi — QAYSI ekrandan bo'lsa ham.
///
/// ⚠️ Savat BITTA do'konga bog'langan: checkout buyurtmani
/// `MarketProvider.store` ga yuboradi. Bosh sahifa lentasida turli
/// do'konlarning mahsuloti aralash, shuning uchun:
///  · boshqa do'kon (yoki ovqat) savati bo'lsa — avval SO'RALADI, jim
///    tozalanmaydi;
///  · do'kon yuklanadi va checkout aynan o'sha do'konga ketishi tekshiriladi
///    (do'kon yopilgan bo'lsa `loadStore` boshqasiga qaytadi — shunda
///    qo'shilmaydi, xabar ko'rsatiladi).
/// `storeId` siz mahsulot (do'kon ekrani, eski server) — avvalgidek qo'shiladi.
///
/// Qo'shildi — `true`.
Future<bool> addMarketProductToCart(BuildContext context, MarketProduct product) async {
  final superapp = context.read<SuperappProvider>();
  final storeId = product.storeId;
  final sameStore = storeId == null ||
      (superapp.activeKind == 'market' && superapp.activeEntityId == storeId);

  if (!sameStore) {
    if (!superapp.isCartEmpty) {
      final confirmed = await _confirmReplaceCart(context, product.storeName);
      if (confirmed != true || !context.mounted) return false;
    }
    final market = context.read<MarketProvider>();
    await market.loadStore(storeId: storeId);
    if (!context.mounted) return false;
    if (market.store?.id != storeId) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.saStoreUnavailable)),
      );
      return false;
    }
    superapp.setActiveContext('market', storeId);
  }

  superapp.addToCart(
    CartItem(
      id: product.id,
      name: product.name,
      price: product.effectivePrice,
      qty: 1,
      icon: product.icon,
      color: product.color,
      imageUrl: product.imageUrl,
    ),
  );
  return true;
}

Future<bool?> _confirmReplaceCart(BuildContext context, String? storeName) {
  final l10n = context.l10n;
  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(l10n.saOtherStoreTitle),
      content: Text(l10n.saOtherStoreBody(storeName ?? '')),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(l10n.saCancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(l10n.saOtherStoreConfirm),
        ),
      ],
    ),
  );
}
