import 'dart:math' as math;

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_bookings_screen.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_bonus_stepper.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:flutter/material.dart';

/// "Mening so'rovlarim": ochiq so'rovda narxni oshirish va bekor qilish,
/// qabul qilinganida — bandga o'tish. Haydovchi topilsa yoki muddat tugasa
/// ro'yxat socket orqali o'zi yangilanadi.
class IntercityRequestsScreen extends StatefulWidget {
  const IntercityRequestsScreen({
    super.key,
    this.settings = IntercityPublicSettings.disabled,
    this.repository,
    this.socket,
    this.now,
  });

  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final SocketService? socket;
  final DateTime Function()? now;

  @override
  State<IntercityRequestsScreen> createState() => _IntercityRequestsScreenState();
}

class _IntercityRequestsScreenState extends State<IntercityRequestsScreen> with IntercityRequestRealtime {
  late final IntercityRepository _repo = widget.repository ?? IntercityRepository();
  List<IntercityRequest>? _items;
  Object? _error;

  /// Amal bajarilayotgan so'rov — tugmalar ikki marta bosilmasin.
  String? _busyId;

  @override
  void initState() {
    super.initState();
    subscribeRequests(socket: widget.socket);
    _load();
  }

  @override
  void dispose() {
    unsubscribeRequests();
    super.dispose();
  }

  @override
  void onRequestEvent(String? requestId) => _load();

  /// Socket hodisasidan kelgan sekin javob oshirish/bekor qilish natijasining
  /// ustiga eski ma'lumot yozmasin.
  int _loadSeq = 0;

  Future<void> _load() async {
    final seq = ++_loadSeq;
    try {
      final items = await _repo.myRequests();
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } catch (e) {
      if (mounted && seq == _loadSeq) setState(() => _error = e);
    }
  }

  void _replace(IntercityRequest updated) {
    _loadSeq++; // ketayotgan yuklash endi eskirgan
    setState(() {
      _items = [
        for (final r in _items ?? const <IntercityRequest>[]) r.id == updated.id ? updated : r,
      ];
    });
  }

  Future<void> _run(IntercityRequest request, Future<IntercityRequest> Function() action, String done) async {
    setState(() => _busyId = request.id);
    try {
      final updated = await action();
      if (!mounted) return;
      _replace(updated);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(intercityErrorMessage(e))));
      // Haydovchi shu orada oldi yoki muddat tugadi — haqiqiy holatni ko'rsatamiz.
      if (isRequestClosed(e)) await _load();
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _raise(IntercityRequest request) async {
    final l10n = context.l10n;
    final bonus = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: agSurface,
      builder: (_) => _RaiseSheet(request: request),
    );
    if (bonus == null || !mounted) return;
    await _run(request, () => _repo.raiseRequestBonus(request.id, bonus), l10n.icReqRaised);
  }

  Future<void> _cancel(IntercityRequest request) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.icReqCancelTitle),
        content: Text(l10n.icReqCancelBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.icReqCancelKeep)),
          TextButton(
            key: const ValueKey('ic_req_cancel_confirm'),
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.icReqCancelConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(request, () => _repo.cancelRequest(request.id), l10n.icReqCancelled);
  }

  void _openBookings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => IntercityBookingsScreen(
          settings: widget.settings,
          repository: _repo,
          socket: widget.socket,
          now: widget.now,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: agBg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            AgHeader(title: l10n.icReqMineTitle, onBack: () => Navigator.of(context).maybePop()),
            Expanded(child: ResponsiveContent(child: _body(context))),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final l10n = context.l10n;
    if (_error != null && _items == null) {
      return AppEmptyState(
        icon: Icons.cloud_off_rounded,
        title: l10n.icLoadError,
        message: intercityErrorMessage(_error),
        actionLabel: l10n.icRetry,
        onAction: _load,
      );
    }
    final items = _items;
    if (items == null) return const Center(child: CircularProgressIndicator());
    if (items.isEmpty) {
      return AppEmptyState(
        icon: Icons.campaign_outlined,
        title: l10n.icReqMineEmpty,
        message: l10n.icReqMineEmptyHint,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, i) {
          final request = items[i];
          return _RequestTile(
            request: request,
            busy: _busyId == request.id,
            onRaise: request.canRaise ? () => _raise(request) : null,
            onCancel: request.isOpen ? () => _cancel(request) : null,
            onOpenBooking: request.isAccepted ? _openBookings : null,
          );
        },
      ),
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({
    required this.request,
    required this.busy,
    this.onRaise,
    this.onCancel,
    this.onOpenBooking,
  });

  final IntercityRequest request;
  final bool busy;
  final VoidCallback? onRaise;
  final VoidCallback? onCancel;
  final VoidCallback? onOpenBooking;

  Color get _statusColor => switch (request.status) {
        IntercityRequestStatus.open => agGreenText,
        IntercityRequestStatus.accepted => agGreenText,
        _ => agSubtle,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final what = request.isWholeCar ? l10n.icKindWholeCar : l10n.icReqSeats(request.seats);
    return Container(
      key: ValueKey('ic_req_tile_${request.id}'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(agRadiusMd),
        border: Border.all(color: agBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  intercityRouteLabel(request.originName, request.destinationName),
                  style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w800, color: agText),
                ),
              ),
              Text(
                intercityRequestStatusLabel(request.status),
                style: TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: _statusColor),
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          Text(
            '${formatTashkentWindow(request.windowStart, request.windowEnd)} · $what · ${intercityClassLabel(request.tripClass)}',
            style: const TextStyle(fontSize: kFontLabel, color: agSubtle),
          ),
          const SizedBox(height: kSpace2),
          Row(
            children: [
              Expanded(
                child: Text(
                  request.isOpen ? l10n.icReqWaiting : (request.isAccepted ? l10n.icReqFound : ''),
                  style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
                ),
              ),
              if (request.bonus > 0) ...[
                Text(
                  '+${Formatters.formatPrice(request.bonus)}',
                  style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w700, color: agGreenText),
                ),
                const SizedBox(width: kSpace2),
              ],
              Text(
                Formatters.formatPrice(request.total),
                key: ValueKey('ic_req_tile_total_${request.id}'),
                style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w800, color: agText),
              ),
            ],
          ),
          if (onRaise != null || onCancel != null || onOpenBooking != null) ...[
            const SizedBox(height: kSpace2),
            Wrap(
              spacing: kSpace2,
              children: [
                if (onOpenBooking != null)
                  TextButton.icon(
                    onPressed: onOpenBooking,
                    icon: const Icon(Icons.confirmation_number_outlined),
                    label: Text(l10n.icReqOpenBooking),
                  ),
                if (onRaise != null)
                  TextButton.icon(
                    key: ValueKey('ic_req_raise_${request.id}'),
                    onPressed: busy ? null : onRaise,
                    icon: const Icon(Icons.trending_up_rounded),
                    label: Text(l10n.icReqRaise),
                  ),
                if (onCancel != null)
                  TextButton(
                    key: ValueKey('ic_req_cancel_${request.id}'),
                    onPressed: busy ? null : onCancel,
                    style: TextButton.styleFrom(foregroundColor: agRed),
                    child: Text(l10n.icReqCancel),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Yangi JAMI qo'shimchani tanlash — pastki chegara joriy + bir qadam.
class _RaiseSheet extends StatefulWidget {
  const _RaiseSheet({required this.request});

  final IntercityRequest request;

  @override
  State<_RaiseSheet> createState() => _RaiseSheetState();
}

class _RaiseSheetState extends State<_RaiseSheet> {
  late final int _min = widget.request.bonus.toInt() + widget.request.bonusStep;
  late final int _max = math.max(_min, (widget.request.maxBonus ~/ widget.request.bonusStep) * widget.request.bonusStep);
  late int _value = _min;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final request = widget.request;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.icReqRaiseTitle,
              style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText),
            ),
            const SizedBox(height: kSpace1),
            Text(l10n.icReqRaiseHint, style: const TextStyle(fontSize: kFontLabel, color: agSubtle)),
            const SizedBox(height: kSpace3),
            IntercityBonusStepper(
              value: _value,
              min: _min,
              max: _max,
              step: request.bonusStep,
              onChanged: (value) => setState(() => _value = value),
            ),
            const SizedBox(height: kSpace2),
            Row(
              children: [
                Expanded(child: Text(l10n.icTotal, style: const TextStyle(fontSize: kFontBody, color: agSubtle))),
                Text(
                  Formatters.formatPrice(request.basePrice + _value),
                  key: const ValueKey('ic_req_raise_total'),
                  style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText),
                ),
              ],
            ),
            const SizedBox(height: kSpace3),
            AppButton(
              key: const ValueKey('ic_req_raise_confirm'),
              label: l10n.icReqRaiseConfirm,
              onPressed: () => Navigator.of(context).pop(_value),
            ),
          ],
        ),
      ),
    );
  }
}
