import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _key = 'catalog/0b6f3a52-6f2c-5e0e-9d1a-2f1c4b7a9e10.jpg';

void main() {
  group('catalogImageUrl', () {
    test("kalitni backend media yo'liga aylantiradi", () {
      expect(catalogImageUrl(_key), '${AppConfig.apiBaseUrl}/media/$_key');
    });

    test("kalit yo'q yoki bo'sh bo'lsa null", () {
      expect(catalogImageUrl(null), isNull);
      expect(catalogImageUrl(''), isNull);
    });
  });

  group('modellar imageKey ni o\'qiydi', () {
    test('Dish', () {
      final dish = Dish.fromJson({'id': 'd', 'name': 'Osh', 'price': 35000, 'imageKey': _key});
      expect(dish.imageUrl, endsWith(_key));
    });

    test('FoodRestaurant — eski javobda imageKey yo\'q', () {
      final r = FoodRestaurant.fromJson({'id': 'r', 'name': 'Osh Markazi'});
      expect(r.imageUrl, isNull);
    });

    test('MarketProduct', () {
      final p = MarketProduct.fromJson({'id': 'p', 'name': 'Non', 'price': 4000, 'stock': 3, 'imageKey': _key});
      expect(p.imageUrl, endsWith(_key));
    });
  });

  testWidgets("URL bo'lmasa faqat platsholder chiziladi", (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: CatalogImage(imageUrl: null, placeholder: Text('platsholder')),
      ),
    );
    expect(find.text('platsholder'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('URL bor: rasm yuklanguncha platsholder ostida turadi', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: SizedBox(
          width: 100,
          height: 100,
          child: CatalogImage(imageUrl: 'http://localhost/x.jpg', placeholder: Text('platsholder')),
        ),
      ),
    );
    expect(find.text('platsholder'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
  });
}
