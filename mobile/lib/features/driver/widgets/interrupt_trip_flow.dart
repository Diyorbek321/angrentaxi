import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/widgets/interrupt_trip_sheet.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// "Safar uzildi" oqimi (INCIDENT-POLICY §5): sabab varag'i → server shu
/// nuqtagacha narx bilan yakunlaydi → bosh ekran va undirilgan summa.
/// `trip_screen.dart` dan alohida — u allaqachon katta.
Future<void> interruptTripFlow(BuildContext context) async {
  final choice = await showInterruptTripSheet(context);
  if (choice == null || !context.mounted) return;
  final provider = context.read<DriverProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context);
  final l10n = context.l10n;
  final price = await provider.interruptTrip(reason: choice.reason, note: choice.note);
  if (price == null) {
    messenger.showSnackBar(SnackBar(content: Text(provider.error ?? l10n.drvInterruptFailed)));
    return;
  }
  navigator.pushNamedAndRemoveUntil('/driver/home', (route) => false);
  messenger.showSnackBar(SnackBar(content: Text(l10n.drvInterruptDone(Formatters.formatSom(price)))));
}
