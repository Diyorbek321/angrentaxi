import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/auth/screens/otp_screen.dart';
import 'package:angren_taxi/features/auth/screens/phone_screen.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/arrived_screen.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/features/driver/screens/home_screen.dart'
    as driver_home;
import 'package:angren_taxi/features/driver/screens/navigation_screen.dart';
import 'package:angren_taxi/features/driver/screens/order_offer_screen.dart';
import 'package:angren_taxi/features/driver/screens/profile_screen.dart'
    as driver_profile;
import 'package:angren_taxi/features/driver/screens/trip_screen.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
import 'package:angren_taxi/features/passenger/screens/home_screen.dart'
    as passenger_home;
import 'package:angren_taxi/features/passenger/screens/order_history_screen.dart';
import 'package:angren_taxi/features/passenger/screens/profile_screen.dart'
    as passenger_profile;
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/features/superapp/screens/main_shell.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class AngrenTaxiApp extends StatelessWidget {
  const AngrenTaxiApp({super.key, required this.flavor});

  final AppFlavor flavor;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(create: (_) => buildAuthProvider()),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<OrderProvider>(
            create: (_) => buildOrderProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<SuperappProvider>(
            create: (_) => SuperappProvider(),
          ),
        if (flavor == AppFlavor.driver)
          ChangeNotifierProvider<DriverProvider>(
            create: (_) => buildDriverProvider(),
          ),
      ],
      child: MaterialApp(
        title: 'Angren Taxi',
        debugShowCheckedModeBanner: false,
        theme: appTheme,
        navigatorKey: sl<GlobalKey<NavigatorState>>(),
        home: _AppEntryPoint(flavor: flavor),
        routes: _buildRoutes(flavor),
      ),
    );
  }

  Map<String, WidgetBuilder> _buildRoutes(AppFlavor flavor) {
    final sharedRoutes = <String, WidgetBuilder>{
      '/phone': (_) => const PhoneScreen(),
      '/otp': (_) => const OtpScreen(),
    };

    if (flavor == AppFlavor.passenger) {
      return {
        ...sharedRoutes,
        // '/home' is the post-login target used by the OTP screen; send it to
        // the Angren Go super-app shell (home / orders / cart / profile).
        '/home': (_) => const SuperappShell(),
        '/passenger/services': (_) => const SuperappShell(),
        '/passenger/superapp': (_) => const SuperappShell(),
        '/passenger/home': (_) => const passenger_home.PassengerHomeScreen(),
        '/passenger/destination': (_) => const DestinationScreen(),
        '/passenger/tariff': (_) => const TariffSelectScreen(),
        '/passenger/history': (_) => const OrderHistoryScreen(),
        '/passenger/profile': (_) => const passenger_profile.PassengerProfileScreen(),
      };
    }

    return {
      ...sharedRoutes,
      '/home': (_) => const driver_home.DriverHomeScreen(),
      '/driver/home': (_) => const driver_home.DriverHomeScreen(),
      '/driver/offer': (_) => const OrderOfferScreen(),
      '/driver/navigation': (_) => const NavigationScreen(),
      '/driver/arrived': (_) => const ArrivedScreen(),
      '/driver/trip': (_) => const TripScreen(),
      '/driver/earnings': (_) => const EarningsScreen(),
      '/driver/profile': (_) => const driver_profile.DriverProfileScreen(),
    };
  }
}

class _AppEntryPoint extends StatefulWidget {
  const _AppEntryPoint({required this.flavor});

  final AppFlavor flavor;

  @override
  State<_AppEntryPoint> createState() => _AppEntryPointState();
}

class _AppEntryPointState extends State<_AppEntryPoint> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final auth = context.read<AuthProvider>();
      await auth.initialize();
      if (!mounted) return;
      _navigate(auth);
    });
  }

  void _navigate(AuthProvider auth) {
    if (auth.isAuthenticated) {
      final homePath = widget.flavor == AppFlavor.passenger
          ? '/passenger/services'
          : '/driver/home';
      Navigator.of(context).pushReplacementNamed(homePath);
    } else {
      Navigator.of(context).pushReplacementNamed('/phone');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: LoadingWidget(),
    );
  }
}
