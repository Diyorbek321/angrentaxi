import 'dart:math' as math;

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/passenger/screens/map_picker_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

/// Manzil tanlash — testlarda xarita o'rniga soxtasi beriladi.
typedef IntercityLocationPicker = Future<OrderLocation?> Function(
  BuildContext context, {
  required String title,
  required IntercityPoint area,
});

Future<OrderLocation?> _mapPicker(
  BuildContext context, {
  required String title,
  required IntercityPoint area,
}) =>
    Navigator.of(context).push<OrderLocation>(
      MaterialPageRoute(
        builder: (_) => MapPickerScreen(
          title: title,
          initialLocation: LatLng(area.centerLat, area.centerLng),
        ),
      ),
    );

/// Joy yoki butun mashinani band qilish. Muvaffaqiyatda bandni qaytarib
/// yopiladi (`Navigator.pop(booking)`).
class IntercityBookingScreen extends StatefulWidget {
  const IntercityBookingScreen({
    super.key,
    required this.trip,
    required this.route,
    this.settings = IntercityPublicSettings.disabled,
    this.repository,
    this.pickLocation,
  });

  final IntercityTrip trip;
  final IntercityRoute route;
  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final IntercityLocationPicker? pickLocation;

  @override
  State<IntercityBookingScreen> createState() => _IntercityBookingScreenState();
}

class _IntercityBookingScreenState extends State<IntercityBookingScreen> {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();
  late IntercityTrip _trip = widget.trip;
  String _kind = IntercityBookingKind.seat;
  int _seats = 1;
  OrderLocation? _pickup;
  OrderLocation? _dropoff;
  bool _submitting = false;

  IntercityPoint get _origin => widget.route.origin;
  IntercityPoint get _destination => widget.route.destination;

  /// Rohat krugi kabi kichik nuqtada tushish joyi QAT'IY — markazning o'zi.
  bool get _dropoffFixed => _destination.isFixedStand;

  int get _maxSeats => math.max(
        1,
        math.min(_trip.seatsLeft, widget.settings.maxSeatsPerBooking),
      );

  double get _total => _kind == IntercityBookingKind.wholeCar
      ? _trip.wholeCarPrice
      : _trip.seatPrice * _seats;

  bool get _pickupValid =>
      _pickup != null && _origin.contains(_pickup!.lat, _pickup!.lng);

  bool get _dropoffValid =>
      _dropoffFixed ||
      (_dropoff != null && _destination.contains(_dropoff!.lat, _dropoff!.lng));

  bool get _canSubmit =>
      !_submitting &&
      _pickupValid &&
      _dropoffValid &&
      (_kind == IntercityBookingKind.wholeCar
          ? _trip.wholeCarAvailable
          : _trip.seatsLeft > 0);

  Future<void> _choose({required bool pickup}) async {
    final l10n = context.l10n;
    final area = pickup ? _origin : _destination;
    final picker = widget.pickLocation ?? _mapPicker;
    final result = await picker(
      context,
      title: pickup ? l10n.icPickup : l10n.icDropoff,
      area: area,
    );
    if (result == null || !mounted) return;
    setState(() => pickup ? _pickup = result : _dropoff = result);
  }

  IntercityPlace _placeOf(OrderLocation l) =>
      IntercityPlace(lat: l.lat, lng: l.lng, address: l.address);

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final dropoff = _dropoffFixed
        ? IntercityPlace(
            lat: _destination.centerLat,
            lng: _destination.centerLng,
            address: _destination.name,
          )
        : _placeOf(_dropoff!);
    try {
      final booking = await _repo.book(
        tripId: _trip.id,
        kind: _kind,
        seats: _seats,
        pickup: _placeOf(_pickup!),
        dropoff: dropoff,
      );
      if (mounted) Navigator.of(context).pop(booking);
    } catch (e) {
      if (!mounted) return;
      if (isSeatsUnavailable(e)) await _refreshTrip();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(intercityErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// 409 dan keyin: haqiqiy bo'sh joylarni olib, tanlovni ularga moslash.
  Future<void> _refreshTrip() async {
    try {
      final fresh = await _repo.trip(_trip.id);
      if (!mounted) return;
      setState(() {
        _trip = fresh;
        if (!fresh.wholeCarAvailable &&
            _kind == IntercityBookingKind.wholeCar) {
          _kind = IntercityBookingKind.seat;
        }
        _seats = _seats.clamp(1, _maxSeats);
      });
    } catch (_) {
      // Yangilab bo'lmadi — xabar baribir ko'rsatiladi, server keyingi
      // urinishda yana tekshiradi.
    }
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
              title: l10n.icBookTitle,
              subtitle:
                  '${_trip.originName} → ${_trip.destinationName} · ${formatTashkentDayTime(_trip.departureAt)}',
              onBack: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: ResponsiveContent(
                child: ListView(
                  padding: const EdgeInsets.all(kSpace4),
                  children: [
                    _kindSelector(context),
                    if (_kind == IntercityBookingKind.seat) ...[
                      const SizedBox(height: kSpace4),
                      _seatStepper(context),
                    ],
                    const SizedBox(height: kSpace5),
                    _placeTile(context, pickup: true),
                    const SizedBox(height: kSpace3),
                    _placeTile(context, pickup: false),
                  ],
                ),
              ),
            ),
            _summary(context),
          ],
        ),
      ),
    );
  }

  Widget _kindSelector(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: kSpace2,
          children: [
            ChoiceChip(
              label: Text(l10n.icKindSeat),
              selected: _kind == IntercityBookingKind.seat,
              onSelected: _trip.seatsLeft > 0
                  ? (_) => setState(() => _kind = IntercityBookingKind.seat)
                  : null,
            ),
            ChoiceChip(
              key: const ValueKey('intercity_whole_car_chip'),
              label: Text(l10n.icKindWholeCar),
              selected: _kind == IntercityBookingKind.wholeCar,
              onSelected: _trip.wholeCarAvailable
                  ? (_) => setState(() => _kind = IntercityBookingKind.wholeCar)
                  : null,
            ),
          ],
        ),
        if (!_trip.wholeCarAvailable) ...[
          const SizedBox(height: kSpace1),
          Text(
            l10n.icWholeCarUnavailable,
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
          ),
        ],
      ],
    );
  }

  Widget _seatStepper(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: Text(
            l10n.icSeatsCount,
            style: const TextStyle(
              fontSize: kFontBody,
              fontWeight: FontWeight.w700,
              color: agText,
            ),
          ),
        ),
        IconButton(
          tooltip: l10n.icSeatsDecrease,
          onPressed: _seats > 1 ? () => setState(() => _seats--) : null,
          icon: const Icon(Icons.remove_circle_outline_rounded),
        ),
        Text(
          '$_seats',
          key: const ValueKey('intercity_seat_count'),
          style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800),
        ),
        IconButton(
          tooltip: l10n.icSeatsIncrease,
          onPressed:
              _seats < _maxSeats ? () => setState(() => _seats++) : null,
          icon: const Icon(Icons.add_circle_outline_rounded),
        ),
      ],
    );
  }

  Widget _placeTile(BuildContext context, {required bool pickup}) {
    final l10n = context.l10n;
    final area = pickup ? _origin : _destination;
    if (!pickup && _dropoffFixed) {
      return _PlaceCard(
        icon: Icons.flag_rounded,
        label: l10n.icDropoff,
        value: area.name,
        hint: l10n.icDropoffFixed(area.name),
      );
    }
    final value = pickup ? _pickup : _dropoff;
    final valid = pickup ? _pickupValid : _dropoffValid;
    return _PlaceCard(
      icon: pickup ? Icons.trip_origin_rounded : Icons.flag_rounded,
      label: pickup ? l10n.icPickup : l10n.icDropoff,
      value: value?.address ?? l10n.icChooseOnMap,
      hint: value != null && !valid
          ? l10n.icOutsideArea(area.name)
          : l10n.icInsideArea(area.name),
      error: value != null && !valid,
      onTap: () => _choose(pickup: pickup),
    );
  }

  Widget _summary(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace4),
      decoration: BoxDecoration(color: agSurface, boxShadow: agCardShadow),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.icTotal,
                  style: const TextStyle(fontSize: kFontBody, color: agSubtle),
                ),
              ),
              Text(
                Formatters.formatPrice(_total),
                key: const ValueKey('intercity_total'),
                style: const TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: agText,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              l10n.icPaymentCash,
              style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
            ),
          ),
          const SizedBox(height: kSpace3),
          AppButton(
            label: l10n.icConfirm,
            isLoading: _submitting,
            isEnabled: _canSubmit,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ),
    );
  }
}

class _PlaceCard extends StatelessWidget {
  const _PlaceCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.hint,
    this.error = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final String hint;
  final bool error;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: agSurface,
      borderRadius: BorderRadius.circular(agRadiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(agRadiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: agGreenText),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: kFontCaption,
                        fontWeight: FontWeight.w700,
                        color: agSubtle,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w700,
                        color: agText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hint,
                      style: TextStyle(
                        fontSize: kFontCaption,
                        color: error ? agRed : agSubtle,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                const Icon(Icons.chevron_right_rounded, color: agMuted),
            ],
          ),
        ),
      ),
    );
  }
}
