import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_vector_map.dart';
import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:latlong2/latlong.dart';

/// Pin-drop location picker: a fixed marker sits at the screen center while
/// the map moves underneath it. Used for both pickup and dropoff, since
/// neither could previously be set from the map — pickup was hard-locked to
/// raw GPS, dropoff only came from text search.
class MapPickerScreen extends StatefulWidget {
  const MapPickerScreen({
    super.key,
    required this.title,
    this.initialLocation,
  });

  /// Shown above the address preview, e.g. "Qayerdan" or "Qayerga".
  final String title;

  /// Where to center the map initially (e.g. current GPS position, or the
  /// previously chosen pickup/dropoff). Defaults to Angren's center.
  final LatLng? initialLocation;

  @override
  State<MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends State<MapPickerScreen> {
  late LatLng _center = widget.initialLocation ??
      const LatLng(AppConfig.defaultLat, AppConfig.defaultLng);
  String? _address;
  bool _resolving = true;

  @override
  void initState() {
    super.initState();
    _resolveAddress(_center);
  }

  Future<void> _resolveAddress(LatLng point) async {
    setState(() => _resolving = true);
    try {
      final placemarks = await placemarkFromCoordinates(
        point.latitude,
        point.longitude,
      ).timeout(const Duration(seconds: 6));

      if (!mounted) return;
      if (placemarks.isEmpty) {
        setState(() {
          _address = "Noma'lum manzil";
          _resolving = false;
        });
        return;
      }

      final p = placemarks.first;
      final addr = [p.street, p.subLocality, p.locality]
          .where((e) => e != null && e.isNotEmpty)
          .join(', ');
      setState(() {
        _address = addr.isEmpty ? "Noma'lum manzil" : addr;
        _resolving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _address = "Manzilni aniqlab bo'lmadi";
        _resolving = false;
      });
    }
  }

  void _confirm() {
    Navigator.of(context).pop(
      OrderLocation(
        address: _address ?? "Noma'lum manzil",
        lat: _center.latitude,
        lng: _center.longitude,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Stack(
        alignment: Alignment.center,
        children: [
          AppVectorMap(
            initialCenter: _center,
            initialZoom: 16,
            // Xarita to'xtaganda markazdagi nuqta manzilga aylantiriladi —
            // pin qimirlamaydi, xarita uning ostida suriladi.
            onCameraIdle: (center) {
              _center = center;
              _resolveAddress(center);
            },
          ),
          // Fixed pin — the map moves under it, not the other way around.
          const Padding(
            padding: EdgeInsets.only(bottom: kSpace10),
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: Icon(Icons.location_on, color: kInk, size: 46),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: Padding(
                padding: const EdgeInsets.all(kSpace4),
                child: _CircleButton(
                  icon: Icons.arrow_back_rounded,
                  semanticsLabel: 'Orqaga',
                  onTap: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: _buildBottomPanel(),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomPanel() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(kSpace5, kSpace5, kSpace5, kSpace8),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(kRadiusXl),
        ),
        boxShadow: kShadowPop,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title,
            style: const TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w600,
              color: kInkMuted,
            ),
          ),
          const SizedBox(height: kSpace2),
          Row(
            children: [
              const ExcludeSemantics(
                child:
                    Icon(Icons.location_on_outlined, color: kPrimary, size: 20),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(
                  _resolving ? 'Manzil aniqlanmoqda...' : (_address ?? ''),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w700,
                    color: kInk,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace5),
          AppButton(
            label: 'Shu joyni tanlash',
            isEnabled: !_resolving,
            onPressed: _resolving ? null : _confirm,
          ),
        ],
      ),
    );
  }
}

/// Xarita ustidagi dumaloq ikona-tugma — 48x48 tegish maydoni va ekran
/// o'quvchi uchun matnli yorliq bilan.
class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Container(
            width: kMinTapTarget,
            height: kMinTapTarget,
            decoration: BoxDecoration(
              color: kSurface,
              shape: BoxShape.circle,
              boxShadow: kShadowPop,
            ),
            child: Icon(icon, color: kInk),
          ),
        ),
      ),
    );
  }
}
