import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/features/superapp/screens/order_status_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Order-level payment choice. 'cash' is settled with the courier on
/// delivery; 'card' opens the real Payme/Click/Uzcard checkout via
/// [PaymentService]/[PaymentWebViewScreen] once the order is placed.
enum CheckoutPaymentMethod { cash, card }

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    this.paymentService,
    this.locationService,
    this.openPaymentCheckout,
  });

  /// Injectable for tests — defaults to a [PaymentService] built from the
  /// real [ApiClient] in the service locator.
  final PaymentService? paymentService;

  /// Injectable for tests — defaults to the service-locator [LocationService].
  final LocationService? locationService;

  /// Injectable for tests — defaults to pushing [PaymentWebViewScreen].
  final OpenPaymentCheckout? openPaymentCheckout;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _address = "Navoiy ko'chasi, 12";
  CheckoutPaymentMethod _paymentMethod = CheckoutPaymentMethod.cash;
  bool _submitting = false;

  PaymentService get _paymentService =>
      widget.paymentService ?? PaymentService(apiClient: sl<ApiClient>());
  LocationService get _locationService =>
      widget.locationService ?? sl<LocationService>();
  OpenPaymentCheckout get _openPaymentCheckout =>
      widget.openPaymentCheckout ?? _defaultOpenPaymentCheckout;

  Future<bool?> _defaultOpenPaymentCheckout(
    BuildContext context,
    PaymentInitiateResult result,
  ) {
    return Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => PaymentWebViewScreen(result: result),
      ),
    );
  }

  Future<void> _choosePaymentMethod() async {
    final choice = await showModalBottomSheet<CheckoutPaymentMethod>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  "To'lov usulini tanlang",
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
            ),
            RadioListTile<CheckoutPaymentMethod>(
              value: CheckoutPaymentMethod.cash,
              groupValue: _paymentMethod,
              title: const Text('Naqd pul'),
              secondary: const Icon(Icons.payments_rounded),
              onChanged: (v) => Navigator.pop(sheetContext, v),
            ),
            RadioListTile<CheckoutPaymentMethod>(
              value: CheckoutPaymentMethod.card,
              groupValue: _paymentMethod,
              title: const Text('Karta (Payme / Click)'),
              secondary: const Icon(Icons.credit_card_rounded),
              onChanged: (v) => Navigator.pop(sheetContext, v),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (choice != null && mounted) {
      setState(() => _paymentMethod = choice);
    }
  }

  Future<void> _editAddress() async {
    final controller = TextEditingController(text: _address);
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Yetkazib berish manzili'),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Bekor qilish')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Saqlash'),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty) {
      setState(() => _address = result);
    }
  }

  Future<void> _submit() async {
    final superapp = context.read<SuperappProvider>();
    final kind = superapp.activeKind;
    // Resolved before the first `await` below: `context.read` after an async
    // gap can throw if the passenger navigated away while we waited for GPS.
    final foodProvider = kind == 'food' ? context.read<FoodProvider>() : null;
    final marketProvider = kind == 'food' ? null : context.read<MarketProvider>();

    setState(() => _submitting = true);

    // A courier needs real coordinates to be dispatched to — the typed
    // address above is just a label shown to the vendor/courier.
    final position = await _locationService.getCurrentPosition();
    if (position == null) {
      setState(() => _submitting = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Joylashuvga ruxsat bering — kuryer yuborish uchun kerak")),
      );
      return;
    }

    Object? order;
    String? error;
    if (kind == 'food') {
      final food = foodProvider!;
      order = await food.createOrder(
        items: superapp.cart,
        deliveryAddress: _address,
        deliveryLat: position.latitude,
        deliveryLng: position.longitude,
      );
      error = food.error;
    } else {
      final market = marketProvider!;
      order = await market.createOrder(
        items: superapp.cart,
        deliveryAddress: _address,
        deliveryLat: position.latitude,
        deliveryLng: position.longitude,
      );
      error = market.error;
    }

    if (!mounted) return;

    if (order == null) {
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error ?? 'Buyurtma yuborilmadi')),
      );
      return;
    }

    // Order placed. If the passenger chose card, try to open the real
    // provider checkout for it. This calls the live backend endpoint — see
    // the doc comment on [PaymentService] for the current order-type/status
    // constraint that backend enforces (market/food order ids aren't
    // accepted there yet). A failure here does not roll back the order: the
    // order already exists server-side, so we surface the error and let the
    // passenger retry payment or fall back to cash on delivery, instead of
    // silently losing their placed order.
    if (_paymentMethod == CheckoutPaymentMethod.card) {
      final orderId = kind == 'food'
          ? (order as FoodOrder).id
          : (order as MarketOrder).id;
      try {
        final result = await _paymentService.initiate(orderId: orderId);
        if (!mounted) return;
        final completed = await _openPaymentCheckout(context, result);
        if (!mounted) return;
        if (completed != true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                "To'lov yakunlanmadi — buyurtma qabul qilindi, to'lovni keyinroq amalga oshirishingiz mumkin",
              ),
            ),
          );
        }
      } on PaymentException catch (e) {
        setState(() => _submitting = false);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("To'lovni boshlab bo'lmadi: ${e.message}")),
        );
        return;
      }
    }

    setState(() => _submitting = false);
    if (!mounted) return;

    superapp.clearCart();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const OrderStatusScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Rasmiylashtirish', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _OptionCard(
                  iconBg: agTint,
                  iconColor: agGreen,
                  icon: Icons.location_on_rounded,
                  title: 'Yetkazib berish manzili',
                  subtitle: _address,
                  onTap: _editAddress,
                ),
                const SizedBox(height: 14),
                _OptionCard(
                  iconBg: const Color(0xFFEFF6FF),
                  iconColor: agBlue,
                  icon: _paymentMethod == CheckoutPaymentMethod.card
                      ? Icons.credit_card_rounded
                      : Icons.payments_rounded,
                  title: "To'lov usuli",
                  subtitle: _paymentMethod == CheckoutPaymentMethod.card
                      ? 'Karta (Payme / Click)'
                      : 'Naqd pul',
                  onTap: _submitting ? null : _choosePaymentMethod,
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _row('Mahsulotlar', Formatters.formatSom(provider.cartSubtotal)),
                      const SizedBox(height: 10),
                      _row('Yetkazib berish', Formatters.formatSom(provider.deliveryFee)),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFDCE2E6), height: 1),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Jami', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                          Text(Formatters.formatSom(provider.cartTotal),
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).padding.bottom + 18),
            child: AgPrimaryButton(
              label: _submitting ? 'Yuborilmoqda...' : 'Buyurtmani tasdiqlash',
              onPressed: (_submitting || provider.isCartEmpty) ? null : _submit,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _row(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: 13.5, color: agText, fontWeight: FontWeight.w700)),
        ],
      );
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.iconBg,
    required this.iconColor,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final Color iconBg;
  final Color iconColor;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: agCardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(13)),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            if (onTap != null) const Icon(Icons.chevron_right_rounded, color: agMuted, size: 20),
          ],
        ),
      ),
    );
  }
}
