import 'package:angren_taxi/features/driver/external_navigation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('turn-by-turn navigators come before a plain map pin', () {
    final uris = navigationUris(41.02, 70.16, 'Angren bozori');
    expect(uris.map((u) => u.scheme), ['yandexnavi', 'google.navigation', 'geo']);
    expect(uris.first.queryParameters, {'lat_to': '41.02', 'lon_to': '70.16'});
    expect(uris[1].toString(), 'google.navigation:q=41.02,70.16&mode=d');
  });

  test('iOS gets Apple Maps driving directions', () {
    final uris = navigationUris(41.02, 70.16, 'x', ios: true);
    expect(uris.single.toString(), 'https://maps.apple.com/?daddr=41.02,70.16&dirflg=d');
  });

  test('falls through to the first navigator that is installed', () async {
    final opened = <String>[];
    final ok = await openExternalNavigation(
      41.02,
      70.16,
      'x',
      canLaunch: (uri) async => uri.scheme != 'yandexnavi',
      launch: (uri) async {
        opened.add(uri.scheme);
        return true;
      },
    );
    expect(ok, isTrue);
    expect(opened, ['google.navigation']);
  });

  test('reports failure when nothing can open it', () async {
    final ok = await openExternalNavigation(
      41.02,
      70.16,
      'x',
      canLaunch: (_) async => false,
      launch: (_) async => true,
    );
    expect(ok, isFalse);
  });
}
