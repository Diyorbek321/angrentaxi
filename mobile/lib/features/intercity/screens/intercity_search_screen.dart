import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_bookings_screen.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_trip_card.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:flutter/material.dart';

/// Shaharlararo qidiruv: yo'nalish → kun → qatnovlar ro'yxati.
///
/// ⚠️ Uchlar ERKIN tanlanmaydi: "Qayerga" faqat tanlangan "Qayerdan" dan
/// haqiqatan yo'nalish bor nuqtalarni ko'rsatadi. Aks holda yo'lovchi
/// mavjud bo'lmagan juftni tanlab, bo'sh ro'yxatni "qatnov yo'q" deb
/// noto'g'ri tushunardi.
class IntercitySearchScreen extends StatefulWidget {
  const IntercitySearchScreen({
    super.key,
    this.settings = IntercityPublicSettings.disabled,
    this.repository,
    this.now,
  });

  final IntercityPublicSettings settings;
  final IntercityRepository? repository;

  /// Testlar uchun soat.
  final DateTime Function()? now;

  @override
  State<IntercitySearchScreen> createState() => _IntercitySearchScreenState();
}

class _IntercitySearchScreenState extends State<IntercitySearchScreen> {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();

  List<IntercityRoute>? _routes;
  Object? _routesError;
  String? _originId;
  String? _destinationId;
  int _dayIndex = 0;
  late final List<String> _days = upcomingTashkentDays(_now());

  List<IntercityTrip>? _trips;
  Object? _tripsError;
  bool _tripsLoading = false;
  int _tripsRequest = 0;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _loadRoutes();
  }

  Future<void> _loadRoutes() async {
    setState(() => _routesError = null);
    try {
      final routes = await _repo.routes();
      if (!mounted) return;
      setState(() {
        _routes = routes;
        if (routes.isNotEmpty) {
          _originId = routes.first.origin.id;
          _destinationId = routes.first.destination.id;
        }
      });
      await _loadTrips();
    } catch (e) {
      if (mounted) setState(() => _routesError = e);
    }
  }

  IntercityRoute? get _route {
    for (final r in _routes ?? const <IntercityRoute>[]) {
      if (r.origin.id == _originId && r.destination.id == _destinationId) {
        return r;
      }
    }
    return null;
  }

  List<IntercityPoint> get _origins => _unique(
        (_routes ?? const <IntercityRoute>[]).map((r) => r.origin),
      );

  List<IntercityPoint> get _destinations => _unique(
        (_routes ?? const <IntercityRoute>[])
            .where((r) => r.origin.id == _originId)
            .map((r) => r.destination),
      );

  static List<IntercityPoint> _unique(Iterable<IntercityPoint> points) {
    final seen = <String>{};
    return [
      for (final p in points)
        if (seen.add(p.id)) p,
    ];
  }

  bool get _canSwap =>
      (_routes ?? const <IntercityRoute>[]).any(
        (r) => r.origin.id == _destinationId && r.destination.id == _originId,
      );

  Future<void> _loadTrips() async {
    final route = _route;
    if (route == null) {
      setState(() => _trips = const []);
      return;
    }
    final request = ++_tripsRequest;
    setState(() {
      _tripsLoading = true;
      _tripsError = null;
    });
    try {
      final trips =
          await _repo.searchTrips(routeId: route.id, date: _days[_dayIndex]);
      // Tez almashtirishda eski javob yangisining ustiga yozilmasin.
      if (!mounted || request != _tripsRequest) return;
      setState(() => _trips = trips);
    } catch (e) {
      if (mounted && request == _tripsRequest) setState(() => _tripsError = e);
    } finally {
      if (mounted && request == _tripsRequest) {
        setState(() => _tripsLoading = false);
      }
    }
  }

  void _selectOrigin(String id) {
    setState(() {
      _originId = id;
      final dests = _destinations;
      if (!dests.any((p) => p.id == _destinationId)) {
        _destinationId = dests.isEmpty ? null : dests.first.id;
      }
    });
    _loadTrips();
  }

  void _selectDestination(String id) {
    setState(() => _destinationId = id);
    _loadTrips();
  }

  void _swap() {
    setState(() {
      final o = _originId;
      _originId = _destinationId;
      _destinationId = o;
    });
    _loadTrips();
  }

  void _selectDay(int index) {
    setState(() => _dayIndex = index);
    _loadTrips();
  }

  Future<void> _openTrip(IntercityTrip trip) async {
    final route = _route;
    if (route == null) return;
    final booking = await Navigator.of(context).push<IntercityBooking>(
      MaterialPageRoute(
        builder: (_) => IntercityBookingScreen(
          trip: trip,
          route: route,
          settings: widget.settings,
          repository: _repo,
        ),
      ),
    );
    if (!mounted) return;
    await _loadTrips();
    if (booking != null && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.l10n.icBooked)));
      _openBookings();
    }
  }

  void _openBookings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => IntercityBookingsScreen(
          settings: widget.settings,
          repository: _repo,
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
            AgHeader(
              title: l10n.icSearchTitle,
              onBack: () => Navigator.of(context).maybePop(),
              trailing: AgIconButton(
                icon: Icons.confirmation_number_outlined,
                onTap: _openBookings,
                semanticsLabel: l10n.icMyBookings,
              ),
            ),
            Expanded(
              child: ResponsiveContent(child: _body(context)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final l10n = context.l10n;
    if (_routesError != null) {
      return AppEmptyState(
        icon: Icons.cloud_off_rounded,
        title: l10n.icLoadError,
        message: intercityErrorMessage(_routesError),
        actionLabel: l10n.icRetry,
        onAction: _loadRoutes,
      );
    }
    final routes = _routes;
    if (routes == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (routes.isEmpty) {
      return AppEmptyState(icon: Icons.route_rounded, title: l10n.icNoRoutes);
    }

    return RefreshIndicator(
      onRefresh: _loadTrips,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
        children: [
          _PointPicker(
            label: l10n.icFrom,
            points: _origins,
            selectedId: _originId,
            onSelected: _selectOrigin,
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: IconButton(
              tooltip: l10n.icSwap,
              onPressed: _canSwap ? _swap : null,
              icon: const Icon(Icons.swap_vert_rounded),
            ),
          ),
          _PointPicker(
            label: l10n.icTo,
            points: _destinations,
            selectedId: _destinationId,
            onSelected: _selectDestination,
          ),
          const SizedBox(height: kSpace4),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _days.length,
              separatorBuilder: (_, __) => const SizedBox(width: kSpace2),
              itemBuilder: (_, i) => ChoiceChip(
                label: Text(intercityDayChipLabel(_days[i], i)),
                selected: i == _dayIndex,
                onSelected: (_) => _selectDay(i),
              ),
            ),
          ),
          const SizedBox(height: kSpace4),
          ..._tripsSection(context),
        ],
      ),
    );
  }

  List<Widget> _tripsSection(BuildContext context) {
    final l10n = context.l10n;
    if (_tripsError != null) {
      return [
        AppEmptyState(
          compact: true,
          icon: Icons.cloud_off_rounded,
          title: l10n.icLoadError,
          message: intercityErrorMessage(_tripsError),
          actionLabel: l10n.icRetry,
          onAction: _loadTrips,
        ),
      ];
    }
    final trips = _trips;
    if (trips == null || (_tripsLoading && trips.isEmpty)) {
      return const [
        Padding(
          padding: EdgeInsets.all(kSpace6),
          child: Center(child: CircularProgressIndicator()),
        ),
      ];
    }
    if (trips.isEmpty) {
      return [
        AppEmptyState(
          compact: true,
          icon: Icons.event_busy_rounded,
          title: l10n.icNoTripsTitle,
          message: l10n.icNoTripsHint,
        ),
      ];
    }
    return [
      for (final trip in trips) ...[
        IntercityTripCard(trip: trip, onTap: () => _openTrip(trip)),
        const SizedBox(height: kSpace3),
      ],
    ];
  }
}

class _PointPicker extends StatelessWidget {
  const _PointPicker({
    required this.label,
    required this.points,
    required this.selectedId,
    required this.onSelected,
  });

  final String label;
  final List<IntercityPoint> points;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: kFontLabel,
            fontWeight: FontWeight.w700,
            color: agSubtle,
          ),
        ),
        const SizedBox(height: kSpace2),
        Wrap(
          spacing: kSpace2,
          runSpacing: kSpace2,
          children: [
            for (final p in points)
              ChoiceChip(
                label: Text(p.name),
                selected: p.id == selectedId,
                onSelected: (_) => onSelected(p.id),
              ),
          ],
        ),
      ],
    );
  }
}
