import 'package:flutter/material.dart';

// ============================================================================
// TASHQI BREND RANGLARI — ATAYLAB TOKEN QILINMAYDI.
//
// Bu ranglar Angren dizayn tizimiga tegishli EMAS. Ular uchinchi tomon
// brendlariga (to'lov provayderlari, karta chipi illustratsiyasi) tegishli
// va shu sababli `app_theme.dart` dagi `k*` tokenlarga o'tkazilmaydi —
// aks holda brend yangilanganda dizayn tizimi ham o'zgarib ketardi.
//
// docs/DESIGN-TOKENS.md, 5-bo'lim: "mos token YO'Q — tashqi brend rangi".
//
// ⚠️ Bu yerga FAQAT tashqi brend rangi qo'shiladi. Ilovaning o'z rangi
// kerak bo'lsa — `app_theme.dart`.
// ============================================================================

/// Uzcard / Click brend ko'ki — gradient boshi.
const Color kBrandUzcardLight = Color(0xFF1FA0E5);

/// Uzcard / Click brend ko'ki — gradient oxiri.
const Color kBrandUzcardDark = Color(0xFF0B6BB5);

/// To'lov kartasi gradienti (Uzcard / Click).
const List<Color> kBrandUzcardGradient = [
  kBrandUzcardLight,
  kBrandUzcardDark,
];

/// Plastik karta chipi (oltin) — sof dekorativ illustratsiya.
const Color kCardChipLight = Color(0xFFF4D04A);

/// Plastik karta chipi (oltin) — gradient oxiri.
const Color kCardChipDark = Color(0xFFD4A82B);

/// Karta chipi gradienti.
const List<Color> kCardChipGradient = [kCardChipLight, kCardChipDark];
