import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ArrivedScreen extends StatefulWidget {
  const ArrivedScreen({super.key});

  @override
  State<ArrivedScreen> createState() => _ArrivedScreenState();
}

class _ArrivedScreenState extends State<ArrivedScreen> {
  int _waitingSeconds = 0;
  Timer? _waitTimer;

  @override
  void initState() {
    super.initState();
    _startWaitTimer();
  }

  @override
  void dispose() {
    _waitTimer?.cancel();
    super.dispose();
  }

  void _startWaitTimer() {
    _waitTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (mounted) setState(() => _waitingSeconds++);
    });
  }

  String get _waitingTimeText {
    final mins = _waitingSeconds ~/ 60;
    final secs = _waitingSeconds % 60;
    if (mins == 0) return '$secs soniya';
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _onStartTrip() async {
    final provider = context.read<DriverProvider>();
    await provider.startTrip();
    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      Navigator.of(context).pushReplacementNamed('/driver/trip');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yetib keldim'),
        backgroundColor: kSurface,
        foregroundColor: kInk,
        elevation: 0,
      ),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return Padding(
            padding: const EdgeInsets.all(kSpace4),
            child: Column(
              children: [
                const SizedBox(height: kSpace5),
                _buildArrivedBanner(),
                const SizedBox(height: kSpace6),
                _buildWaitingTimer(),
                const SizedBox(height: kSpace6),
                _buildOrderInfo(order),
                const Spacer(),
                _buildActionButtons(order, provider),
                const SizedBox(height: kSpace4),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildArrivedBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        color: kMintTint,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
      ),
      child: const Column(
        children: [
          // Mint tint ustidagi matn/ikona — kPrimary (mint o'zi 2.12:1).
          ExcludeSemantics(
            child: Icon(Icons.location_on, color: kPrimary, size: 48),
          ),
          SizedBox(height: kSpace2),
          Text(
            'Olish joyida turibsiz!',
            style: TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kPrimary,
            ),
          ),
          SizedBox(height: kSpace1),
          Text(
            'Yo\'lovchi kelishini kuting',
            style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
          ),
        ],
      ),
    );
  }

  Widget _buildWaitingTimer() {
    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.timer_outlined, color: kInkMuted, size: 20),
          ),
          const SizedBox(width: kSpace2),
          Text(
            'Kutish vaqti: $_waitingTimeText',
            style: const TextStyle(
              fontSize: kFontBodyLg,
              fontWeight: FontWeight.w600,
              color: kInk,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderInfo(Order order) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        border: Border.all(color: kLine),
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Buyurtma ma\'lumotlari',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: kFontBodyLg,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace3),
          _buildInfoRow(Icons.radio_button_checked, kPrimary, 'Olish joyi',
              order.pickup.address),
          const SizedBox(height: kSpace2),
          _buildInfoRow(
              Icons.location_on, kError, 'Manzil', order.dropoff.address),
          const Divider(height: kSpace5),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Taxminiy narx:',
                  style: TextStyle(color: kInkMuted, fontSize: kFontBody)),
              Text(
                Formatters.formatPrice(order.estimatedPrice),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontTitle,
                  color: kInk,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    IconData icon,
    Color color,
    String label,
    String value,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, color: color, size: 18)),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontMicro,
                ),
              ),
              Text(
                value,
                style: const TextStyle(fontSize: kFontLabel, color: kInk),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons(Order order, DriverProvider provider) {
    return Column(
      children: [
        AppButton(
          label: 'Safarni boshlash',
          onPressed: _onStartTrip,
          isLoading: provider.state == DriverProviderState.loading,
          icon: const Icon(Icons.play_arrow, color: kOnPrimary),
        ),
        const SizedBox(height: kSpace3),
        AppOutlinedButton(
          label: 'Yo\'lovchi kelmadi',
          onPressed: () => _showPassengerNotCameDialog(provider),
          // Xavf MATNI kErrorDeep (6.47:1); kError faqat chegara uchun.
          textColor: kErrorDeep,
          borderColor: kError,
        ),
      ],
    );
  }

  void _showPassengerNotCameDialog(DriverProvider provider) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Yo\'lovchi kelmadi'),
        content: Text(
          '$_waitingTimeText kutdingiz. Buyurtmani bekor qilmoqchimisiz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Yo'q"),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await provider.cancelOrder(reason: 'passenger_no_show');
              if (!mounted) return;
              if (provider.state == DriverProviderState.success) {
                Navigator.of(context).pushNamedAndRemoveUntil(
                  '/driver/home',
                  (route) => false,
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text(provider.error ?? 'Bekor qilib bo\'lmadi')),
                );
              }
            },
            child: const Text('Ha', style: TextStyle(color: kErrorDeep)),
          ),
        ],
      ),
    );
  }
}
