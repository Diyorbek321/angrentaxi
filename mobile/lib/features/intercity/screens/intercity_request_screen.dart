import 'dart:async';
import 'dart:math' as math;

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_requests_screen.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_bonus_stepper.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_place_card.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_price_breakdown.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Mos qatnov yo'q — so'rov qoldirish: joylar, jo'nash ORALIG'I, manzillar
/// va ixtiyoriy narx oshirish. Haydovchilarga push boradi; birinchi qabul
/// qilgan haydovchining qatnoviga band tushadi. Muvaffaqiyatda so'rovni
/// qaytarib yopiladi (`Navigator.pop(request)`).
///
/// Narx faqat serverdan (qat'iy tarif + davom km): ilova hisoblamaydi.
class IntercityRequestScreen extends StatefulWidget {
  const IntercityRequestScreen({
    super.key,
    required this.route,
    this.settings = IntercityPublicSettings.disabled,
    this.repository,
    this.pickLocation,
    this.initialDate,
    this.initialPickup,
    this.initialDropoff,
    this.now,
  });

  final IntercityRoute route;
  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final IntercityLocationPicker? pickLocation;

  /// Qidiruvda tanlangan kun (YYYY-MM-DD, Toshkent).
  final String? initialDate;
  final OrderLocation? initialPickup;
  final OrderLocation? initialDropoff;
  final DateTime Function()? now;

  @override
  State<IntercityRequestScreen> createState() => _IntercityRequestScreenState();
}

enum _PlaceMode { atPoint, address }

const Duration _kQuoteDebounce = Duration(milliseconds: 300);

/// Standart oraliq uzunligi: "14:00–16:00".
const Duration _kDefaultWindow = Duration(hours: 2);

class _IntercityRequestScreenState extends State<IntercityRequestScreen> {
  late final IntercityRepository _repo = widget.repository ?? IntercityRepository();

  String _tripClass = IntercityTripClass.start;
  String _kind = IntercityBookingKind.seat;
  int _seats = 1;
  int _bonus = 0;

  late OrderLocation? _pickup = widget.initialPickup;
  late OrderLocation? _dropoff = widget.initialDropoff;
  late _PlaceMode _pickupMode =
      widget.initialPickup != null ? _PlaceMode.address : _defaultMode(_origin);
  late _PlaceMode _dropoffMode =
      widget.initialDropoff != null ? _PlaceMode.address : _defaultMode(_destination);

  late DateTime _windowStart;
  late DateTime _windowEnd;

  IntercityRequestQuote? _quote;
  bool _quoting = false;
  Object? _quoteError;
  Timer? _quoteTimer;
  int _quoteSeq = 0;
  bool _submitting = false;

  IntercityPoint get _origin => widget.route.origin;
  IntercityPoint get _destination => widget.route.destination;

  DateTime _now() => (widget.now ?? DateTime.now)().toUtc();

  static _PlaceMode _defaultMode(IntercityPoint point) =>
      point.isFixedStand ? _PlaceMode.atPoint : _PlaceMode.address;

  static bool _offersChoice(IntercityPoint point) => point.isFixedStand && point.extension != null;

  int get _maxSeats => math.max(1, math.min(widget.route.seatsDefault, widget.settings.maxSeatsPerBooking));

  int get _maxAheadDays => math.max(1, widget.settings.maxAheadDays);

  @override
  void initState() {
    super.initState();
    _windowStart = _defaultStart();
    _windowEnd = _windowStart.add(_kDefaultWindow);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scheduleQuote();
    });
  }

  @override
  void dispose() {
    _quoteTimer?.cancel();
    super.dispose();
  }

  /// Tanlangan kun bugun bo'lsa — eng yaqin yarim soat (+30 daq tayyorlanish);
  /// boshqa kun — 08:00.
  DateTime _defaultStart() {
    final now = _now();
    final soon = ceilToMinutes(now.add(const Duration(minutes: 30)), 30);
    final day = widget.initialDate;
    if (day == null || day == tashkentDateKey(now)) return soon;
    final morning = tashkentInstant(day, 8, 0);
    return morning.isAfter(soon) ? morning : soon;
  }

  // ------------------------------------------------------------- manzillar

  _PlaceMode _modeOf({required bool pickup}) => pickup ? _pickupMode : _dropoffMode;

  IntercityZone? _zoneOf({required bool pickup}) {
    if (_modeOf(pickup: pickup) == _PlaceMode.atPoint) return IntercityZone.inside;
    final point = pickup ? _origin : _destination;
    final location = pickup ? _pickup : _dropoff;
    return location == null ? null : point.zoneOf(location.lat, location.lng);
  }

  bool _sideValid({required bool pickup}) {
    final zone = _zoneOf(pickup: pickup);
    return zone != null && zone != IntercityZone.outside;
  }

  bool get _placesValid => _sideValid(pickup: true) && _sideValid(pickup: false);

  IntercityPlace _placeFor({required bool pickup}) {
    final point = pickup ? _origin : _destination;
    final location = pickup ? _pickup : _dropoff;
    if (_modeOf(pickup: pickup) == _PlaceMode.atPoint || location == null) {
      return IntercityPlace(lat: point.centerLat, lng: point.centerLng, address: point.name);
    }
    return IntercityPlace(lat: location.lat, lng: location.lng, address: location.address);
  }

  Future<void> _choose({required bool pickup}) async {
    final l10n = context.l10n;
    final picker = widget.pickLocation ?? intercityMapPicker;
    final result = await picker(
      context,
      title: pickup ? l10n.icPickup : l10n.icDropoff,
      area: pickup ? _origin : _destination,
    );
    if (result == null || !mounted) return;
    _changed(() => pickup ? _pickup = result : _dropoff = result);
  }

  // ---------------------------------------------------------------- oraliq

  IntercityWindowProblem? get _windowProblem => intercityWindowProblem(
        start: _windowStart,
        end: _windowEnd,
        now: _now(),
        maxAheadDays: _maxAheadDays,
      );

  String _windowProblemText(IntercityWindowProblem problem) {
    final l10n = context.l10n;
    return switch (problem) {
      IntercityWindowProblem.invalid => l10n.icReqWindowInvalid,
      IntercityWindowProblem.tooShort => l10n.icReqWindowTooShort(kIntercityRequestWindowMin.inMinutes),
      IntercityWindowProblem.tooLong => l10n.icReqWindowTooLong(kIntercityRequestWindowMax.inHours),
      IntercityWindowProblem.tooSoon => l10n.icReqWindowTooSoon,
      IntercityWindowProblem.tooFar => l10n.icReqWindowTooFar(_maxAheadDays),
    };
  }

  Future<TimeOfDay?> _pickTime(DateTime initial) {
    final t = toTashkent(initial);
    return showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: t.hour, minute: t.minute),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
  }

  void _selectDay(String day) {
    final length = _windowEnd.difference(_windowStart);
    final t = toTashkent(_windowStart);
    final start = tashkentInstant(day, t.hour, t.minute);
    _changed(() {
      _windowStart = start;
      _windowEnd = start.add(length);
    });
  }

  /// Boshlanishni surish oraliq uzunligini saqlaydi.
  Future<void> _editStart() async {
    final time = await _pickTime(_windowStart);
    if (time == null || !mounted) return;
    final length = _windowEnd.difference(_windowStart);
    final start = tashkentInstant(tashkentDateKey(_windowStart), time.hour, time.minute);
    _changed(() {
      _windowStart = start;
      _windowEnd = start.add(length);
    });
  }

  /// Oxiri boshidan oldin tanlansa — ertasi kun (tungi qatnov: 22:00–02:00).
  Future<void> _editEnd() async {
    final time = await _pickTime(_windowEnd);
    if (time == null || !mounted) return;
    var end = tashkentInstant(tashkentDateKey(_windowStart), time.hour, time.minute);
    if (!end.isAfter(_windowStart)) end = end.add(const Duration(days: 1));
    _changed(() => _windowEnd = end);
  }

  // ------------------------------------------------------------------ narx

  void _changed(VoidCallback change) {
    setState(change);
    _scheduleQuote();
  }

  bool get _canQuote => _placesValid && _windowProblem == null;

  void _scheduleQuote() {
    _quoteTimer?.cancel();
    final seq = ++_quoteSeq;
    if (!_canQuote) {
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

  /// Oshirishsiz so'raladi: qo'shimcha summa ilovada qo'shiladi, shunda "+"
  /// bosish har safar tarmoqqa bormaydi. Server yaratishda uni qayta tekshiradi.
  Future<void> _fetchQuote(int seq) async {
    try {
      final quote = await _repo.requestQuote(
        routeId: widget.route.id,
        tripClass: _tripClass,
        kind: _kind,
        seats: _seats,
        pickup: _placeFor(pickup: true),
        dropoff: _placeFor(pickup: false),
        windowStart: _windowStart,
        windowEnd: _windowEnd,
      );
      if (!mounted || seq != _quoteSeq) return;
      setState(() {
        _quote = quote;
        _quoting = false;
        // Narx kamaysa (masalan joy kamaydi) chegara ham kamayadi.
        _bonus = math.min(_bonus, _maxBonusOf(quote));
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

  static int _maxBonusOf(IntercityRequestQuote quote) =>
      (quote.maxBonus ~/ kIntercityRequestBonusStep) * kIntercityRequestBonusStep;

  bool get _canSubmit => !_submitting && _canQuote && _quote != null && !_quoting;

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final request = await _repo.createRequest(
        routeId: widget.route.id,
        tripClass: _tripClass,
        kind: _kind,
        seats: _seats,
        pickup: _placeFor(pickup: true),
        dropoff: _placeFor(pickup: false),
        windowStart: _windowStart,
        windowEnd: _windowEnd,
        bonus: _bonus,
      );
      if (mounted) Navigator.of(context).pop(request);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(intercityErrorMessage(e))));
      // Allaqachon ochiq so'rov bor — yangisi o'rniga o'shani ko'rsatamiz.
      if (ApiError.from(e)?.code == IntercityErrorCode.requestAlreadyOpen) {
        unawaited(Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => IntercityRequestsScreen(
              settings: widget.settings,
              repository: _repo,
              now: widget.now,
            ),
          ),
        ));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // ------------------------------------------------------------------- UI

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
              title: l10n.icReqTitle,
              subtitle: intercityRouteLabel(_origin.name, _destination.name),
              onBack: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: ResponsiveContent(
                child: ListView(
                  padding: const EdgeInsets.all(kSpace4),
                  children: [
                    Text(l10n.icReqIntro, style: const TextStyle(fontSize: kFontLabel, color: agSubtle)),
                    const SizedBox(height: kSpace4),
                    _choices(context),
                    if (_kind == IntercityBookingKind.seat) ...[
                      const SizedBox(height: kSpace3),
                      _seatStepper(context),
                    ],
                    const SizedBox(height: kSpace4),
                    _window(context),
                    const SizedBox(height: kSpace4),
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

  Widget _choices(BuildContext context) {
    final l10n = context.l10n;
    return Wrap(
      spacing: kSpace2,
      runSpacing: kSpace2,
      children: [
        ChoiceChip(
          label: Text(l10n.icKindSeat),
          selected: _kind == IntercityBookingKind.seat,
          onSelected: (_) => _changed(() => _kind = IntercityBookingKind.seat),
        ),
        ChoiceChip(
          key: const ValueKey('ic_req_whole_car'),
          label: Text(l10n.icKindWholeCar),
          selected: _kind == IntercityBookingKind.wholeCar,
          onSelected: (_) => _changed(() => _kind = IntercityBookingKind.wholeCar),
        ),
        if (widget.route.hasComfort) ...[
          ChoiceChip(
            label: Text(l10n.icClassStart),
            selected: _tripClass == IntercityTripClass.start,
            onSelected: (_) => _changed(() => _tripClass = IntercityTripClass.start),
          ),
          ChoiceChip(
            key: const ValueKey('ic_req_comfort'),
            label: Text(l10n.icClassComfort),
            selected: _tripClass == IntercityTripClass.comfort,
            onSelected: (_) => _changed(() => _tripClass = IntercityTripClass.comfort),
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
            style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: agText),
          ),
        ),
        IconButton(
          tooltip: l10n.icSeatsDecrease,
          onPressed: _seats > 1 ? () => _changed(() => _seats--) : null,
          icon: const Icon(Icons.remove_circle_outline_rounded),
        ),
        Text(
          '$_seats',
          key: const ValueKey('ic_req_seats'),
          style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800),
        ),
        IconButton(
          tooltip: l10n.icSeatsIncrease,
          onPressed: _seats < _maxSeats ? () => _changed(() => _seats++) : null,
          icon: const Icon(Icons.add_circle_outline_rounded),
        ),
      ],
    );
  }

  Widget _window(BuildContext context) {
    final l10n = context.l10n;
    final days = upcomingTashkentDays(_now(), count: _maxAheadDays + 1);
    final selectedDay = tashkentDateKey(_windowStart);
    final problem = _windowProblem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.icReqWindowTitle,
          style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: agSubtle),
        ),
        const SizedBox(height: kSpace2),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: days.length,
            separatorBuilder: (_, __) => const SizedBox(width: kSpace2),
            itemBuilder: (_, i) => ChoiceChip(
              label: Text(intercityDayChipLabel(days[i], i)),
              selected: days[i] == selectedDay,
              onSelected: (_) => _selectDay(days[i]),
            ),
          ),
        ),
        const SizedBox(height: kSpace3),
        Row(
          children: [
            Expanded(
              child: _TimeBox(
                key: const ValueKey('ic_req_window_start'),
                label: l10n.icReqWindowFrom,
                value: formatTashkentTime(_windowStart),
                onTap: _editStart,
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: _TimeBox(
                key: const ValueKey('ic_req_window_end'),
                label: l10n.icReqWindowTo,
                value: tashkentDateKey(_windowEnd) == selectedDay
                    ? formatTashkentTime(_windowEnd)
                    : formatTashkentDayTime(_windowEnd),
                onTap: _editEnd,
              ),
            ),
          ],
        ),
        const SizedBox(height: kSpace1),
        Text(
          problem == null ? l10n.icReqWindowHint : _windowProblemText(problem),
          key: const ValueKey('ic_req_window_note'),
          style: TextStyle(fontSize: kFontCaption, color: problem == null ? agSubtle : agRed),
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
    void setMode(_PlaceMode next) => _changed(() => pickup ? _pickupMode = next : _dropoffMode = next);
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
              label: Text(pickup ? l10n.icPlaceFromAddress : l10n.icPlaceToAddress),
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
            Formatters.formatPrice(extension.rateFor(_tripClass)),
          );
    final hint = switch (zone) {
      null || IntercityZone.extension => extensionHint ?? l10n.icInsideArea(area.name),
      IntercityZone.inside => l10n.icInsideArea(area.name),
      IntercityZone.outside => extension == null
          ? l10n.icOutsideArea(area.name)
          : l10n.icOutsideExtension(area.name, formatIntercityKm(extension.maxKm)),
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
          if (quote != null && !_quoting) ...[
            if (quote.extensions.isNotEmpty)
              IntercityPriceBreakdown(basePrice: quote.tariffPrice, extensions: quote.extensions),
            IntercityBonusStepper(
              value: _bonus,
              min: 0,
              max: _maxBonusOf(quote),
              step: kIntercityRequestBonusStep,
              onChanged: (value) => setState(() => _bonus = value),
            ),
            const SizedBox(height: kSpace1),
          ],
          Row(
            children: [
              Expanded(
                child: Text(l10n.icTotal, style: const TextStyle(fontSize: kFontBody, color: agSubtle)),
              ),
              _totalValue(context),
            ],
          ),
          const SizedBox(height: kSpace1),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(l10n.icPaymentCash, style: const TextStyle(fontSize: kFontCaption, color: agSubtle)),
          ),
          const SizedBox(height: kSpace3),
          AppButton(
            key: const ValueKey('ic_req_submit'),
            label: l10n.icReqSubmit,
            isLoading: _submitting,
            isEnabled: _canSubmit,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ),
    );
  }

  Widget _totalValue(BuildContext context) {
    final l10n = context.l10n;
    if (_quoting) {
      return Text(l10n.icQuoteLoading, style: const TextStyle(fontSize: kFontBody, color: agSubtle));
    }
    if (_quoteError != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              intercityErrorMessage(_quoteError),
              style: const TextStyle(fontSize: kFontCaption, color: agRed),
            ),
          ),
          TextButton(onPressed: _scheduleQuote, child: Text(l10n.icQuoteRetry)),
        ],
      );
    }
    final quote = _quote;
    return Text(
      quote == null ? '—' : Formatters.formatPrice(quote.total + _bonus),
      key: const ValueKey('ic_req_total'),
      style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText),
    );
  }
}

class _TimeBox extends StatelessWidget {
  const _TimeBox({super.key, required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: agSurface,
      borderRadius: BorderRadius.circular(agRadiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(agRadiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace3),
          child: Row(
            children: [
              const Icon(Icons.schedule_rounded, color: agGreenText, size: 20),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w700, color: agSubtle),
                    ),
                    Text(
                      value,
                      style: const TextStyle(fontSize: kFontBodyLg, fontWeight: FontWeight.w800, color: agText),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
