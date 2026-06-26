import 'package:flutter/material.dart';

// ============================================================================
// Angren Taxi — Design System (Bolt-style, mint green)
// Bright accent, rounded cards, clean off-white surfaces.
// ============================================================================

// --- Brand ---
const Color kPrimary = Color(0xFF1FCA8E); // mint green (Bolt-like)
const Color kPrimaryDark = Color(0xFF17A86A); // pressed / gradient end
const Color kPrimaryLight = Color(0xFFE6FAF2); // tinted surface / chips
const Color kInk = Color(0xFF0F1B22); // near-black for text & dark elements

// --- Neutrals ---
const Color kBackground = Color(0xFFF6F8FA); // app background (off-white)
const Color kSurface = Color(0xFFFFFFFF); // cards / sheets
const Color kSurfaceGrey = Color(0xFFEEF1F4); // input fill / dividers
const Color kTextPrimary = Color(0xFF0F1B22);
const Color kTextSecondary = Color(0xFF6B7785);

// --- Status ---
const Color kError = Color(0xFFE5484D);
const Color kSuccess = Color(0xFF1FCA8E);
const Color kWarning = Color(0xFFF5A623);

// --- Backward-compat aliases (old screens referenced these names) ---
const Color kPrimaryYellow = kPrimary;
const Color kSecondaryBlack = kInk;
const Color kBackgroundWhite = kBackground;

// --- Shared radii ---
const double kRadiusSm = 12;
const double kRadiusMd = 16;
const double kRadiusLg = 22;

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  fontFamily: 'Roboto',
  colorScheme: ColorScheme.fromSeed(
    seedColor: kPrimary,
    primary: kPrimary,
    onPrimary: Colors.white,
    secondary: kInk,
    surface: kSurface,
    error: kError,
    brightness: Brightness.light,
  ),
  scaffoldBackgroundColor: kBackground,

  // White app bar, dark title, mint accents — modern & airy.
  appBarTheme: const AppBarTheme(
    backgroundColor: kBackground,
    foregroundColor: kInk,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: true,
    titleTextStyle: TextStyle(
      color: kInk,
      fontSize: 18,
      fontWeight: FontWeight.w700,
    ),
    iconTheme: IconThemeData(color: kInk),
  ),

  // Filled mint pill buttons with white text.
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: kPrimary,
      foregroundColor: Colors.white,
      disabledBackgroundColor: kSurfaceGrey,
      disabledForegroundColor: kTextSecondary,
      elevation: 0,
      minimumSize: const Size(double.infinity, 54),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      textStyle: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
      ),
    ),
  ),

  // Soft tinted secondary action.
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: kPrimaryDark,
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    ),
  ),

  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: kInk,
      minimumSize: const Size(double.infinity, 54),
      side: const BorderSide(color: kSurfaceGrey, width: 1.5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
    ),
  ),

  // Borderless filled inputs, mint focus ring.
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: kSurfaceGrey,
    hintStyle: const TextStyle(color: kTextSecondary),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusMd),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusMd),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusMd),
      borderSide: const BorderSide(color: kPrimary, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusMd),
      borderSide: const BorderSide(color: kError, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
  ),

  // Rounded, lightly shadowed cards.
  cardTheme: CardThemeData(
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(kRadiusLg),
    ),
    color: kSurface,
    shadowColor: kInk.withValues(alpha: 0.08),
  ),

  chipTheme: ChipThemeData(
    backgroundColor: kPrimaryLight,
    labelStyle: const TextStyle(color: kPrimaryDark, fontWeight: FontWeight.w600),
    side: BorderSide.none,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusSm)),
  ),

  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: kSurface,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),

  dividerTheme: const DividerThemeData(
    color: kSurfaceGrey,
    thickness: 1,
    space: 1,
  ),

  bottomNavigationBarTheme: const BottomNavigationBarThemeData(
    backgroundColor: kSurface,
    selectedItemColor: kPrimary,
    unselectedItemColor: kTextSecondary,
    type: BottomNavigationBarType.fixed,
    elevation: 0,
  ),

  floatingActionButtonTheme: const FloatingActionButtonThemeData(
    backgroundColor: kPrimary,
    foregroundColor: Colors.white,
  ),

  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 30,
      fontWeight: FontWeight.w800,
      color: kTextPrimary,
      letterSpacing: -0.5,
    ),
    headlineMedium: TextStyle(
      fontSize: 23,
      fontWeight: FontWeight.w700,
      color: kTextPrimary,
      letterSpacing: -0.3,
    ),
    headlineSmall: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w700,
      color: kTextPrimary,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: kTextPrimary,
    ),
    bodyLarge: TextStyle(fontSize: 16, color: kTextPrimary),
    bodyMedium: TextStyle(fontSize: 14, color: kTextPrimary),
    bodySmall: TextStyle(fontSize: 12, color: kTextSecondary),
    labelLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w700,
      color: kTextPrimary,
    ),
  ),
);
