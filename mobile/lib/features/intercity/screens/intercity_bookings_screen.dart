import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_detail_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

/// "Mening bandlarim" — yaqinlashayotganlari tepada (server tartibi).
class IntercityBookingsScreen extends StatefulWidget {
  const IntercityBookingsScreen({
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
  State<IntercityBookingsScreen> createState() =>
      _IntercityBookingsScreenState();
}

class _IntercityBookingsScreenState extends State<IntercityBookingsScreen>
    with IntercityRealtimeRefresh {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();
  List<IntercityBooking>? _items;
  Object? _error;

  @override
  void initState() {
    super.initState();
    subscribeIntercity(widget.socket);
    _load();
  }

  @override
  void dispose() {
    unsubscribeIntercity();
    super.dispose();
  }

  @override
  void onTripEvent(String? tripId) {
    final known = _items?.any((b) => b.trip?.id == tripId) ?? false;
    if (tripId == null || known) _load();
  }

  Future<void> _load() async {
    try {
      final items = await _repo.myBookings();
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _open(IntercityBooking booking) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => IntercityBookingDetailScreen(
          booking: booking,
          settings: widget.settings,
          repository: _repo,
          socket: widget.socket,
          now: widget.now,
        ),
      ),
    );
    if (mounted) await _load();
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
            AgHeader(
              title: l10n.icMyBookings,
              onBack: () => Navigator.of(context).maybePop(),
            ),
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
        icon: Icons.confirmation_number_outlined,
        title: l10n.icNoBookings,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, i) => _BookingTile(
          booking: items[i],
          onTap: () => _open(items[i]),
        ),
      ),
    );
  }
}

class _BookingTile extends StatelessWidget {
  const _BookingTile({required this.booking, required this.onTap});

  final IntercityBooking booking;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final trip = booking.trip;
    return AppPressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(agRadiusMd),
          border: Border.all(color: agBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              trip == null
                  ? l10n.icSearchTitle
                  : '${trip.originName} → ${trip.destinationName}',
              style: const TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w800,
                color: agText,
              ),
            ),
            const SizedBox(height: kSpace1),
            if (trip != null)
              Text(
                formatTashkentDayTime(trip.departureAt),
                style: const TextStyle(fontSize: kFontLabel, color: agSubtle),
              ),
            const SizedBox(height: kSpace2),
            Row(
              children: [
                Expanded(
                  child: Text(
                    intercityBookingStatusLabel(booking.status),
                    style: TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w700,
                      color: booking.isCancelled ? agSubtle : agGreenText,
                    ),
                  ),
                ),
                Text(
                  Formatters.formatPrice(booking.price),
                  style: const TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w800,
                    color: agText,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
