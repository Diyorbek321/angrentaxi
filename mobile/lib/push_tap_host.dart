import 'dart:async';

import 'package:angren_taxi/core/push/push_tap_router.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/driver_intercity_trips_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_bookings_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_request_board_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_requests_screen.dart';
import 'package:angren_taxi/features/lost_items/screens/lost_items_screen.dart';
import 'package:angren_taxi/features/support/screens/chat_screen.dart';
import 'package:flutter/material.dart';

/// Push bosilganda ekranni ochadi ([PushTapRouter] → Navigator).
///
/// `MaterialApp.builder` ichida (Navigator'dan YUQORIDA) turadi, shuning
/// uchun navigatsiya [navigatorKey] orqali — `DriverWalletEventsHost` kabi.
class PushTapHost extends StatefulWidget {
  const PushTapHost({
    super.key,
    required this.navigatorKey,
    required this.child,
    this.router,
    this.intercityRepository,
  });

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  /// Testlar uchun; standart — [PushTapRouter.instance].
  final PushTapRouter? router;
  final IntercityRepository? intercityRepository;

  @override
  State<PushTapHost> createState() => _PushTapHostState();
}

/// Sozlamalar so'rovi sekin bo'lsa ekran shuni kutib qolib ketmasin.
const Duration _kSettingsTimeout = Duration(seconds: 3);

class _PushTapHostState extends State<PushTapHost> {
  late final PushTapRouter _router = widget.router ?? PushTapRouter.instance;
  late final IntercityRepository _intercity = widget.intercityRepository ?? IntercityRepository();
  StreamSubscription<PushTapTarget>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = _router.targets.listen((target) => unawaited(_open(target)));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  /// Bandlar ekrani bepul bekor qilish muddatini ko'rsatadi — sozlama
  /// kelmasa standart qiymat bilan baribir ochiladi.
  Future<IntercityPublicSettings> _intercitySettings() async {
    try {
      return await _intercity.publicSettings().timeout(_kSettingsTimeout);
    } catch (_) {
      return const IntercityPublicSettings(enabled: true);
    }
  }

  Future<void> _open(PushTapTarget target) async {
    final named = switch (target) {
      PushTapTarget.driverVerification => '/driver/verification',
      PushTapTarget.driverEarnings => '/driver/earnings',
      _ => null,
    };
    final screen = named == null ? await _screenFor(target) : null;
    final navigator = widget.navigatorKey.currentState;
    if (!mounted || navigator == null) return;

    // Xuddi shu ekran allaqachon tepada bo'lsa (ikki push ketma-ket) —
    // almashtiriladi, ustma-ust to'planmaydi.
    final name = named ?? 'push:${target.name}';
    String? topName;
    navigator.popUntil((route) {
      topName = route.settings.name;
      return true;
    });
    final replace = topName == name;

    if (named != null) {
      replace ? navigator.pushReplacementNamed(named) : navigator.pushNamed(named);
      return;
    }
    final route = MaterialPageRoute<void>(settings: RouteSettings(name: name), builder: (_) => screen!);
    replace ? navigator.pushReplacement(route) : navigator.push(route);
  }

  Future<Widget> _screenFor(PushTapTarget target) async => switch (target) {
        PushTapTarget.intercityRequestBoard => IntercityRequestBoardScreen(repository: _intercity),
        PushTapTarget.intercityDriverTrips => DriverIntercityTripsScreen(repository: _intercity),
        PushTapTarget.intercityBookings =>
          IntercityBookingsScreen(settings: await _intercitySettings(), repository: _intercity),
        PushTapTarget.intercityRequests =>
          IntercityRequestsScreen(settings: await _intercitySettings(), repository: _intercity),
        PushTapTarget.supportChat => const ChatScreen(),
        PushTapTarget.lostItems => LostItemsScreen(isDriver: _router.driver),
        // Nomli marshrutlar `_open` da.
        PushTapTarget.driverVerification || PushTapTarget.driverEarnings => const SizedBox.shrink(),
      };

  @override
  Widget build(BuildContext context) => widget.child;
}
