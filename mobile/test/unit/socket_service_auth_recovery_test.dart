import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Minimal socket double: records handlers and lets the test fire events.
class _FakeSocket extends Fake implements io.Socket {
  _FakeSocket(this.options);

  final Map<dynamic, dynamic> options;
  final Map<String, List<dynamic Function(dynamic)>> handlers = {};
  bool connectCalled = false;
  bool disposed = false;

  @override
  bool connected = false;

  @override
  void on(String event, dynamic Function(dynamic) handler) =>
      handlers.putIfAbsent(event, () => []).add(handler);

  @override
  void off(String event, [dynamic Function(dynamic)? handler]) {
    if (handler == null) {
      handlers.remove(event);
    } else {
      handlers[event]?.remove(handler);
    }
  }

  @override
  io.Socket connect() {
    connectCalled = true;
    return this;
  }

  @override
  void dispose() => disposed = true;

  void fire(String event, [dynamic data]) {
    for (final h
        in handlers[event]?.toList() ?? const <dynamic Function(dynamic)>[]) {
      h(data);
    }
  }

  /// Runs the `auth` callback the way socket_io_client does on every
  /// (re)connect and returns the payload it produced.
  Map<dynamic, dynamic>? authPayload() {
    Map<dynamic, dynamic>? payload;
    final auth = options['auth'];
    if (auth is Function) {
      // ignore: avoid_dynamic_calls
      auth((dynamic data) => payload = data as Map<dynamic, dynamic>?);
    }
    return payload;
  }
}

void main() {
  late List<_FakeSocket> sockets;
  late String? storedToken;
  late int refreshCalls;
  late bool refreshResult;
  late DateTime now;
  late SocketService service;

  setUp(() {
    sockets = [];
    storedToken = 'old';
    refreshCalls = 0;
    refreshResult = true;
    now = DateTime(2026, 10, 27, 12);
    service = SocketService(
      socketFactory: (url, opts) {
        final s = _FakeSocket(opts);
        sockets.add(s);
        return s;
      },
      kickRetryDelay: (_) => Duration.zero,
      clock: () => now,
    )..configureAuth(
        readToken: () => storedToken,
        refreshTokens: () async {
          refreshCalls++;
          if (refreshResult) storedToken = 'fresh';
          return refreshResult;
        },
      );
  });

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  test('handlers registered before connect are attached on connect', () {
    final received = <dynamic>[];
    service.on('order:accepted', received.add);
    service.connect('old');

    sockets.single.fire('order:accepted', 1);
    expect(received, [1]);
  });

  test('the same handler registered twice is attached only once', () {
    final received = <dynamic>[];
    void handler(dynamic d) => received.add(d);
    service
      ..on('wallet:updated', handler)
      ..on('wallet:updated', handler)
      ..connect('old');

    sockets.single.fire('wallet:updated', 'x');
    expect(received, ['x']);
  });

  test('every (re)connect handshake reads the latest stored token', () {
    service.connect('old');
    expect(sockets.single.authPayload(), {'token': 'old'});

    storedToken = 'rotated-by-rest';
    expect(sockets.single.authPayload(), {'token': 'rotated-by-rest'});
  });

  test('server kick → refresh tokens → new socket with handlers kept',
      () async {
    final received = <dynamic>[];
    service.on('new_order_offer', received.add);
    service.connect('old');

    sockets.first.fire('disconnect', 'io server disconnect');
    await settle();

    expect(refreshCalls, 1);
    expect(sockets, hasLength(2));
    expect(sockets.last.connectCalled, isTrue);
    expect(sockets.last.authPayload(), {'token': 'fresh'});

    sockets.last.fire('new_order_offer', 'offer');
    expect(received, ['offer']);
  });

  test('transport drop does not rebuild the socket (library retries)',
      () async {
    service.connect('old');
    sockets.single.fire('disconnect', 'transport close');
    await settle();

    expect(refreshCalls, 0);
    expect(sockets, hasLength(1));
  });

  test('failed refresh stops recovery', () async {
    refreshResult = false;
    service.connect('old');
    sockets.single.fire('disconnect', 'io server disconnect');
    await settle();

    expect(refreshCalls, 1);
    expect(sockets, hasLength(1));
  });

  test('app-initiated disconnect is never "recovered"', () async {
    service.connect('old');
    final first = sockets.single;
    service.disconnect();
    first.fire('disconnect', 'io server disconnect');
    await settle();

    expect(refreshCalls, 0);
    expect(first.disposed, isTrue);
  });

  test('handshake rejected over and over → gives up instead of looping',
      () async {
    service.connect('old');
    for (var i = 0; i < 20; i++) {
      final s = sockets.last;
      s.fire('connect');
      s.fire('disconnect', 'io server disconnect');
      await settle();
    }
    expect(sockets.length, lessThanOrEqualTo(SocketService.maxKickRetries + 1));
  });

  test('a stable connection resets the kick budget', () async {
    service.connect('old');
    for (var i = 0; i < 20; i++) {
      final s = sockets.last;
      s.fire('connect');
      now = now.add(const Duration(minutes: 5));
      s.fire('disconnect', 'io server disconnect');
      await settle();
    }
    expect(sockets, hasLength(21));
  });

  test('reconnect listeners fire on reconnect, not on the first connect', () {
    var calls = 0;
    service.addReconnectListener(() => calls++);
    service.connect('old');
    sockets.single.fire('connect');
    expect(calls, 0);
    sockets.single.fire('connect');
    expect(calls, 1);
  });

  test("offline: sessiya bor, lekin ulanmagan — chiqishdan keyin emas", () {
    service.connect('old');
    final s = sockets.single;
    s.fire('connect');
    expect(service.offline.value, isFalse);

    s.fire('disconnect', 'transport close');
    expect(service.offline.value, isTrue);

    s.fire('connect');
    expect(service.offline.value, isFalse);

    s.fire('connect_error', 'timeout');
    expect(service.offline.value, isTrue);

    service.disconnect();
    expect(service.offline.value, isFalse);
  });
}
