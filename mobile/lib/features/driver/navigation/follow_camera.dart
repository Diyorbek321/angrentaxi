import 'package:angren_taxi/core/location/heading_tracker.dart';
import 'package:angren_taxi/features/passenger/map_camera_insets.dart';
import 'package:flutter/painting.dart' show EdgeInsets;
import 'package:geolocator/geolocator.dart' show Position;
import 'package:latlong2/latlong.dart';
import 'package:maplibre_gl/maplibre_gl.dart' as ml;

/// Navigator kamerasi — mashina ortidan, harakat yo'nalishiga burilgan.
///
/// Ilgari ikki ekran (`navigation_screen`, `trip_screen`) har ping'da
/// IKKITA animatsiya berardi: avval mashinaga, keyin sheet ustiga
/// `scrollBy`. Xarita har soniyada ikki marta silkinardi va hamisha
/// shimolga qarab turardi — haydovchi "o'ngga buriling" ni xaritadan
/// o'qiy olmasdi.
///
/// Endi sheet balandligi xaritaga bir marta CHET (content insets) sifatida
/// beriladi: MapLibre markazni o'zi ochiq maydon o'rtasiga qo'yadi va har
/// ping'da bitta silliq animatsiya qoladi.
class FollowCamera {
  FollowCamera({this.zoom = 16.5, this.tilt = 45});

  final double zoom;
  final double tilt;

  final HeadingTracker _heading = HeadingTracker();
  MapCameraInsets? _appliedInsets;

  /// Birinchi ergashishda kamera [zoom] ga o'rnatiladi; keyin haydovchi
  /// tanlagan masshtab (+/− tugmalari, chimchilash) SAQLANADI — aks holda
  /// har ping uni 16.5 ga qaytarib, tugmalar ishlamay qolardi.
  bool _zoomSet = false;
  bool _busy = false;

  /// Ping orasidagi animatsiya — GPS ~1 soniyada keladi, shundan qisqaroq.
  static const Duration _animation = Duration(milliseconds: 800);

  /// Yangi GPS fiksi: yo'nalishni yangilaydi.
  void onPosition(Position position) {
    _heading.update(
      LatLng(position.latitude, position.longitude),
      speed: position.speed,
      heading: position.heading,
    );
  }

  /// Chetlar oxirgi qo'llanganidan farq qiladimi (sheet o'lchami o'zgardi).
  bool insetsChanged(MapCameraInsets insets) {
    final applied = _appliedInsets;
    return applied == null ||
        (applied.left - insets.left).abs() > 1 ||
        (applied.top - insets.top).abs() > 1 ||
        (applied.right - insets.right).abs() > 1 ||
        (applied.bottom - insets.bottom).abs() > 1;
  }

  /// Kamerani [target] ga qaratadi. Oldingi animatsiya tugamagan bo'lsa
  /// ping tashlab yuboriladi — keyingisi baribir eng yangi joyni olib keladi.
  Future<void> follow(
    ml.MapLibreMapController controller,
    LatLng target,
    MapCameraInsets insets,
  ) async {
    if (_busy) return;
    _busy = true;
    try {
      if (insetsChanged(insets)) {
        _appliedInsets = insets;
        await controller.updateContentInsets(
          EdgeInsets.fromLTRB(insets.left, insets.top, insets.right, insets.bottom),
        );
      }
      await controller.animateCamera(
        ml.CameraUpdate.newCameraPosition(
          ml.CameraPosition(
            target: ml.LatLng(target.latitude, target.longitude),
            zoom: _zoomSet ? controller.cameraPosition?.zoom ?? zoom : zoom,
            tilt: tilt,
            bearing: _heading.bearing ?? 0,
          ),
        ),
        duration: _animation,
      );
      _zoomSet = true;
    } finally {
      _busy = false;
    }
  }

  /// Umumiy ko'rinishga (bounds) qaytishdan oldin: chetlarni olib tashlaydi,
  /// aks holda `newLatLngBounds` paddingi ularning ustiga qo'shilardi.
  Future<void> reset(ml.MapLibreMapController controller) async {
    if (_appliedInsets == null) return;
    _appliedInsets = null;
    await controller.updateContentInsets(EdgeInsets.zero);
  }
}
