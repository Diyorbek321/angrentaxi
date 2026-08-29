import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';

final GetIt sl = GetIt.instance;

Future<void> setupServiceLocator() async {
  // Navigator key (singleton)
  sl.registerLazySingleton<GlobalKey<NavigatorState>>(
    () => GlobalKey<NavigatorState>(),
  );

  // SharedPreferences
  final prefs = await SharedPreferences.getInstance();
  sl.registerSingleton<SharedPreferences>(prefs);

  // Core services
  // LocalStorage is eager (not lazy) because its tokens must be loaded from
  // the keystore — and migrated off legacy SharedPreferences — before any
  // authenticated request can be built.
  final localStorage = LocalStorage(prefs);
  await localStorage.initTokens();
  sl.registerSingleton<LocalStorage>(localStorage);

  sl.registerLazySingleton<ApiClient>(
    () => ApiClient(sl<LocalStorage>(), sl<GlobalKey<NavigatorState>>()),
  );

  sl.registerLazySingleton<SocketService>(() => SocketService());

  sl.registerLazySingleton<LocationService>(() => LocationService());

  sl.registerLazySingleton<RouteService>(() => RouteService());

  // Ovozli navigatsiya. Lazy singleton ATAYLAB: `init()` qurilmadagi
  // tillar ro'yxatini so'raydi (sekin platforma chaqiruvi), navigatsiya
  // ekraniga har kirganda uni qaytadan so'rash ortiqcha.
  sl.registerLazySingleton<VoiceGuide>(() => VoiceGuide());
}
