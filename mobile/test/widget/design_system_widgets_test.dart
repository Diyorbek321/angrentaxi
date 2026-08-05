import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

/// Dizayn tizimining umumiy vidjetlari uchun testlar.
///
/// Bu testlar KO'RINISHNI emas, **shartnomani** tasdiqlaydi:
///   - interaktiv to'ldirish `kPrimary`, mint EMAS (kontrast 5.38:1 vs 2.12:1)
///   - holat faqat rang bilan berilmaydi (ikonka + matn ham bor)
///   - tegish maydonlari 48dp dan kichik emas
///   - yuklanish skeleton bilan, ekran o'quvchi uchun e'lon qilinadi
Widget _host(Widget child) => MaterialApp(
      theme: appTheme,
      home: Scaffold(body: child),
    );

/// Skeleton uzluksiz shimmer bilan chiziladi. Testda uni `disableAnimations`
/// orqali to'xtatamiz — bu ayni paytda "prefers-reduced-motion" yo'lini ham
/// tekshiradi (animatsiya o'chirilganda skeleton statik qolishi shart).
Widget _hostReducedMotion(Widget child) => MediaQuery(
      data: const MediaQueryData(disableAnimations: true),
      child: _host(child),
    );

void main() {
  group('AppButton', () {
    testWidgets('interaktiv to\'ldirish kPrimary — mint EMAS', (tester) async {
      await tester.pumpWidget(
        _host(AppButton(label: 'Davom etish', onPressed: () {})),
      );

      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      final bg = button.style!.backgroundColor!
          .resolve(<WidgetState>{});

      expect(bg, kPrimary);
      // Mint yorug' fonda oq matn bilan 2.12:1 beradi — tugmada bo'lishi mumkin emas.
      expect(bg, isNot(kMint));
    });

    testWidgets('disabled holat kPrimaryDisabled fon + kInkMuted yozuv',
        (tester) async {
      await tester.pumpWidget(
        _host(const AppButton(label: 'Davom etish', onPressed: null)),
      );

      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNull);
      expect(
        button.style!.backgroundColor!.resolve(<WidgetState>{WidgetState.disabled}),
        kPrimaryDisabled,
      );
      expect(
        button.style!.foregroundColor!.resolve(<WidgetState>{WidgetState.disabled}),
        kInkMuted,
      );
    });

    testWidgets('pressed holatda fon to\'qlashadi, matn oq qoladi',
        (tester) async {
      await tester.pumpWidget(
        _host(AppButton(label: 'Davom etish', onPressed: () {})),
      );

      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(
        button.style!.backgroundColor!.resolve(<WidgetState>{WidgetState.pressed}),
        kPrimaryPressed,
      );
      expect(
        button.style!.foregroundColor!.resolve(<WidgetState>{WidgetState.pressed}),
        kOnPrimary,
      );
    });

    testWidgets('balandligi hech qachon 48dp dan kichik emas', (tester) async {
      await tester.pumpWidget(
        _host(AppButton(label: 'Kichik', onPressed: () {}, height: 20)),
      );

      expect(
        tester.getSize(find.byType(ElevatedButton)).height,
        greaterThanOrEqualTo(kMinTapTarget),
      );
    });

    testWidgets('yuklanish holati ekran o\'quvchiga e\'lon qilinadi',
        (tester) async {
      await tester.pumpWidget(
        _host(AppButton(label: 'Yuborish', onPressed: () {}, isLoading: true)),
      );

      final semantics = tester.getSemantics(find.byType(AppButton));
      expect(semantics.value, 'Yuklanmoqda');
      expect(semantics.hasFlag(SemanticsFlag.isButton), isTrue);
    });
  });

  group('AppStatusBadge', () {
    testWidgets('holat rang bilan YOLG\'IZ qolmaydi — ikonka ham bor',
        (tester) async {
      await tester.pumpWidget(
        _host(const AppStatusBadge(
          label: 'Yakunlandi',
          tone: AppStatusTone.success,
        )),
      );

      expect(find.text('Yakunlandi'), findsOneWidget);
      // Uchinchi signal: shakl (ikonka) — rangni ko'rmaydiganlar uchun.
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('har bir tone farqli ikonkaga ega', (tester) async {
      final icons = AppStatusTone.values.map((t) => t.icon).toSet();
      expect(icons.length, AppStatusTone.values.length);
    });

    testWidgets('success matni kPrimary — mint emas (mint tint ustida 4.95:1)',
        (tester) async {
      expect(AppStatusTone.success.foreground, kPrimary);
      expect(AppStatusTone.success.background, kMintTint);
      expect(AppStatusTone.danger.foreground, kErrorDeep);
      expect(AppStatusTone.warning.foreground, kWarningDeep);
      expect(AppStatusTone.info.foreground, kInfoDeep);
    });

    testWidgets('ekran o\'quvchi uchun "Holat: ..." deb o\'qiladi',
        (tester) async {
      await tester.pumpWidget(
        _host(const AppStatusBadge(
          label: 'Bekor qilindi',
          tone: AppStatusTone.danger,
        )),
      );

      expect(
        tester.getSemantics(find.byType(AppStatusBadge)).label,
        'Holat: Bekor qilindi',
      );
    });
  });

  group('AppEmptyState', () {
    testWidgets('sarlavha, izoh va harakat tugmasini ko\'rsatadi',
        (tester) async {
      var tapped = false;
      await tester.pumpWidget(_host(AppEmptyState(
        icon: Icons.receipt_long_rounded,
        title: 'Buyurtmalar yo\'q',
        message: 'Birinchi buyurtmangizni bering',
        actionLabel: 'Buyurtma berish',
        onAction: () => tapped = true,
      )));

      expect(find.text('Buyurtmalar yo\'q'), findsOneWidget);
      expect(find.text('Birinchi buyurtmangizni bering'), findsOneWidget);

      await tester.tap(find.text('Buyurtma berish'));
      expect(tapped, isTrue);
    });

    testWidgets('harakat tugmasi 48dp dan past emas', (tester) async {
      await tester.pumpWidget(_host(AppEmptyState(
        icon: Icons.search_off_rounded,
        title: 'Topilmadi',
        actionLabel: 'Qayta izlash',
        onAction: () {},
      )));

      expect(
        tester.getSize(find.byType(ElevatedButton)).height,
        greaterThanOrEqualTo(kMinTapTarget),
      );
    });
  });

  group('Xato holati', () {
    testWidgets('AppErrorState xabar va qayta urinish tugmasini beradi',
        (tester) async {
      var retried = false;
      await tester.pumpWidget(_host(AppErrorState(
        message: 'Tarmoqqa ulanib bo\'lmadi',
        onRetry: () => retried = true,
      )));

      expect(find.text('Xatolik yuz berdi'), findsOneWidget);
      expect(find.text('Tarmoqqa ulanib bo\'lmadi'), findsOneWidget);

      await tester.tap(find.text('Qayta urinish'));
      expect(retried, isTrue);
    });

    testWidgets('InlineErrorWidget xato matnini kErrorDeep bilan chizadi',
        (tester) async {
      await tester.pumpWidget(
        _host(const InlineErrorWidget(message: 'Summa noto\'g\'ri')),
      );

      // Matn semantikada, shuning uchun vidjet daraxtidan olinadi.
      final text = tester.widget<Text>(
        find.descendant(
          of: find.byType(InlineErrorWidget),
          matching: find.byType(Text),
        ),
      );
      // kError (3.91:1) matn uchun yetarli emas — kErrorDeep (6.47:1) kerak.
      expect(text.style!.color, kErrorDeep);
      expect(text.style!.color, isNot(kError));
    });
  });

  group('Skeleton', () {
    testWidgets('ro\'yxat skeletoni so\'ralgan sonda qator chizadi',
        (tester) async {
      await tester.pumpWidget(_hostReducedMotion(
        const SingleChildScrollView(child: AppSkeletonList(itemCount: 3)),
      ));

      expect(find.byType(AppSkeletonTile), findsNWidgets(3));
    });

    testWidgets('skeleton ekran o\'quvchiga "Yuklanmoqda" deb e\'lon qilinadi',
        (tester) async {
      await tester.pumpWidget(_hostReducedMotion(
        const SingleChildScrollView(child: AppSkeletonList(itemCount: 2)),
      ));

      expect(
        tester.getSemantics(find.byType(AppSkeletonGroup)).label,
        'Yuklanmoqda',
      );
    });

    testWidgets('to\'r skeletoni karta shaklini takrorlaydi', (tester) async {
      await tester.pumpWidget(_hostReducedMotion(
        const SingleChildScrollView(child: AppSkeletonGrid(itemCount: 4)),
      ));

      expect(find.byType(AppSkeletonCard), findsWidgets);
    });
  });

  group('Token shartnomasi', () {
    test('kPrimary interaktiv, kMint aksent — ular bir xil EMAS', () {
      expect(kPrimary, const Color(0xFF0C7A4D));
      expect(kMint, const Color(0xFF1FCA8E));
      expect(kPrimary, isNot(kMint));
    });

    test('success semantikasi alohida yashil kiritmaydi', () {
      expect(kSuccess, kMint);
      expect(kSuccessDeep, kPrimary);
    });

    test('radius va spacing shkalalari kanonik qiymatlarda', () {
      expect([kRadiusXs, kRadiusSm, kRadiusMd, kRadiusLg, kRadiusXl],
          [8, 12, 16, 22, 28]);
      expect([kSpace1, kSpace2, kSpace3, kSpace4, kSpace5, kSpace6],
          [4, 8, 12, 16, 20, 24]);
    });

    test('tegish maydoni va boshqaruv balandligi', () {
      expect(kMinTapTarget, 48);
      expect(kControlHeight, 54);
    });
  });
}
