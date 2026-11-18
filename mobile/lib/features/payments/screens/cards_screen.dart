import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/features/payments/screens/add_card_screen.dart';
import 'package:angren_taxi/features/payments/state/saved_cards_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Kartani bog'lash ekranini ochadi; qo'shilgan kartani qaytaradi.
Future<SavedCard?> openAddCard(BuildContext context) =>
    Navigator.of(context).push<SavedCard>(
      MaterialPageRoute(builder: (_) => const AddCardScreen()),
    );

/// "Mening kartalarim": ro'yxat, asosiy kartani tanlash, o'chirish, qo'shish.
class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});

  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SavedCardsProvider>().load();
    });
  }

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } on SavedCardsException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.cardsActionFailed(e.message))),
      );
    }
  }

  Future<void> _confirmRemove(SavedCard card) async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.cardsRemoveConfirmTitle),
        content: Text(l10n.cardsRemoveConfirmMessage(card.maskedPan)),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(l10n.cardsCancel)),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: agRed),
            child: Text(l10n.cardsRemove),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await _guard(() => context.read<SavedCardsProvider>().remove(card.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final provider = context.watch<SavedCardsProvider>();
    final cards = provider.cards;

    return Scaffold(
      backgroundColor: agSurface2,
      body: Column(
        children: [
          AgHeader(
              title: l10n.cardsTitle,
              onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: RefreshIndicator(
              onRefresh: provider.load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    kSpace4, kSpace5, kSpace4, kSpace6),
                children: [
                  if (provider.isLoading && !provider.isLoaded)
                    const Padding(
                      padding: EdgeInsets.all(kSpace6),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (provider.error != null && cards.isEmpty)
                    InlineErrorWidget(
                        message: l10n.cardsLoadFailed, onRetry: provider.load)
                  else if (!provider.isEnabled)
                    _Notice(
                        title: l10n.saWalletCardsUnavailableTitle,
                        message: l10n.cardsErrUnavailable)
                  else ...[
                    if (cards.isEmpty)
                      _Notice(
                          title: l10n.cardsEmptyTitle,
                          message: l10n.cardsEmptyMessage)
                    else
                      AgSurfaceCard(
                        padding: const EdgeInsets.symmetric(vertical: kSpace2),
                        child: Column(
                          children: [
                            for (final card in cards)
                              SavedCardTile(
                                card: card,
                                onMakeDefault: card.isDefault
                                    ? null
                                    : () => _guard(
                                        () => provider.setDefault(card.id)),
                                onRemove: () => _confirmRemove(card),
                              ),
                          ],
                        ),
                      ),
                    const SizedBox(height: kSpace3),
                    Text(
                      l10n.cardsAutoChargeNote,
                      style: const TextStyle(
                          fontSize: kFontCaption,
                          color: agSubtle,
                          fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: kSpace5),
                    AppButton(
                      key: const Key('cards-add'),
                      label: l10n.cardsAdd,
                      icon: const Icon(Icons.add_card_rounded, size: 20),
                      onPressed: () => openAddCard(context),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta karta qatori. [onMakeDefault] — `null` bo'lsa karta allaqachon asosiy.
class SavedCardTile extends StatelessWidget {
  const SavedCardTile(
      {super.key, required this.card, this.onMakeDefault, this.onRemove});

  final SavedCard card;
  final VoidCallback? onMakeDefault;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final subtitle = [card.brandLabel, if (card.expiry != null) card.expiry!]
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return ListTile(
      leading: const ExcludeSemantics(
          child: Icon(Icons.credit_card_rounded, color: agPrimary)),
      title: Row(
        children: [
          Flexible(
            child: Text(
              card.maskedPan,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: agText,
                  fontSize: kFontBody),
            ),
          ),
          if (card.isDefault) ...[
            const SizedBox(width: kSpace2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                  color: agTint,
                  borderRadius: BorderRadius.circular(kRadiusSm)),
              child: Text(
                l10n.cardsDefaultBadge,
                style: const TextStyle(
                    fontSize: kFontCaption,
                    color: agGreenText,
                    fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
      subtitle: subtitle.isEmpty
          ? null
          : Text(subtitle, style: const TextStyle(color: agSubtle)),
      trailing: onRemove == null && onMakeDefault == null
          ? null
          : PopupMenuButton<String>(
              onSelected: (value) =>
                  value == 'default' ? onMakeDefault?.call() : onRemove?.call(),
              itemBuilder: (_) => [
                if (onMakeDefault != null)
                  PopupMenuItem(
                      value: 'default', child: Text(l10n.cardsMakeDefault)),
                if (onRemove != null)
                  PopupMenuItem(value: 'remove', child: Text(l10n.cardsRemove)),
              ],
            ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return AgSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: kFontBody,
                  color: agText)),
          const SizedBox(height: 2),
          Text(message,
              style: const TextStyle(
                  fontSize: kFontCaption,
                  color: agSubtle,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
