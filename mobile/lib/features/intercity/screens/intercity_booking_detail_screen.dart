import 'dart:async';

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_price_breakdown.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Bitta band: holat, jo'nashgacha vaqt, haydovchi, bekor qilish.
class IntercityBookingDetailScreen extends StatefulWidget {
  const IntercityBookingDetailScreen({
    super.key,
    required this.booking,
    this.settings = IntercityPublicSettings.disabled,
    this.repository,
    this.socket,
    this.now,
  });

  final IntercityBooking booking;
  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final SocketService? socket;
  final DateTime Function()? now;

  @override
  State<IntercityBookingDetailScreen> createState() =>
      _IntercityBookingDetailScreenState();
}

class _IntercityBookingDetailScreenState
    extends State<IntercityBookingDetailScreen> with IntercityRealtimeRefresh {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();
  late IntercityBooking _booking = widget.booking;
  bool _cancelling = false;
  Timer? _ticker;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    subscribeIntercity(widget.socket);
    // Ortga sanoq daqiqa aniqligida — har 30 soniyada qayta chizish yetarli.
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    unsubscribeIntercity();
    super.dispose();
  }

  @override
  void onTripEvent(String? tripId) {
    if (tripId == null || tripId == _booking.trip?.id) _reload();
  }

  /// Alohida "bitta band" endpoint'i yo'q — ro'yxatdan topiladi.
  Future<void> _reload() async {
    try {
      final items = await _repo.myBookings();
      final fresh = items.where((b) => b.orderId == _booking.orderId);
      if (mounted && fresh.isNotEmpty) setState(() => _booking = fresh.first);
    } catch (_) {
      // Eski ma'lumot qoladi; foydalanuvchi ro'yxatga qaytib yangilaydi.
    }
  }

  DateTime? get _freeCancelDeadline => _booking.trip?.departureAt.subtract(
        Duration(minutes: widget.settings.freeCancelMinutes),
      );

  bool get _isLateCancel {
    final deadline = _freeCancelDeadline;
    return deadline != null && !_now().isBefore(deadline);
  }

  Future<void> _confirmCancel() async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.icCancelConfirmTitle),
        content: _isLateCancel ? Text(l10n.icLateCancelWarning) : null,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.icCancelConfirmNo),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.icCancelConfirmYes),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      final updated = await _repo.cancelBooking(_booking.orderId);
      if (!mounted) return;
      setState(() => _booking = updated);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.icCancelled)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(intercityErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final trip = _booking.trip;
    return Scaffold(
      backgroundColor: agBg,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            AgHeader(
              title: trip == null
                  ? l10n.icSearchTitle
                  : '${trip.originName} → ${trip.destinationName}',
              subtitle: intercityBookingStatusLabel(_booking.status),
              onBack: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: ResponsiveContent(
                child: ListView(
                  padding: const EdgeInsets.all(kSpace4),
                  children: [
                    if (trip != null) _tripCard(context, trip),
                    const SizedBox(height: kSpace3),
                    _detailsCard(context),
                    if (_booking.isCancellable) ...[
                      const SizedBox(height: kSpace5),
                      _cancelSection(context),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tripCard(BuildContext context, IntercityTrip trip) {
    final l10n = context.l10n;
    final untilDeparture = trip.departureAt.difference(_now());
    final phone = _booking.driverPhone;
    final driver = trip.driver;
    return _Card(
      children: [
        _Row(
          label: l10n.icDeparture,
          value: formatTashkentDayTime(trip.departureAt),
        ),
        if (!_booking.isFinished && !untilDeparture.isNegative)
          Padding(
            padding: const EdgeInsets.only(top: kSpace1),
            child: Text(
              l10n.icDepartsIn(formatIntercityDuration(untilDeparture)),
              style: const TextStyle(
                fontSize: kFontLabel,
                fontWeight: FontWeight.w700,
                color: agGreenText,
              ),
            ),
          ),
        if (trip.isCancelled)
          Padding(
            padding: const EdgeInsets.only(top: kSpace1),
            child: Text(
              l10n.icTripCancelled,
              style: const TextStyle(fontSize: kFontLabel, color: agRed),
            ),
          ),
        const Divider(height: kSpace6),
        _Row(
          label: driver?.firstName ?? l10n.icDriverUnknown,
          value: [driver?.carModel, driver?.plate]
              .whereType<String>()
              .join(' · '),
        ),
        const SizedBox(height: kSpace2),
        if (phone != null)
          AppButton(
            label: l10n.icCallDriver,
            icon: const Icon(Icons.call_rounded, size: 20),
            onPressed: () => _call(phone),
          )
        else if (!_booking.isFinished)
          Text(
            l10n.icDriverPhoneHidden,
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
          ),
      ],
    );
  }

  Widget _detailsCard(BuildContext context) {
    final l10n = context.l10n;
    return _Card(
      children: [
        _Row(
          label: _booking.isWholeCar ? l10n.icKindWholeCar : l10n.icKindSeat,
          value: _booking.isWholeCar
              ? ''
              : l10n.icSeatsBooked(_booking.seats ?? 1),
        ),
        const SizedBox(height: kSpace2),
        if (_booking.pickupAddress != null)
          _Row(label: l10n.icPickup, value: _booking.pickupAddress!),
        const SizedBox(height: kSpace2),
        if (_booking.dropoffAddress != null)
          _Row(label: l10n.icDropoff, value: _booking.dropoffAddress!),
        const Divider(height: kSpace6),
        IntercityPriceBreakdown(
          basePrice: _booking.basePrice,
          extensions: _booking.extensions,
        ),
        _Row(
          label: l10n.icTotal,
          value: Formatters.formatPrice(_booking.price),
          strong: true,
        ),
        const SizedBox(height: kSpace1),
        Text(
          l10n.icPaymentCash,
          style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
        ),
      ],
    );
  }

  Widget _cancelSection(BuildContext context) {
    final l10n = context.l10n;
    final deadline = _freeCancelDeadline;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _isLateCancel || deadline == null
              ? l10n.icLateCancelWarning
              : l10n.icFreeCancelUntil(formatTashkentDayTime(deadline)),
          style: TextStyle(
            fontSize: kFontCaption,
            color: _isLateCancel ? agRed : agSubtle,
          ),
        ),
        const SizedBox(height: kSpace3),
        AppButton(
          label: l10n.icCancelBooking,
          isLoading: _cancelling,
          backgroundColor: agSurface,
          foregroundColor: agRed,
          onPressed: _cancelling ? null : _confirmCancel,
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(agRadiusMd),
        border: Border.all(color: agBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: kFontBody,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
              color: agText,
            ),
          ),
        ),
        const SizedBox(width: kSpace3),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: strong ? kFontH3 : kFontBody,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
              color: strong ? agText : agSubtle,
            ),
          ),
        ),
      ],
    );
  }
}
