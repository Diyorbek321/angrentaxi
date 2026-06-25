import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';

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
  sl.registerLazySingleton<LocalStorage>(() => LocalStorage(sl()));

  sl.registerLazySingleton<ApiClient>(
    () => ApiClient(sl<LocalStorage>(), sl<GlobalKey<NavigatorState>>()),
  );

  sl.registerLazySingleton<SocketService>(() => SocketService());

  sl.registerLazySingleton<LocationService>(() => LocationService());
}
