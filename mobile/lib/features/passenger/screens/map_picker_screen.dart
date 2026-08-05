import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
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
          FlutterMap(
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 16,
              onMapEvent: (event) {
                if (event is MapEventMoveEnd) {
                  _resolveAddress(event.camera.center);
                  _center = event.camera.center;
                } else if (event is MapEventMove) {
                  _center = event.camera.center;
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'uz.angren.taxi',
              ),
            ],
          ),
          // Fixed pin — the map moves under it, not the other way around.
          const Padding(
            padding: EdgeInsets.only(bottom: 40),
            child: IgnorePointer(
              child: Icon(Icons.location_on, color: kInk, size: 46),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _CircleButton(
                  icon: Icons.arrow_back_rounded,
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
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: kInk.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: kTextSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, color: kPrimary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _resolving ? 'Manzil aniqlanmoqda...' : (_address ?? ''),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _resolving ? null : _confirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
              ),
              child: const Text(
                'Shu joyni tanlash',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: kSurface,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: kInk.withValues(alpha: 0.12), blurRadius: 12),
          ],
        ),
        child: Icon(icon, color: kInk),
      ),
    );
  }
}
