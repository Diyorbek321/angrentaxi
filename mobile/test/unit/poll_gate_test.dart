import 'package:angren_taxi/core/network/poll_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('socket uzilgan — har takt so\'raydi', () {
    final gate = PollGate(isConnected: () => false, isForeground: () => true);
    expect([for (var i = 0; i < 3; i++) gate.shouldPoll()], [true, true, true]);
  });

  test('socket ulangan — har 3-taktda bir marta', () {
    final gate = PollGate(isConnected: () => true, isForeground: () => true);
    expect(
      [for (var i = 0; i < 6; i++) gate.shouldPoll()],
      [false, false, true, false, false, true],
    );
  });

  test('fonda so\'ramaydi, qaytgach birinchi takt darhol so\'raydi', () {
    var foreground = false;
    final gate = PollGate(isConnected: () => true, isForeground: () => foreground);

    expect(gate.shouldPoll(), isFalse);
    expect(gate.shouldPoll(), isFalse);

    foreground = true;
    expect(gate.shouldPoll(), isTrue);
    expect(gate.shouldPoll(), isFalse);
  });

  test('socket uzilishi ulangan sanog\'ini noldan boshlaydi', () {
    var connected = true;
    final gate = PollGate(isConnected: () => connected, isForeground: () => true);

    expect(gate.shouldPoll(), isFalse);
    expect(gate.shouldPoll(), isFalse);
    connected = false;
    expect(gate.shouldPoll(), isTrue);
    connected = true;
    expect(gate.shouldPoll(), isFalse);
  });
}
