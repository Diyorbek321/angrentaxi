import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/state/courier_tracking_controller.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

/// Ovqat/market buyurtmasini olib kelayotgan kuryer — xaritada, jonli.
///
/// Taksi kuzatuvining (`ActiveOrderView`) soddalashtirilgan egizagi: xarita
/// + restoran/do'kon va mijoz nuqtalari + silliq suriluvchi mashina,
/// pastda kuryer kartasi va qo'ng'iroq. SOS, chat, kutish, taksometr yo'q —
/// mijoz bu safarda yo'lovchi emas.
class CourierTrackingScreen extends StatefulWidget {
  const CourierTrackingScreen({
    super.key,
    required this.refreshPath,
    required this.initial,
  });

  /// `/food/orders/:id` yoki `/market/orders/:id`.
  final String refreshPath;
  final CourierTracking initial;

  @override
  State<CourierTrackingScreen> createState() => _CourierTrackingScreenState();
}

class _CourierTrackingScreenState extends State<CourierTrackingScreen> {
  late final CourierTrackingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = CourierTrackingController(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
      refreshPath: widget.refreshPath,
      initial: widget.initial,
    )..start();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) {
          final tracking = _controller.tracking;
          return Stack(
            children: [
              _buildMap(tracking),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(kSpace4),
                  child: AgMapFab(
                    icon: Icons.arrow_back_rounded,
                    semanticsLabel: MaterialLocalizations.of(context).backButtonTooltip,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              _buildPanel(tracking),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(CourierTracking tracking) {
    final markers = <AppMapMarker>[
      if (tracking.pickup != null)
        AppMapMarker(point: tracking.pickup!, icon: AppMapIcon.pickup),
      if (tracking.dropoff != null)
        AppMapMarker(point: tracking.dropoff!, icon: AppMapIcon.dropoff),
    ];
    final center = tracking.dropoff ?? tracking.pickup ?? const LatLng(41.0167, 70.1436);

    return ValueListenableBuilder<LatLng?>(
      valueListenable: _controller.courierLocation,
      builder: (context, courier, _) => AppVectorMap(
        initialCenter: center,
        initialZoom: 14,
        markers: markers,
        // Mashina alohida: xarita uni ichkarida silliq suradi va buradi.
        carLocation: courier,
        fitToContent: true,
      ),
    );
  }

  Widget _buildPanel(CourierTracking tracking) {
    final l10n = context.l10n;
    final (label, tone) = _controller.isCancelled
        ? (l10n.saTrackCancelled, AppStatusTone.danger)
        : _controller.isDelivered
        ? (l10n.saTrackDelivered, AppStatusTone.success)
        : tracking.hasCourier
            ? (l10n.saTrackOnTheWay, AppStatusTone.info)
            : (l10n.saTrackSearching, AppStatusTone.warning);

    return AdaptiveMapPanel(
      layered: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: AppStatusBadge(label: label, tone: tone),
          ),
          if (tracking.hasCourier) ...[
            const SizedBox(height: kSpace3),
            AgSurfaceCard(child: _buildCourierRow(tracking)),
          ],
          if (!_controller.isFinished && tracking.hasCourier)
            ValueListenableBuilder<LatLng?>(
              valueListenable: _controller.courierLocation,
              builder: (context, courier, _) => courier != null
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.only(top: kSpace2),
                      child: Text(
                        l10n.saTrackWaitingLocation,
                        style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
                      ),
                    ),
            ),
        ],
      ),
    );
  }

  Widget _buildCourierRow(CourierTracking tracking) {
    final phone = tracking.driverPhone;
    return Row(
      children: [
        const ExcludeSemantics(
          child: CircleAvatar(
            radius: 24,
            backgroundColor: kMintTint,
            child: Icon(Icons.delivery_dining_rounded, color: kPrimary, size: 26),
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tracking.driverName ?? '',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: kFontTitle,
                  color: kInk,
                ),
              ),
              if (tracking.carLabel.isNotEmpty)
                Text(
                  tracking.carLabel,
                  style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
                ),
            ],
          ),
        ),
        if (phone != null && phone.isNotEmpty)
          AgMapFab(
            icon: Icons.call_rounded,
            semanticsLabel: context.l10n.saTrackCallCourier,
            onTap: () => _call(phone),
          ),
      ],
    );
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.saCallFailed)),
      );
    }
  }
}
