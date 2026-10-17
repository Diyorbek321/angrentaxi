import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// Jo'nash vaqtini tanlash. Testlar soxtasini beradi (platforma
/// tanlagichlari vidjet testida boshqarib bo'lmaydi).
typedef IntercityDeparturePicker = Future<DateTime?> Function(
  BuildContext context,
  IntercityPublishWindow window,
);

/// Haydovchi qatnov e'lon qiladi: yo'nalish → vaqt → joylar → klass.
///
/// ⚠️ Narx bu yerda TANLANMAYDI va yuborilmaydi — server uni yo'nalishdan
/// e'lon paytida nusxalaydi. Ekrandagi narx faqat ko'rsatish uchun:
/// haydovchi yo'lovchi qancha to'lashini e'londan oldin bilsin.
class IntercityPublishScreen extends StatefulWidget {
  const IntercityPublishScreen({
    super.key,
    required this.settings,
    this.repository,
    this.now,
    this.pickDeparture,
  });

  final IntercityPublicSettings settings;
  final IntercityRepository? repository;
  final DateTime Function()? now;
  final IntercityDeparturePicker? pickDeparture;

  @override
  State<IntercityPublishScreen> createState() => _IntercityPublishScreenState();
}

class _IntercityPublishScreenState extends State<IntercityPublishScreen> {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();

  List<IntercityRoute>? _routes;
  Object? _loadError;
  IntercityRoute? _route;
  DateTime? _departure;
  int _seats = 4;
  String _class = IntercityTripClass.start;
  String? _error;
  bool _busy = false;

  /// Tanlangan tumanlar; bo'sh — "Hamma tumanlar" (server cheklamaydi).
  Set<String> _originDistricts = {};
  Set<String> _destinationDistricts = {};

  DateTime _now() => (widget.now ?? DateTime.now)();

  IntercityPublishWindow get _window =>
      IntercityPublishWindow.from(_now(), widget.settings);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final routes = await _repo.routes();
      if (!mounted) return;
      setState(() {
        _routes = routes;
        if (routes.isNotEmpty) _selectRoute(routes.first);
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = e);
    }
  }

  void _selectRoute(IntercityRoute route) {
    _route = route;
    _seats = route.seatsDefault;
    if (!route.hasComfort) _class = IntercityTripClass.start;
    // Tumanlar nuqtaga tegishli — yo'nalish almashsa eski tanlov ma'nosiz.
    _originDistricts = {};
    _destinationDistricts = {};
    _error = null;
  }

  Future<void> _pickDeparture() async {
    final picked = await (widget.pickDeparture ?? _platformPicker)(
      context,
      _window,
    );
    if (picked != null && mounted) {
      setState(() {
        _departure = picked;
        _error = null;
      });
    }
  }

  /// Sana va vaqt TOSHKENT bo'yicha tanlanadi, natija UTC.
  static Future<DateTime?> _platformPicker(
    BuildContext context,
    IntercityPublishWindow window,
  ) async {
    final first = toTashkent(window.earliest);
    final last = toTashkent(window.latest);
    final day = await showDatePicker(
      context: context,
      initialDate: DateTime(first.year, first.month, first.day),
      firstDate: DateTime(first.year, first.month, first.day),
      lastDate: DateTime(last.year, last.month, last.day),
    );
    if (day == null || !context.mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: first.hour, minute: first.minute),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (time == null) return null;
    return DateTime.utc(day.year, day.month, day.day, time.hour, time.minute)
        .subtract(kTashkentOffset);
  }

  String? _validate() {
    final l10n = context.l10n;
    final departure = _departure;
    if (departure == null) return l10n.icDrvPickDeparture;
    return switch (_window.check(departure)) {
      IntercityDepartureIssue.tooSoon =>
        l10n.icDrvTooSoon(widget.settings.minLeadMinutes),
      IntercityDepartureIssue.tooFar =>
        l10n.icDrvTooFar(widget.settings.maxAheadDays),
      null => null,
    };
  }

  Future<void> _submit() async {
    final route = _route;
    if (route == null) return;
    final issue = _validate();
    if (issue != null) {
      setState(() => _error = issue);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _repo.publishTrip(
        routeId: route.id,
        departureAt: _departure!,
        seatsTotal: _seats,
        tripClass: _class,
        originDistrictIds: _originDistricts.toList(),
        destinationDistrictIds: _destinationDistricts.toList(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.icDrvPublished)),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = intercityErrorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.icDrvPublishTitle)),
      body: SafeArea(top: false, child: _body()),
    );
  }

  Widget _body() {
    final l10n = context.l10n;
    final routes = _routes;
    if (routes == null && _loadError != null) {
      return AppErrorState(
        message: intercityErrorMessage(_loadError),
        onRetry: _load,
      );
    }
    if (routes == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final route = _route;
    if (route == null) {
      return AppEmptyState(icon: Icons.route_rounded, title: l10n.icNoRoutes);
    }
    return ListView(
      padding: const EdgeInsets.all(kSpace4),
      children: [
        _Label(l10n.icDrvRoute),
        Wrap(
          spacing: kSpace2,
          runSpacing: kSpace2,
          children: [
            for (final r in routes)
              ChoiceChip(
                label: Text(
                    intercityRouteLabel(r.origin.name, r.destination.name)),
                selected: r.id == route.id,
                onSelected: _busy ? null : (_) => setState(() => _selectRoute(r)),
              ),
          ],
        ),
        const SizedBox(height: kSpace5),
        _Label(l10n.icDrvDeparture),
        OutlinedButton.icon(
          key: const ValueKey('ic_publish_departure'),
          onPressed: _busy ? null : _pickDeparture,
          icon: const Icon(Icons.schedule_rounded),
          label: Text(
            _departure == null
                ? l10n.icDrvPickDeparture
                : formatTashkentDayTime(_departure!),
          ),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(kControlHeightDriver),
            alignment: Alignment.centerLeft,
          ),
        ),
        const SizedBox(height: kSpace5),
        _Label(l10n.icDrvSeats),
        _SeatsStepper(
          value: _seats,
          max: route.seatsDefault,
          enabled: !_busy,
          onChanged: (v) => setState(() => _seats = v),
        ),
        const SizedBox(height: kSpace5),
        _Label(l10n.icDrvClass),
        Wrap(
          spacing: kSpace2,
          children: [
            ChoiceChip(
              key: const ValueKey('ic_publish_class_start'),
              label: Text(l10n.icClassStart),
              selected: _class == IntercityTripClass.start,
              onSelected: _busy
                  ? null
                  : (_) => setState(() => _class = IntercityTripClass.start),
            ),
            ChoiceChip(
              key: const ValueKey('ic_publish_class_comfort'),
              label: Text(l10n.icClassComfort),
              selected: _class == IntercityTripClass.comfort,
              onSelected: _busy || !route.hasComfort
                  ? null
                  : (_) => setState(() => _class = IntercityTripClass.comfort),
            ),
          ],
        ),
        if (!route.hasComfort)
          Padding(
            padding: const EdgeInsets.only(top: kSpace1),
            child: Text(
              l10n.icDrvComfortUnavailable,
              style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
            ),
          ),
        ..._districtSection(
          title: l10n.icPublishDistrictsOrigin(route.origin.name),
          point: route.origin,
          selected: _originDistricts,
          onChanged: (next) => setState(() => _originDistricts = next),
          keyPrefix: 'origin',
        ),
        ..._districtSection(
          title: l10n.icPublishDistrictsDestination(route.destination.name),
          point: route.destination,
          selected: _destinationDistricts,
          onChanged: (next) => setState(() => _destinationDistricts = next),
          keyPrefix: 'destination',
        ),
        const SizedBox(height: kSpace5),
        _Label(l10n.icDrvPrice),
        Text(
          '${l10n.icSeatPrice(Formatters.formatPrice(_seatPrice(route)))}\n'
          '${l10n.icWholeCarPrice(Formatters.formatPrice(_wholeCarPrice(route)))}',
          style: const TextStyle(fontSize: kFontBodyLg, color: kInk, height: 1.4),
        ),
        if (_error != null) ...[
          const SizedBox(height: kSpace4),
          Text(
            _error!,
            key: const ValueKey('ic_publish_error'),
            style: const TextStyle(color: kErrorDeep, fontWeight: FontWeight.w600),
          ),
        ],
        const SizedBox(height: kSpace5),
        AppButton(
          key: const ValueKey('ic_publish_submit'),
          label: l10n.icDrvPublish,
          height: kControlHeightDriver,
          isLoading: _busy,
          onPressed: _submit,
        ),
      ],
    );
  }

  /// Tumanlari bor nuqta uchun: "Hamma tumanlar" + har tuman chipi
  /// (bir nechtasini tanlash mumkin). Tumansiz nuqtada hech narsa chizilmaydi.
  List<Widget> _districtSection({
    required String title,
    required IntercityPoint point,
    required Set<String> selected,
    required ValueChanged<Set<String>> onChanged,
    required String keyPrefix,
  }) {
    if (point.districts.isEmpty) return const [];
    final l10n = context.l10n;
    return [
      const SizedBox(height: kSpace5),
      _Label(title),
      Wrap(
        spacing: kSpace2,
        runSpacing: kSpace2,
        children: [
          FilterChip(
            key: ValueKey('ic_publish_${keyPrefix}_all'),
            label: Text(l10n.icAllDistricts),
            selected: selected.isEmpty,
            onSelected: _busy ? null : (_) => onChanged({}),
          ),
          for (final district in point.districts)
            FilterChip(
              key: ValueKey('ic_publish_${keyPrefix}_${district.id}'),
              label: Text(district.name),
              selected: selected.contains(district.id),
              onSelected: _busy
                  ? null
                  : (on) => onChanged(
                        on ? {...selected, district.id} : ({...selected}..remove(district.id)),
                      ),
            ),
        ],
      ),
      const SizedBox(height: kSpace1),
      Text(
        l10n.icPublishDistrictsHint,
        style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
      ),
    ];
  }

  double _seatPrice(IntercityRoute r) => _class == IntercityTripClass.comfort
      ? (r.comfortSeatPrice ?? r.seatPrice)
      : r.seatPrice;

  double _wholeCarPrice(IntercityRoute r) => _class == IntercityTripClass.comfort
      ? (r.comfortWholeCarPrice ?? r.wholeCarPrice)
      : r.wholeCarPrice;
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: kSpace2),
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

/// Katta (haydovchi) tugmali joylar hisoblagichi: 1..[max].
class _SeatsStepper extends StatelessWidget {
  const _SeatsStepper({
    required this.value,
    required this.max,
    required this.enabled,
    required this.onChanged,
  });

  final int value;
  final int max;
  final bool enabled;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget button(Key key, IconData icon, String tooltip, int? next) =>
        SizedBox(
          width: kControlHeightDriver,
          height: kControlHeightDriver,
          child: IconButton.outlined(
            key: key,
            tooltip: tooltip,
            onPressed: enabled && next != null ? () => onChanged(next) : null,
            icon: Icon(icon),
          ),
        );
    return Row(
      children: [
        button(const ValueKey('ic_publish_seats_dec'), Icons.remove_rounded,
            l10n.icSeatsDecrease, value > 1 ? value - 1 : null),
        Expanded(
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
        ),
        button(const ValueKey('ic_publish_seats_inc'), Icons.add_rounded,
            l10n.icSeatsIncrease, value < max ? value + 1 : null),
      ],
    );
  }
}
