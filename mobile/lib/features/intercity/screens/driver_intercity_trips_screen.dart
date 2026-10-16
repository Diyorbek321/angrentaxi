import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_publish_screen.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_cancel_trip_dialog.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// Haydovchining shaharlararo qatnovlari: kelgusi (jo'nash bo'yicha) va
/// o'tgan. Yangi qatnov e'lon qilish va bekor qilish shu yerdan.
///
/// ⚠️ Yig'ish/jo'nash/tushirish ekrani HALI YO'Q — server haydovchiga
/// qatnovdagi bandlar ro'yxatini (yo'lovchi, olib ketish nuqtasi) bermaydi.
/// U qo'shilguncha bu ekran faqat e'lon va bekor qilishni boshqaradi.
class DriverIntercityTripsScreen extends StatefulWidget {
  const DriverIntercityTripsScreen({
    super.key,
    this.repository,
    this.settings,
    this.now,
  });

  final IntercityRepository? repository;

  /// Berilmasa serverdan o'qiladi (e'lon oynasi uchun kerak).
  final IntercityPublicSettings? settings;
  final DateTime Function()? now;

  @override
  State<DriverIntercityTripsScreen> createState() =>
      _DriverIntercityTripsScreenState();
}

class _DriverIntercityTripsScreenState extends State<DriverIntercityTripsScreen>
    with IntercityRealtimeRefresh {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();

  IntercityDriverTrips? _trips;
  Object? _error;
  late IntercityPublicSettings? _settings = widget.settings;

  @override
  void initState() {
    super.initState();
    _load();
    subscribeIntercity(null, true);
  }

  @override
  void dispose() {
    unsubscribeIntercity();
    super.dispose();
  }

  @override
  void onTripEvent(String? tripId) => _load();

  Future<void> _load() async {
    try {
      final trips = await _repo.myTrips();
      _settings ??= await _repo.publicSettings();
      if (!mounted) return;
      setState(() {
        _trips = IntercityDriverTrips.split(trips);
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _publish() async {
    final published = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => IntercityPublishScreen(
          repository: _repo,
          settings: _settings ?? IntercityPublicSettings.disabled,
          now: widget.now,
        ),
      ),
    );
    if (published == true) await _load();
  }

  Future<void> _cancel(IntercityTrip trip) async {
    final cancelled = await showIntercityCancelTripDialog(
      context,
      onConfirm: (reason) => _repo.cancelTrip(trip.id, reason: reason),
    );
    if (!mounted || cancelled != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.icDrvTripCancelled)),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.icDrvMyTripsTitle)),
      body: SafeArea(top: false, child: _body()),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace2, kSpace4, kSpace3),
          child: AppButton(
            key: const ValueKey('ic_trips_new'),
            label: l10n.icDrvNewTrip,
            icon: const Icon(Icons.add_rounded, color: kOnPrimary),
            height: kControlHeightDriver,
            onPressed: _publish,
          ),
        ),
      ),
    );
  }

  Widget _body() {
    final l10n = context.l10n;
    final trips = _trips;
    if (trips == null && _error != null) {
      return AppErrorState(
        message: intercityErrorMessage(_error),
        onRetry: _load,
      );
    }
    if (trips == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (trips.upcoming.isEmpty && trips.past.isEmpty) {
      return AppEmptyState(
        icon: Icons.route_rounded,
        title: l10n.icDrvNoTrips,
        message: l10n.icDrvNoTripsHint,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(kSpace4),
        children: [
          if (trips.upcoming.isNotEmpty) ...[
            _SectionTitle(l10n.icDrvUpcoming),
            for (final t in trips.upcoming) _tile(t),
          ],
          if (trips.past.isNotEmpty) ...[
            _SectionTitle(l10n.icDrvPast),
            for (final t in trips.past) _tile(t),
          ],
        ],
      ),
    );
  }

  Widget _tile(IntercityTrip trip) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.only(bottom: kSpace3),
      child: AgSurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    intercityRouteLabel(trip.originName, trip.destinationName),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontBodyLg,
                      fontWeight: FontWeight.w700,
                      color: kInk,
                    ),
                  ),
                ),
                const SizedBox(width: kSpace2),
                AppStatusBadge(
                  label: intercityTripStatusLabel(trip.status),
                  tone: _tone(trip.status),
                  dense: true,
                ),
              ],
            ),
            const SizedBox(height: kSpace1),
            Text(
              '${formatTashkentDayTime(trip.departureAt)} · '
              '${intercityClassLabel(trip.tripClass)} · '
              '${trip.wholeCarBooked ? l10n.icDrvWholeCarBooked : l10n.icDrvSeatsTaken(trip.seatsTaken, trip.seatsTotal)}',
              style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
            ),
            if (canCancelTrip(trip)) ...[
              const SizedBox(height: kSpace2),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  key: ValueKey('ic_trip_cancel_${trip.id}'),
                  onPressed: () => _cancel(trip),
                  style: TextButton.styleFrom(foregroundColor: kErrorDeep),
                  child: Text(l10n.icDrvCancelTrip),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static AppStatusTone _tone(String status) => switch (status) {
        IntercityTripStatus.open => AppStatusTone.info,
        IntercityTripStatus.full ||
        IntercityTripStatus.boarding ||
        IntercityTripStatus.inProgress =>
          AppStatusTone.success,
        IntercityTripStatus.cancelled => AppStatusTone.danger,
        _ => AppStatusTone.neutral,
      };
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: kSpace2, bottom: kSpace2),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: kFontLabel,
            fontWeight: FontWeight.w700,
            color: kInkMuted,
          ),
        ),
      );
}
