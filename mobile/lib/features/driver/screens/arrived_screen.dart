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
        backgroundColor: Colors.white,
        foregroundColor: kTextPrimary,
        elevation: 0,
      ),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const SizedBox(height: 20),
                _buildArrivedBanner(),
                const SizedBox(height: 24),
                _buildWaitingTimer(),
                const SizedBox(height: 24),
                _buildOrderInfo(order),
                const Spacer(),
                _buildActionButtons(order, provider),
                const SizedBox(height: 16),
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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSuccess.withAlpha(20),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kSuccess.withAlpha(80)),
      ),
      child: const Column(
        children: [
          Icon(Icons.location_on, color: kSuccess, size: 48),
          SizedBox(height: 8),
          Text(
            'Olish joyida turibsiz!',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: kSuccess,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Yo\'lovchi kelishini kuting',
            style: TextStyle(color: kTextSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildWaitingTimer() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.timer_outlined, color: kTextSecondary, size: 20),
          const SizedBox(width: 8),
          Text(
            'Kutish vaqti: $_waitingTimeText',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderInfo(Order order) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Buyurtma ma\'lumotlari',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
          const SizedBox(height: 12),
          _buildInfoRow(Icons.radio_button_checked, Colors.green, 'Olish joyi',
              order.pickup.address),
          const SizedBox(height: 8),
          _buildInfoRow(
              Icons.location_on, kError, 'Manzil', order.dropoff.address),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Taxminiy narx:',
                  style: TextStyle(color: kTextSecondary)),
              Text(
                Formatters.formatPrice(order.estimatedPrice),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
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
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kTextSecondary,
                  fontSize: 11,
                ),
              ),
              Text(value, style: const TextStyle(fontSize: 13)),
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
          icon: const Icon(Icons.play_arrow, color: Colors.black),
        ),
        const SizedBox(height: 12),
        AppOutlinedButton(
          label: 'Yo\'lovchi kelmadi',
          onPressed: () => _showPassengerNotCameDialog(provider),
          textColor: kError,
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
            child: const Text('Ha', style: TextStyle(color: kError)),
          ),
        ],
      ),
    );
  }
}
