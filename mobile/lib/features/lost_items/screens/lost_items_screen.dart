import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/lost_items/lost_items_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/lost_item_report.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// Yo'qolgan buyumlar ro'yxati.
///
/// Yo'lovchi o'z xabarlari holatini ko'radi. Haydovchi esa o'z safarlari
/// bo'yicha xabarlarni ko'radi va ochiqlariga "Topdim / Topmadim" deb
/// javob beradi — yo'lovchi telefoni unga ko'rsatilmaydi, topshirishni
/// operator kelishadi.
class LostItemsScreen extends StatefulWidget {
  const LostItemsScreen({super.key, required this.isDriver, this.service});

  final bool isDriver;
  final LostItemsService? service;

  @override
  State<LostItemsScreen> createState() => _LostItemsScreenState();
}

class _LostItemsScreenState extends State<LostItemsScreen> {
  late final LostItemsService _service =
      widget.service ?? LostItemsService(sl<ApiClient>());
  List<LostItemReport> _items = const [];
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _service.mine();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _respond(LostItemReport item, {required bool found}) async {
    final note = found ? await _askNote() : null;
    if (found && note == null) return; // dialog bekor qilindi
    setState(() => _busyId = item.id);
    try {
      final updated = await _service.driverRespond(item.id, found: found, note: note);
      if (!mounted) return;
      setState(() {
        _items = [for (final i in _items) i.id == updated.id ? updated : i];
        _busyId = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _busyId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(extractErrorMessage(e))),
      );
    }
  }

  /// "Topdim" da buyum qayerda turganini so'raymiz — operator topshirishni
  /// kelishayotganda shu izohdan foydalanadi. Bo'sh qoldirish mumkin.
  Future<String?> _askNote() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.saLostItemFoundTitle),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 500,
          decoration: InputDecoration(
            hintText: context.l10n.saLostItemWhereHint,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(context.l10n.saCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            child: Text(context.l10n.saSend),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.saLostItemsTitle)),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return AppErrorState(message: _error!, onRetry: _load);
    if (_items.isEmpty) {
      return AppEmptyState(
        icon: Icons.inventory_2_outlined,
        title: context.l10n.saLostItemsEmptyTitle,
        message: widget.isDriver
            ? context.l10n.saLostItemsEmptyDriver
            : context.l10n.saLostItemsEmptyPassenger,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(kSpace4),
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, index) => _LostItemCard(
          item: _items[index],
          isDriver: widget.isDriver,
          busy: _busyId == _items[index].id,
          onFound: () => _respond(_items[index], found: true),
          onNotFound: () => _respond(_items[index], found: false),
        ),
      ),
    );
  }
}

class _LostItemCard extends StatelessWidget {
  const _LostItemCard({
    required this.item,
    required this.isDriver,
    required this.busy,
    required this.onFound,
    required this.onNotFound,
  });

  final LostItemReport item;
  final bool isDriver;
  final bool busy;
  final VoidCallback onFound;
  final VoidCallback onNotFound;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(item.status.icon, size: 18, color: kInkMuted),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  item.status.label,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                Formatters.formatDateTime(item.createdAt),
                style: const TextStyle(color: kInkMuted, fontSize: kFontCaption),
              ),
            ],
          ),
          const SizedBox(height: kSpace2),
          Text(item.description, style: const TextStyle(fontSize: kFontBodyLg)),
          if (item.driverNote != null) ...[
            const SizedBox(height: kSpace2),
            Text(
              context.l10n.saLostItemDriverNote(item.driverNote!),
              style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
            ),
          ],
          if (item.operatorNote != null) ...[
            const SizedBox(height: kSpace1),
            Text(
              context.l10n.saLostItemOperatorNote(item.operatorNote!),
              style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
            ),
          ],
          if (isDriver && item.awaitsDriver) ...[
            const SizedBox(height: kSpace3),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onNotFound,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(kMinTapTargetDriver),
                    ),
                    child: Text(context.l10n.saLostItemNotFound),
                  ),
                ),
                const SizedBox(width: kSpace3),
                Expanded(
                  child: FilledButton(
                    onPressed: busy ? null : onFound,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(kMinTapTargetDriver),
                    ),
                    child: Text(context.l10n.saLostItemFound),
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
