import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

/// Xizmat hududidan tashqarida ekanini tushuntiruvchi banner.
///
/// ⚠️ NEGA alohida vidjet: bir xil xabar IKKI joyda ko'rsatiladi — bosh
/// ekranda (buyurtma qurishdan oldin) va tarif ekranida (tugma ustida).
/// Ikki nusxa matn ikki xil so'zlanishga aylanardi, ya'ni foydalanuvchi
/// bitta holatni ikki xil o'qirdi.
///
/// Rang OGOHLANTIRISH (`kWarning*`), XATO (`kError*`) emas: bu odam
/// noto'g'ri ish qilgani emas, shunchaki hozir bu joyda xizmat yo'qligi.
/// Xato rangi aybdorlik hissi beradi va ilova buzilgandek ko'rinadi.
class CoverageNotice extends StatelessWidget {
  const CoverageNotice({super.key, required this.message});

  /// `OrderProvider.coverageWarning` dan keladigan tayyor matn: NIMA
  /// bo'lgani + eng yaqin xizmat hududi nomi.
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: kSpace3),
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace3,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ikonka dekorativ — butun ma'no matnda, shuning uchun ekran
          // o'quvchi uni o'qimaydi.
          const ExcludeSemantics(
            child: Icon(
              Icons.location_off_rounded,
              color: kWarningDeep,
              size: 20,
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
                color: kWarningDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
