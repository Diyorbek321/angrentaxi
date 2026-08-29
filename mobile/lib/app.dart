import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_platform.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/auth/screens/otp_screen.dart';
import 'package:angren_taxi/features/auth/screens/phone_screen.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/arrived_screen.dart';
import 'package:angren_taxi/features/driver/screens/demand_map_screen.dart';
import 'package:angren_taxi/features/driver/screens/driver_onboarding_screen.dart';
import 'package:angren_taxi/features/driver/screens/driver_services_screen.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/features/driver/screens/home_screen.dart'
    as driver_home;
import 'package:angren_taxi/features/driver/screens/navigation_screen.dart';
import 'package:angren_taxi/features/driver/screens/order_offer_screen.dart';
import 'package:angren_taxi/features/driver/screens/profile_screen.dart'
    as driver_profile;
import 'package:angren_taxi/features/driver/screens/trip_screen.dart';
import 'package:angren_taxi/features/driver/screens/verification_screen.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
import 'package:angren_taxi/features/passenger/screens/home_screen.dart'
    as passenger_home;
import 'package:angren_taxi/features/passenger/screens/order_history_screen.dart';
import 'package:angren_taxi/features/passenger/screens/profile_screen.dart'
    as passenger_profile;
import 'package:angren_taxi/features/passenger/screens/scheduled_orders_screen.dart';
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/features/superapp/screens/main_shell.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/support/support_provider.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class AngrenTaxiApp extends StatelessWidget {
  const AngrenTaxiApp({super.key, required this.flavor});

  final AppFlavor flavor;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(
            create: (_) => buildAuthProvider()),
        ChangeNotifierProvider<SupportProvider>(
            create: (_) => buildSupportProvider()),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<OrderProvider>(
            create: (_) => buildOrderProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<FavoritesProvider>(
            create: (_) => buildFavoritesProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<NotificationsProvider>(
            create: (_) => buildNotificationsProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<SuperappProvider>(
            create: (_) => buildSuperappProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<MarketProvider>(
            create: (_) => buildMarketProvider(),
          ),
        if (flavor == AppFlavor.passenger)
          ChangeNotifierProvider<FoodProvider>(
            create: (_) => buildFoodProvider(),
          ),
        if (flavor == AppFlavor.driver)
          ChangeNotifierProvider<DriverProvider>(
            create: (_) => buildDriverProvider(),
          ),
      ],
      child: MaterialApp(
        title: 'Angren Taxi',
        debugShowCheckedModeBanner: false,

        // Yorug' va qorong'i temalar bitta quruvchidan chiqadi
        // (`app_theme.dart` 12-bo'lim).
        //
        // ⚠️ `themeMode` ATAYLAB `light` — `system` EMAS.
        //
        // Qorong'i tema TO'LIQ qurilgan va to'g'ri, lekin ekranlar hali
        // unga tayyor emas: 51 faylda 461 marta `kSurface`, `kInk`,
        // `agBg` kabi YORUG'LIKKA QATTIQ BOG'LANGAN const tokenlar
        // ishlatilgan. Ular `const Color` bo'lgani uchun temaga javob
        // bermaydi — `system` rejimida qurilma qorong'i bo'lsa, Scaffold
        // foni qorayadi-yu, kartalar oq, matn esa deyarli qora bo'lib
        // qoladi. Ya'ni yoqish "qorong'i rejim" emas, BUZILGAN ekran
        // beradi.
        //
        // YOQISH TARTIBI: ekranlardagi `kSurface` → `scheme.surface`,
        // `kInk` → `scheme.onSurface`, `kInkMuted` → `scheme.onSurfaceVariant`,
        // `kBackground` → `scheme.surfaceContainerLowest`,
        // `kLine` → `scheme.outlineVariant` ga ko'chirilgach, shu qatorni
        // `ThemeMode.system` ga o'zgartirish kifoya — boshqa hech narsa
        // kerak emas.
        theme: appTheme,
        darkTheme: appDarkTheme,
        themeMode: ThemeMode.light,

        // Platformaga mos scroll fizikasi butun ilovaga bir joydan
        // qo'llanadi: iOS'da bounce, Android'da M3 stretch.
        scrollBehavior: const AppScrollBehavior(),

        navigatorKey: sl<GlobalKey<NavigatorState>>(),
        // Xiaomi/Samsung qobiqlarida "Shrift o'lchami" va "Ekran o'lchami"
        // sozlamalari matnni 1.5–2x gacha kattalashtirishi mumkin. Ekranlar
        // qattiq balandlikdagi kartalar bilan qurilgani uchun bu yerda matn
        // toshib ketardi ("responsive emas" deb ko'rinadigan holat).
        //
        // Foydalanuvchi tanlovini butunlay bekor qilmaymiz — kattalashtirishga
        // ruxsat beriladi, lekin layout buziladigan darajagacha emas.
        builder: (context, child) {
          final media = MediaQuery.of(context);

          // Planshetda tartib allaqachon kengroq bo'lgani uchun matnni
          // 1.4x gacha kattalashtirishga joy bor; tor telefonda (< 360dp)
          // esa 1.2x dan oshsa kartalar toshib ketadi.
          final wide = breakpointForWidth(media.size.width) != Breakpoint.tight;

          return MediaQuery(
            data: media.copyWith(
              textScaler: media.textScaler.clamp(
                minScaleFactor: 0.85,
                maxScaleFactor: wide ? 1.4 : 1.2,
              ),
            ),
            child: child ?? const SizedBox.shrink(),
          );
        },
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
        '/passenger/scheduled': (_) => const ScheduledOrdersScreen(),
        '/passenger/profile': (_) =>
            const passenger_profile.PassengerProfileScreen(),
      };
    }

    return {
      ...sharedRoutes,
      // '/home' is the post-login target used by the OTP screen; route it
      // through the onboarding gate first, since a freshly-logged-in driver
      // account may not have an approved driver profile yet.
      '/home': (_) => const DriverOnboardingScreen(),
      '/driver/gate': (_) => const DriverOnboardingScreen(),
      '/driver/home': (_) => const driver_home.DriverHomeScreen(),
      '/driver/offer': (_) => const OrderOfferScreen(),
      '/driver/navigation': (_) => const NavigationScreen(),
      '/driver/arrived': (_) => const ArrivedScreen(),
      '/driver/trip': (_) => const TripScreen(),
      '/driver/earnings': (_) => const EarningsScreen(),
      '/driver/demand': (_) => const DemandMapScreen(),
      '/driver/profile': (_) => const driver_profile.DriverProfileScreen(),
      // Tekshiruv ro'yxati SERVERDAN keladi — bu ekran yangi talab
      // qo'shilganda o'zgarmaydi (verification_screen.dart boshidagi izoh).
      '/driver/verification': (_) => const DriverVerificationScreen(),
      // Kuryer rejimi: haydovchi qaysi vertikallardan buyurtma olishini
      // o'zi tanlaydi (ovqat/market shusiz hech kimga mos kelmaydi).
      '/driver/services': (_) => const DriverServicesScreen(),
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
          : '/driver/gate';
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
