import 'dart:async';
import 'dart:math' as math;

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_place_card.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_price_breakdown.dart';
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

/// Standart xarita tanlovi (qidiruv ekrani ham ishlatadi).
Future<OrderLocation?> intercityMapPicker(
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
    this.initialPickup,
    this.initialDropoff,
  });

  final IntercityTrip trip;
  final IntercityRoute route;
  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final IntercityLocationPicker? pickLocation;

  /// Qidiruvda tanlangan manzil — shu yerda "Manzilimgacha/Manzilimdan" tayyor.
  final OrderLocation? initialPickup;
  final OrderLocation? initialDropoff;

  @override
  State<IntercityBookingScreen> createState() => _IntercityBookingScreenState();
}

/// Kichik nuqtada (Rohat krugi) yo'lovchi aynan nuqtada tushadi/chiqadi
/// yoki — nuqtada davom yoqilgan bo'lsa — o'z manzilini tanlaydi (km haqi).
enum _PlaceMode { atPoint, address }

/// Narx so'rovi kechiktirilishi: joylar sonini tez bosib o'zgartirganda har
/// bosish uchun alohida so'rov ketmasin.
const Duration _kQuoteDebounce = Duration(milliseconds: 300);

class _IntercityBookingScreenState extends State<IntercityBookingScreen> {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();
  late IntercityTrip _trip = widget.trip;
  String _kind = IntercityBookingKind.seat;
  int _seats = 1;
  late OrderLocation? _pickup = widget.initialPickup;
  late OrderLocation? _dropoff = widget.initialDropoff;
  late _PlaceMode _pickupMode =
      widget.initialPickup != null ? _PlaceMode.address : _defaultMode(_origin);
  late _PlaceMode _dropoffMode =
      widget.initialDropoff != null ? _PlaceMode.address : _defaultMode(_destination);
  bool _submitting = false;

  // "Shahar ichiga davom" narxi — faqat serverdan (mijoz hisoblamaydi).
  IntercityQuote? _quote;
  bool _quoting = false;
  Object? _quoteError;
  Timer? _quoteTimer;
  int _quoteSeq = 0;

  IntercityPoint get _origin => widget.route.origin;
  IntercityPoint get _destination => widget.route.destination;

  /// Rohat krugi kabi kichik nuqtada standart — nuqtaning o'zi.
  static _PlaceMode _defaultMode(IntercityPoint point) =>
      point.isFixedStand ? _PlaceMode.atPoint : _PlaceMode.address;

  /// Kichik nuqtada davom yoqilgan bo'lsa yo'lovchi tanlaydi.
  static bool _offersChoice(IntercityPoint point) =>
      point.isFixedStand && point.extension != null;

  int get _maxSeats => math.max(
        1,
        math.min(_trip.seatsLeft, widget.settings.maxSeatsPerBooking),
      );

  double get _basePrice => _kind == IntercityBookingKind.wholeCar
      ? _trip.wholeCarPrice
      : _trip.seatPrice * _seats;

  _PlaceMode _modeOf({required bool pickup}) =>
      pickup ? _pickupMode : _dropoffMode;

  /// Tanlanmagan manzil — `null`.
  IntercityZone? _zoneOf({required bool pickup}) {
    final point = pickup ? _origin : _destination;
    if (_modeOf(pickup: pickup) == _PlaceMode.atPoint) {
      return IntercityZone.inside;
    }
    final location = pickup ? _pickup : _dropoff;
    return location == null ? null : point.zoneOf(location.lat, location.lng);
  }

  bool _sideValid({required bool pickup}) {
    final zone = _zoneOf(pickup: pickup);
    return zone != null && zone != IntercityZone.outside;
  }

  bool get _placesValid => _sideValid(pickup: true) && _sideValid(pickup: false);

  bool get _needsQuote =>
      _zoneOf(pickup: true) == IntercityZone.extension ||
      _zoneOf(pickup: false) == IntercityZone.extension;

  bool get _quoteReady => !_needsQuote || (_quote != null && !_quoting);

  /// Davom bo'lsa — server narxi; aks holda qat'iy narx (server bilan teng).
  double? get _total => _needsQuote ? _quote?.total : _basePrice;

  /// Server baribir rad etadigan band (boshqa tuman / katta aylanma).
  bool get _quoteBlocks => _needsQuote && (_quote?.fit.blocksBooking ?? false);

  bool get _canSubmit =>
      !_submitting &&
      _placesValid &&
      _quoteReady &&
      !_quoteBlocks &&
      (_kind == IntercityBookingKind.wholeCar
          ? _trip.wholeCarAvailable
          : _trip.seatsLeft > 0);

  @override
  void initState() {
    super.initState();
    // Qidiruvdan kelgan manzil bilan narx va moslik darhol so'raladi.
    if (widget.initialPickup != null || widget.initialDropoff != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _scheduleQuote();
      });
    }
  }

  @override
  void dispose() {
    _quoteTimer?.cancel();
    super.dispose();
  }

  /// Narxga ta'sir qiladigan har o'zgarishdan keyin chaqiriladi.
  void _changed(VoidCallback change) {
    setState(change);
    _scheduleQuote();
  }

  void _scheduleQuote() {
    _quoteTimer?.cancel();
    final seq = ++_quoteSeq;
    if (!_needsQuote || !_placesValid) {
      setState(() {
        _quote = null;
        _quoting = false;
        _quoteError = null;
      });
      return;
    }
    setState(() {
      _quoting = true;
      _quoteError = null;
    });
    _quoteTimer = Timer(_kQuoteDebounce, () => _fetchQuote(seq));
  }

  Future<void> _fetchQuote(int seq) async {
    try {
      final quote = await _repo.quote(
        tripId: _trip.id,
        kind: _kind,
        seats: _seats,
        pickup: _placeFor(pickup: true),
        dropoff: _placeFor(pickup: false),
      );
      // Eskirgan javob (foydalanuvchi shu orada boshqa narsa tanlagan) —
      // yangisining ustiga yozilmaydi.
      if (!mounted || seq != _quoteSeq) return;
      setState(() {
        _quote = quote;
        _quoting = false;
      });
    } catch (e) {
      if (!mounted || seq != _quoteSeq) return;
      setState(() {
        _quote = null;
        _quoting = false;
        _quoteError = e;
      });
    }
  }

  Future<void> _choose({required bool pickup}) async {
    final l10n = context.l10n;
    final area = pickup ? _origin : _destination;
    final picker = widget.pickLocation ?? intercityMapPicker;
    final result = await picker(
      context,
      title: pickup ? l10n.icPickup : l10n.icDropoff,
      area: area,
    );
    if (result == null || !mounted) return;
    _changed(() => pickup ? _pickup = result : _dropoff = result);
  }

  IntercityPlace _placeFor({required bool pickup}) {
    final point = pickup ? _origin : _destination;
    final location = pickup ? _pickup : _dropoff;
    if (_modeOf(pickup: pickup) == _PlaceMode.atPoint || location == null) {
      return IntercityPlace(
        lat: point.centerLat,
        lng: point.centerLng,
        address: point.name,
      );
    }
    return IntercityPlace(
        lat: location.lat, lng: location.lng, address: location.address);
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final booking = await _repo.book(
        tripId: _trip.id,
        kind: _kind,
        seats: _seats,
        pickup: _placeFor(pickup: true),
        dropoff: _placeFor(pickup: false),
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
      _changed(() {
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
                  ? (_) => _changed(() => _kind = IntercityBookingKind.seat)
                  : null,
            ),
            ChoiceChip(
              key: const ValueKey('intercity_whole_car_chip'),
              label: Text(l10n.icKindWholeCar),
              selected: _kind == IntercityBookingKind.wholeCar,
              onSelected: _trip.wholeCarAvailable
                  ? (_) => _changed(() => _kind = IntercityBookingKind.wholeCar)
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
          onPressed: _seats > 1 ? () => _changed(() => _seats--) : null,
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
              _seats < _maxSeats ? () => _changed(() => _seats++) : null,
          icon: const Icon(Icons.add_circle_outline_rounded),
        ),
      ],
    );
  }

  Widget _placeTile(BuildContext context, {required bool pickup}) {
    final l10n = context.l10n;
    final area = pickup ? _origin : _destination;
    final mode = _modeOf(pickup: pickup);
    final card = mode == _PlaceMode.atPoint
        ? IntercityPlaceCard(
            icon: pickup ? Icons.trip_origin_rounded : Icons.flag_rounded,
            label: pickup ? l10n.icPickup : l10n.icDropoff,
            value: area.name,
            hint: l10n.icDropoffFixed(area.name),
          )
        : _addressCard(context, pickup: pickup);
    if (!_offersChoice(area)) return card;

    void setMode(_PlaceMode next) => _changed(
        () => pickup ? _pickupMode = next : _dropoffMode = next);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: kSpace2,
          children: [
            ChoiceChip(
              label: Text(l10n.icPlaceAtPoint(area.name)),
              selected: mode == _PlaceMode.atPoint,
              onSelected: (_) => setMode(_PlaceMode.atPoint),
            ),
            ChoiceChip(
              label: Text(
                  pickup ? l10n.icPlaceFromAddress : l10n.icPlaceToAddress),
              selected: mode == _PlaceMode.address,
              onSelected: (_) => setMode(_PlaceMode.address),
            ),
          ],
        ),
        const SizedBox(height: kSpace2),
        card,
      ],
    );
  }

  Widget _addressCard(BuildContext context, {required bool pickup}) {
    final l10n = context.l10n;
    final area = pickup ? _origin : _destination;
    final value = pickup ? _pickup : _dropoff;
    final zone = _zoneOf(pickup: pickup);
    final extension = area.extension;
    final extensionHint = extension == null
        ? null
        : l10n.icExtensionHint(
            area.name,
            formatIntercityKm(extension.maxKm),
            Formatters.formatPrice(extension.rateFor(_trip.tripClass)),
          );
    final hint = switch (zone) {
      null => extensionHint ?? l10n.icInsideArea(area.name),
      IntercityZone.inside => l10n.icInsideArea(area.name),
      IntercityZone.extension => extensionHint ?? l10n.icInsideArea(area.name),
      IntercityZone.outside => extension == null
          ? l10n.icOutsideArea(area.name)
          : l10n.icOutsideExtension(
              area.name, formatIntercityKm(extension.maxKm)),
    };
    return IntercityPlaceCard(
      icon: pickup ? Icons.trip_origin_rounded : Icons.flag_rounded,
      label: pickup ? l10n.icPickup : l10n.icDropoff,
      value: value?.address ?? l10n.icChooseOnMap,
      hint: hint,
      error: zone == IntercityZone.outside,
      onTap: () => _choose(pickup: pickup),
    );
  }

  Widget _summary(BuildContext context) {
    final l10n = context.l10n;
    final quote = _quote;
    return Container(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace4),
      decoration: BoxDecoration(color: agSurface, boxShadow: agCardShadow),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_needsQuote && quote != null && !_quoting) ...[
            IntercityPriceBreakdown(
              basePrice: quote.basePrice,
              extensions: quote.extensions,
            ),
            const SizedBox(height: kSpace1),
            if (quote.fit.blocksBooking) _fitWarning(context, quote.fit),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.icTotal,
                  style: const TextStyle(fontSize: kFontBody, color: agSubtle),
                ),
              ),
              _totalValue(context),
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

  /// Tuman yoki aylanma sabab band bo'lmaydi — nima uchunligi va nima qilish.
  Widget _fitWarning(BuildContext context, IntercityQuoteFit fit) {
    final l10n = context.l10n;
    final reason = !fit.zoneOk
        ? l10n.icQuoteOutOfZone(fit.zoneNames.join(', '))
        : l10n.icQuoteDetour(fit.detourMinutes ?? 0, fit.maxDetourMinutes);
    return Container(
      key: const ValueKey('intercity_fit_warning'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: kSpace2),
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: agBg,
        borderRadius: BorderRadius.circular(agRadiusMd),
        border: Border.all(color: kErrorDeep.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.alt_route_rounded, color: kErrorDeep, size: 20),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              '$reason\n${l10n.icPickAnotherTrip}',
              style: const TextStyle(fontSize: kFontLabel, color: kErrorDeep, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  /// Jami: qat'iy narx, server narxi, yuklanish yoki xato + qayta urinish.
  Widget _totalValue(BuildContext context) {
    final l10n = context.l10n;
    if (_needsQuote && _quoting) {
      return Text(
        l10n.icQuoteLoading,
        style: const TextStyle(fontSize: kFontBody, color: agSubtle),
      );
    }
    if (_needsQuote && _quoteError != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            l10n.icQuoteFailed,
            style: const TextStyle(fontSize: kFontCaption, color: agRed),
          ),
          TextButton(onPressed: _scheduleQuote, child: Text(l10n.icQuoteRetry)),
        ],
      );
    }
    final total = _total;
    return Text(
      total == null ? '—' : Formatters.formatPrice(total),
      key: const ValueKey('intercity_total'),
      style: const TextStyle(
        fontSize: kFontH2,
        fontWeight: FontWeight.w800,
        color: agText,
      ),
    );
  }
}
