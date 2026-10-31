import 'dart:io' show Platform;

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/intercity_realtime.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_run_passenger_card.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Haydovchi joylashuvi (yig'ish tartibi uchun). `null` — noma'lum.
typedef IntercityLocate = Future<({double lat, double lng})?> Function();

/// Tashqi navigatorni ochish — testlarda soxtasi.
typedef IntercityNavigate = Future<void> Function(BuildContext context, double lat, double lng);

/// Haydovchi o'z shaharlararo qatnovini boshqaradi:
/// open/full → yig'ishni boshlash; boarding → har yo'lovchi "Yetib keldim" /
/// "Kelmadi", hammasi olingach surib jo'nash; in_progress → har yo'lovchi
/// "Tushirdim" (naqd summa ko'rsatiladi); yakunida jami naqd.
///
/// ⚠️ Har bir band MAVJUD `/orders/:id/arrived|complete` orqali o'tadi,
/// lekin `DriverProvider` ORQALI EMAS: u shahar safarining faol buyurtmasi
/// va safardan keyingi ekranlarni boshqaradi. Shaharlararo o'z ekranida
/// qoladi — tushirilgan yo'lovchi uchun reyting/chek oynasi ochilmaydi.
class IntercityTripRunScreen extends StatefulWidget {
  const IntercityTripRunScreen({
    super.key,
    required this.trip,
    this.repository,
    this.locate,
    this.now,
    this.subscribeRealtime = true,
    this.navigate,
  });

  final IntercityTrip trip;
  final IntercityRepository? repository;
  final IntercityLocate? locate;
  final IntercityNavigate? navigate;
  final DateTime Function()? now;

  /// Testlarda socket yo'q — obuna o'chiriladi.
  final bool subscribeRealtime;

  @override
  State<IntercityTripRunScreen> createState() => _IntercityTripRunScreenState();
}

class _IntercityTripRunScreenState extends State<IntercityTripRunScreen>
    with IntercityRealtimeRefresh {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();
  late IntercityTrip _trip = widget.trip;
  List<IntercityDriverBooking>? _bookings;

  /// Bekatlar rejasi (eng qisqa yo'l). Yuklanmasa — "eng yaqindan" tartib.
  IntercityRoutePlan? _plan;
  ({double lat, double lng})? _here;
  Object? _error;
  bool _busy = false;

  DateTime get _now => widget.now?.call() ?? DateTime.now();

  @override
  void initState() {
    super.initState();
    _locate();
    _load();
    if (widget.subscribeRealtime) subscribeIntercity(null, true);
  }

  @override
  void dispose() {
    if (widget.subscribeRealtime) unsubscribeIntercity();
    super.dispose();
  }

  @override
  void onTripEvent(String? tripId) {
    if (tripId == null || tripId == _trip.id) _load();
  }

  Future<void> _locate() async {
    final locate = widget.locate ?? _deviceLocation;
    try {
      final here = await locate();
      if (mounted && here != null) {
        setState(() => _here = here);
        // Birinchi oraliq vaqti haydovchi joyidan hisoblanadi.
        await _loadPlan();
      }
    } catch (_) {
      // Joylashuvsiz ham ishlaydi — server tartibi qoladi.
    }
  }

  static Future<({double lat, double lng})?> _deviceLocation() async {
    final position = await sl<LocationService>().getCurrentPosition();
    return position == null
        ? null
        : (lat: position.latitude, lng: position.longitude);
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _repo.trip(_trip.id),
        _repo.tripBookings(_trip.id),
      ]);
      if (!mounted) return;
      setState(() {
        _trip = results[0] as IntercityTrip;
        _bookings = results[1] as List<IntercityDriverBooking>;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
    await _loadPlan();
  }

  /// Reja ixtiyoriy: xato bo'lsa jim — ekran "eng yaqindan" tartib bilan ishlayveradi.
  Future<void> _loadPlan() async {
    try {
      final plan = await _repo.routePlan(_trip.id, fromLat: _here?.lat, fromLng: _here?.lng);
      if (mounted) setState(() => _plan = plan);
    } catch (_) {
      if (mounted) setState(() => _plan = null);
    }
  }

  Future<void> _navigateTo(IntercityRouteStop stop) async {
    final open = widget.navigate ?? _openExternalNavigation;
    await open(context, stop.lat, stop.lng);
  }

  /// `demand_map_screen` bilan bir xil naqsh: Androidda `geo:`, iOS'da Apple Maps.
  static Future<void> _openExternalNavigation(BuildContext context, double lat, double lng) async {
    final uri = Platform.isIOS
        ? Uri.parse('https://maps.apple.com/?daddr=$lat,$lng')
        : Uri.parse('geo:0,0?q=$lat,$lng');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.drvNavAppNotFound)),
      );
    }
  }

  /// Bitta amal: tugmalar bloklanadi, xato tushunarli matn bilan
  /// ko'rsatiladi va ekran HAR DOIM serverdan yangilanadi — holat boshqa
  /// joyda o'zgargan bo'lsa ham haydovchi haqiqiy ro'yxatni ko'radi.
  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_errorText(e))));
      }
    } finally {
      await _load();
      if (mounted) setState(() => _busy = false);
    }
  }

  String _errorText(Object error) {
    final api = ApiError.from(error);
    if (api?.code == IntercityErrorCode.tripActionNotAllowed) {
      final l10n = context.l10n;
      switch (api!.detailText('reason')) {
        case 'TOO_EARLY':
          return l10n.icRunReasonTooEarly;
        case 'NO_BOOKINGS':
          return l10n.icRunReasonNoBookings;
        case 'PASSENGERS_PENDING':
          return l10n.icRunReasonPending;
        case 'WRONG_STATUS':
          return l10n.icRunReasonWrongStatus;
      }
    }
    return intercityErrorMessage(error);
  }

  Future<void> _confirmNoShow(IntercityDriverBooking booking) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.icRunNoShowTitle),
        content: Text(l10n.icRunNoShowBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.icRunClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: kErrorDeep),
            child: Text(l10n.icRunNoShowConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true) await _run(() => _repo.noShow(booking.orderId));
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = _bottomAction();
    return Scaffold(
      appBar: AppBar(
        title:
            Text(intercityRouteLabel(_trip.originName, _trip.destinationName)),
      ),
      body: SafeArea(top: false, child: _body()),
      bottomNavigationBar: bottom == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    kSpace4, kSpace2, kSpace4, kSpace3),
                child: bottom,
              ),
            ),
    );
  }

  Widget _body() {
    final l10n = context.l10n;
    final bookings = _bookings;
    if (bookings == null && _error != null) {
      return AppErrorState(
          message: intercityErrorMessage(_error), onRetry: _load);
    }
    if (bookings == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final plan = _planForCurrentPhase();
    final ordered = orderBookingsByPlan(
      bookings,
      plan,
      fromLat: _here?.lat,
      fromLng: _here?.lng,
    );
    final stops = plan?.byOrderId ?? const <String, IntercityRouteStop>{};
    final next = nextPlannedStop(plan, bookings, onTheRoad: _trip.status == IntercityTripStatus.inProgress);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(kSpace4),
        children: [
          _header(),
          if (_trip.status == IntercityTripStatus.completed)
            _summary(
                l10n.icRunCompletedTitle,
                l10n.icRunTotalCash(
                    Formatters.formatPrice(intercityCashTotal(bookings)))),
          if (_trip.status == IntercityTripStatus.cancelled)
            _summary(l10n.icRunCancelledTitle, _trip.cancelReason),
          const SizedBox(height: kSpace3),
          Text(
            l10n.icRunPassengers,
            style: const TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w700,
              color: kInkMuted,
            ),
          ),
          if (plan != null && plan.stops.isNotEmpty) _planLine(plan),
          const SizedBox(height: kSpace2),
          if (ordered.isEmpty)
            AppEmptyState(
              icon: Icons.people_outline_rounded,
              title: l10n.icRunNoBookings,
            ),
          for (final booking in ordered)
            IntercityRunPassengerCard(
              key: ValueKey('ic_run_passenger_${booking.orderId}'),
              booking: booking,
              tripStatus: _trip.status,
              busy: _busy,
              onArrived: () => _run(() => _repo.markArrived(booking.orderId)),
              onNoShow: () => _confirmNoShow(booking),
              onDropOff: () =>
                  _run(() => _repo.completeBooking(booking.orderId)),
              onCall: _call,
              sequence: stops[booking.orderId]?.sequence,
              etaMinutes: stops[booking.orderId]?.etaMinutesFromPrev,
              onNavigate: next != null && next.orderId == booking.orderId ? () => _navigateTo(next) : null,
            ),
        ],
      ),
    );
  }

  /// Reja joriy bosqichga tegishli bo'lsagina (yig'ishda — olish, yo'lda — tushirish).
  IntercityRoutePlan? _planForCurrentPhase() {
    final plan = _plan;
    if (plan == null) return null;
    final onTheRoad = _trip.status == IntercityTripStatus.inProgress;
    return plan.phase == (onTheRoad ? 'dropoff' : 'pickup') ? plan : null;
  }

  Widget _planLine(IntercityRoutePlan plan) {
    final l10n = context.l10n;
    final total = plan.totalMinutes;
    final terminal = plan.terminalEtaMinutes;
    final lines = [
      if (plan.optimized && total != null) l10n.icRunOrderOptimized(total) else l10n.icRunOrderNearest,
      if (terminal != null) l10n.icRunTerminal(plan.pointName, terminal),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: kSpace1),
      child: Text(
        lines.join('\n'),
        key: const ValueKey('ic_run_plan_line'),
        style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
      ),
    );
  }

  Widget _header() {
    final l10n = context.l10n;
    final trip = _trip;
    return AgSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            formatTashkentDayTime(trip.departureAt),
            style: const TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            '${intercityTripStatusLabel(trip.status)} · '
            '${intercityClassLabel(trip.tripClass)} · '
            '${trip.wholeCarBooked ? l10n.icDrvWholeCarBooked : l10n.icDrvSeatsTaken(trip.seatsTaken, trip.seatsTotal)}',
            style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
          ),
        ],
      ),
    );
  }

  Widget _summary(String title, String? body) => Padding(
        padding: const EdgeInsets.only(top: kSpace3),
        child: AgSurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: kFontBodyLg,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              if (body != null) ...[
                const SizedBox(height: kSpace1),
                Text(
                  body,
                  style: const TextStyle(
                    fontSize: kFontBodyLg,
                    fontWeight: FontWeight.w700,
                    color: kInk,
                  ),
                ),
              ],
            ],
          ),
        ),
      );

  /// Pastki asosiy amal — holatga qarab bittasi yoki hech biri.
  Widget? _bottomAction() {
    final l10n = context.l10n;
    final bookings = _bookings;
    if (bookings == null) return null;
    final status = _trip.status;

    if (status == IntercityTripStatus.open ||
        status == IntercityTripStatus.full) {
      final allowed = canStartBoarding(_trip, _now);
      final enabled = !_busy && allowed;
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Izoh faqat amal HAQIQATAN yopiq bo'lsa — so'rov ketayotganda emas.
          if (!allowed) _hint(l10n.icRunStartBoardingHint),
          SizedBox(
            key: const ValueKey('ic_run_start_boarding'),
            height: kControlHeightDriver,
            child: FilledButton(
              onPressed: enabled
                  ? () => _run(() => _repo.startBoarding(_trip.id))
                  : null,
              child: Text(l10n.icRunStartBoarding),
            ),
          ),
        ],
      );
    }

    if (status == IntercityTripStatus.boarding) {
      final allowed = canDepart(status, bookings);
      final enabled = !_busy && allowed;
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!allowed) _hint(l10n.icRunDepartHint),
          AgSlideAction(
            key: const ValueKey('ic_run_depart'),
            label: l10n.icRunDepart,
            enabled: enabled,
            onCompleted: () => _run(() => _repo.depart(_trip.id)),
          ),
        ],
      );
    }
    return null;
  }

  Widget _hint(String text) => Padding(
        padding: const EdgeInsets.only(bottom: kSpace2),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
        ),
      );
}
