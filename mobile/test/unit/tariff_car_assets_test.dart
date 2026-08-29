// `assets/tariffs/*.svg` — tarif mashinalari uchun shartnoma testi.
//
// Bu yerda rasmning "chiroyliligi" tekshirilmaydi — buni test o'lchay
// olmaydi. Tekshiriladigan narsa to'rt fayl bir-biriga MOS ekani:
//
//   1. To'rttasi ham `rootBundle` orqali ochiladi. Bu pubspec.yaml dagi
//      `- assets/tariffs/` qatorini ham tekshiradi: e'lon unutilsa fayl
//      diskda turaveradi, lekin ilova ichida YO'Q bo'ladi va xato faqat
//      tarif ekrani ochilganda, qurilmada chiqadi. Test uni shu yerda
//      ushlaydi.
//   2. Bitta viewBox va bitta yer chizig'i (g'ildirak cy=37, r=8.5).
//      To'rt mashina tarif qatorida YONMA-YON turadi — bitta faylda bu
//      raqam o'zgarsa qator "sakraydi", mashinalar turli balandlikda
//      qoladi. Bu ko'zga darrov tashlanmaydi, shuning uchun test kerak.
//   3. Ranglar palitradan chetga chiqmaydi va kuzov rangi tarifga
//      biriktirilgan — rasm almashtirilganda "biznes endi tejamkor
//      rangida" degan xato o'tib ketmasin.
//   4. Siluetlar bir-biridan farq qiladi. Tarifni foydalanuvchi MATNSIZ,
//      shakl orqali tanishi — komponentning butun ma'nosi shunda;
//      to'rtta bir xil `d` yozilsa rasmlar bekorga turgan bo'lardi.
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Fayl nomi → kuzov rangi. Kuzov — tarifni ajratadigan yagona rang,
/// shuning uchun bog'lanish shu yerda yozib qo'yiladi.
const Map<String, Color> _bodyColor = {
  'car_econom': kPrimary, // #0C7A4D
  'car_comfort': kInk, // #0F1B22
  'car_business': kPrimaryPressed, // #084F32
  'car_van': kInkMuted, // #5A6C75
};

/// Oyna ranglari old→orqa yorug'likdan to'qqa boradi. `#6FE4B8` —
/// `kMintSoft` tokeni; `#CFEDE0` va `#9FE3C6` esa app_theme.dart da
/// token EMAS, shuning uchun ular Dart kodiga ko'chirilmaydi va faqat
/// SVG ichida, shu yerdagi ro'yxatda qoladi.
const Set<String> _glass = {'#CFEDE0', '#9FE3C6', '#6FE4B8'};

/// G'ildirak: shina `kInk`, markaz `kSurface3`.
const String _tyre = '#0F1B22';
const String _hub = '#E2EBEC';

String _hex(Color c) =>
    '#${c.toARGB32().toRadixString(16).substring(2).toUpperCase()}';

/// Faylning BIRINCHI `<path>` i — kuzov siluet. Oyna va detallar undan
/// keyin keladi, shuning uchun tartib shartnomaning bir qismi.
final RegExp _pathRe = RegExp(r'<path\s[^>]*d="([^"]+)"[^>]*fill="(#[0-9A-F]{6})"');
final RegExp _fillRe = RegExp(r'fill="(#[0-9A-Fa-f]{6})"');

void main() {
  // `rootBundle` ServicesBinding'siz ishlamaydi.
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<String> loadSvg(String name) =>
      rootBundle.loadString('assets/tariffs/$name.svg');

  group('Tarif mashinalari — asset sifatida mavjudligi', () {
    for (final name in _bodyColor.keys) {
      test('$name.svg pubspec orqali ochiladi va 2 KB dan kichik', () async {
        final bytes = await rootBundle.load('assets/tariffs/$name.svg');

        expect(bytes.lengthInBytes, greaterThan(0));
        // Tarif qatorida to'rt rasm birdan yuklanadi — har biri yengil
        // bo'lishi kerak, aks holda karta bo'sh uya bilan ko'rinib turadi.
        expect(bytes.lengthInBytes, lessThan(2048),
            reason: '$name.svg 2 KB dan oshib ketdi');
      });
    }
  });

  group('Tarif mashinalari — umumiy geometriya shartnomasi', () {
    test('to\'rttasida ham bitta viewBox: 0 0 120 52', () async {
      for (final name in _bodyColor.keys) {
        expect(await loadSvg(name), contains('viewBox="0 0 120 52"'),
            reason: '$name.svg boshqa viewBox ishlatyapti');
      }
    });

    test('yer chizig\'i bir xil — har faylda 2 ta g\'ildirak cy=37, r=8.5',
        () async {
      for (final name in _bodyColor.keys) {
        final svg = await loadSvg(name);
        final tyres = RegExp('<circle[^>]*cy="37"[^>]*r="8.5"[^>]*'
                'fill="$_tyre"')
            .allMatches(svg);
        final hubs = RegExp('<circle[^>]*cy="37"[^>]*r="3.4"[^>]*'
                'fill="$_hub"')
            .allMatches(svg);

        // cy va r bir xil bo'lgani uchun to'rt mashina bitta yer
        // chizig'ida turadi.
        expect(tyres, hasLength(2), reason: '$name.svg: g\'ildirak soni');
        expect(hubs, hasLength(2), reason: '$name.svg: markaz soni');
      }
    });

    test('har faylda bitta ildiz <svg> va tavsiflovchi <title>', () async {
      for (final name in _bodyColor.keys) {
        final svg = await loadSvg(name);

        expect('<svg'.allMatches(svg), hasLength(1));
        expect('</svg>'.allMatches(svg), hasLength(1));
        expect(svg.trim(), endsWith('</svg>'));
        expect(svg, contains('<title>'), reason: '$name.svg: title yo\'q');
      }
    });
  });

  group('Tarif mashinalari — rang palitrasi', () {
    test('kuzov rangi tarifga biriktirilgan', () async {
      for (final entry in _bodyColor.entries) {
        final svg = await loadSvg(entry.key);
        final body = _pathRe.firstMatch(svg);

        expect(body, isNotNull, reason: '${entry.key}.svg: kuzov yo\'li yo\'q');
        // Birinchi `<path>` — kuzov; oynalar undan keyin chiziladi.
        expect(body!.group(2), _hex(entry.value),
            reason: '${entry.key}.svg kuzovi noto\'g\'ri rangda');
      }
    });

    test('palitradan tashqari rang ishlatilmagan', () async {
      for (final entry in _bodyColor.entries) {
        final svg = await loadSvg(entry.key);
        final allowed = {_hex(entry.value), ..._glass, _tyre, _hub};

        final used =
            _fillRe.allMatches(svg).map((m) => m.group(1)!.toUpperCase());

        expect(used, isNotEmpty);
        // Yangi rang qo'shilsa u app_theme.dart tokeni bo'lishi kerak —
        // test uni shu yerda to'xtatadi.
        expect(used.toSet().difference(allowed), isEmpty,
            reason: '${entry.key}.svg palitradan tashqariga chiqdi');
      }
    });

    test('old oyna eng yorug\', orqasi eng to\'q — chuqurlik belgisi',
        () async {
      for (final name in _bodyColor.keys) {
        final svg = await loadSvg(name);

        // Soya ishlatilmagani uchun chuqurlikni faqat shu farq beradi.
        expect(svg, contains('fill="#CFEDE0"'),
            reason: '$name.svg: old oyna toni yo\'q');
        expect(svg, contains('fill="#6FE4B8"'),
            reason: '$name.svg: orqa/eng to\'q ton yo\'q');
      }
    });
  });

  group('Tarif mashinalari — toza SVG', () {
    test('inline style yo\'q — faqat fill/stroke atributlari', () async {
      for (final name in _bodyColor.keys) {
        final svg = await loadSvg(name);

        // `style="..."` va `<style>` bloklarini har bir SVG renderer
        // bir xil o'qimaydi; atributlar esa hamma joyda ishlaydi.
        expect(svg, isNot(contains('style="')), reason: '$name.svg');
        expect(svg, isNot(contains('<style')), reason: '$name.svg');
      }
    });
  });

  group('Tarif mashinalari — siluetlar farqi', () {
    test('to\'rt kuzov yo\'li bir-biriga o\'xshamaydi', () async {
      final silhouettes = <String, String>{};
      for (final name in _bodyColor.keys) {
        silhouettes[name] = _pathRe.firstMatch(await loadSvg(name))!.group(1)!;
      }

      // Tarif MATNSIZ, shakl orqali tanilishi kerak — bir xil siluet
      // rasmlarni bekorga aylantiradi.
      expect(silhouettes.values.toSet(), hasLength(_bodyColor.length));
    });

    test('furgon tomi sedanlarnikidan baland', () async {
      final van = await loadSvg('car_van');
      final econom = await loadSvg('car_econom');

      // Furgonda tom y=5, tejamkorda y=7.5: "yuk sig'adi" degani
      // raqam bilan emas, balandlik bilan aytiladi.
      expect(van, contains('L105 5'));
      expect(econom, contains('L47 7.5'));
    });
  });
}
