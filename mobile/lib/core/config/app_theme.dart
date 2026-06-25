import 'package:flutter/material.dart';

const Color kPrimaryYellow = Color(0xFFF5C518);
const Color kSecondaryBlack = Color(0xFF1A1A1A);
const Color kBackgroundWhite = Color(0xFFFFFFFF);
const Color kSurfaceGrey = Color(0xFFF5F5F5);
const Color kTextPrimary = Color(0xFF1A1A1A);
const Color kTextSecondary = Color(0xFF757575);
const Color kError = Color(0xFFD32F2F);
const Color kSuccess = Color(0xFF388E3C);

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: kPrimaryYellow,
    primary: kPrimaryYellow,
    secondary: kSecondaryBlack,
    surface: kBackgroundWhite,
    error: kError,
  ),
  scaffoldBackgroundColor: kBackgroundWhite,
  appBarTheme: const AppBarTheme(
    backgroundColor: kSecondaryBlack,
    foregroundColor: Colors.white,
    elevation: 0,
    centerTitle: true,
    titleTextStyle: TextStyle(
      color: Colors.white,
      fontSize: 18,
      fontWeight: FontWeight.w600,
    ),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: kPrimaryYellow,
      foregroundColor: Colors.black,
      minimumSize: const Size(double.infinity, 52),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      textStyle: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: kSecondaryBlack,
      minimumSize: const Size(double.infinity, 52),
      side: const BorderSide(color: kSecondaryBlack),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: kSurfaceGrey,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: kPrimaryYellow, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: kError),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),
  cardTheme: CardThemeData(
    elevation: 2,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    color: kBackgroundWhite,
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.bold,
      color: kTextPrimary,
    ),
    headlineMedium: TextStyle(
      fontSize: 22,
      fontWeight: FontWeight.bold,
      color: kTextPrimary,
    ),
    headlineSmall: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: kTextPrimary,
    ),
    bodyLarge: TextStyle(fontSize: 16, color: kTextPrimary),
    bodyMedium: TextStyle(fontSize: 14, color: kTextPrimary),
    bodySmall: TextStyle(fontSize: 12, color: kTextSecondary),
    labelLarge: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: kTextPrimary,
    ),
  ),
);
