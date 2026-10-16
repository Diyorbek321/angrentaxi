import 'dart:async';
import 'dart:convert';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/push/push_notifications.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/screens/map_picker_screen.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/features/superapp/screens/order_status_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/promo_code_controller.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/checkout_extras.dart';
import 'package:angren_taxi/features/superapp/widgets/saved_address_bar.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  /// Delivery point. Null until the passenger picks one — there is no
  /// prefilled fake address any more ("Navoiy ko'chasi, 12" used to be shown
  /// to every user as though it were theirs).
  OrderLocation? _destination;
  CheckoutPaymentMethod _paymentMethod = CheckoutPaymentMethod.cash;

  /// Haqiqatda ishlatiladigan usul: savat naqd chegarasidan oshsa — karta,
  /// tanlovdan qat'i nazar (`SuperappProvider.cashAllowed`).
  CheckoutPaymentMethod get _effectiveMethod =>
      context.read<SuperappProvider>().cashAllowed
          ? _paymentMethod
          : CheckoutPaymentMethod.card;
  bool _submitting = false;

  bool _resolvingAddress = true;

  /// Promokod (spec v5 §2) — `food` yoki `market` xizmat turi bilan.
  late final PromoCodeController _promo;

  /// Podyezd/qavat/... (spec v5 §3).
  final AddressDetailsController _details = AddressDetailsController();
  bool _detailsPrefilled = false;

  static const String _savedDetailsKey = 'checkout.addressDetails';

  String get _addressLabel =>
      _destination?.address ??
      (_resolvingAddress
          ? context.l10n.saAddressResolving
          : context.l10n.saChooseAddress);

  @override
  void initState() {
    super.initState();
    // Prefill from the device's own position so the common case needs no
    // interaction, and so the label and the coordinates start out describing
    // the same place. Tapping the row opens the map picker to change it.
    _prefillFromCurrentPosition();
    final superapp = context.read<SuperappProvider>();
    _promo = PromoCodeController(
      apiClient: superapp.apiClient,
      serviceType: superapp.activeKind == 'food' ? 'food' : 'market',
    );
    unawaited(_prefillAddressDetails());
    // Kadrdan keyin: `loadFavorites` darhol `notifyListeners` qiladi —
    // build/initState ichida chaqirilsa provayder daraxti yiqiladi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final favorites = context.read<FavoritesProvider>();
      if (favorites.state == FavoritesProviderState.idle) {
        unawaited(favorites.loadFavorites());
      }
    });
  }

  bool _savingAddress = false;

  /// Saqlangan manzil tanlandi: nuqta va uning tafsilotlari. Tafsiloti
  /// yo'q manzilda forma tozalanadi — boshqa uyning podyezdi qolib ketmasin.
  void _selectFavorite(FavoriteAddress favorite) {
    setState(() {
      _destination = OrderLocation(
        address: favorite.address,
        lat: favorite.lat,
        lng: favorite.lng,
      );
      _resolvingAddress = false;
      _details.fill(favorite.addressDetails ?? const AddressDetails());
      _detailsPrefilled = favorite.addressDetails != null;
    });
  }

  /// Joriy nuqtani (podyezd/qavati bilan) saqlangan manzillarga qo'shadi.
  Future<void> _saveCurrentAddress() async {
    final destination = _destination;
    if (destination == null || _savingAddress) return;
    final favorites = context.read<FavoritesProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    final label = await askAddressLabel(context);
    if (label == null || !mounted) return;
    setState(() => _savingAddress = true);
    final ok = await favorites.addFavorite(
      label: label,
      address: destination.address,
      lat: destination.lat,
      lng: destination.lng,
      addressDetails: _details.value,
    );
    if (!mounted) return;
    setState(() => _savingAddress = false);
    messenger.showSnackBar(SnackBar(
      content: Text(ok
          ? l10n.saAddressSaved
          : l10n.saAddressSaveFailed(favorites.error ?? l10n.saErrorOccurred)),
    ));
  }

  @override
  void dispose() {
    _promo.dispose();
    _details.dispose();
    super.dispose();
  }

  /// Oxirgi buyurtmadagi (server) yoki shu qurilmada oxirgi kiritilgan
  /// tafsilotlar bilan to'ldiradi — har safar podyezd/qavatni qayta
  /// yozish shart emas.
  Future<void> _prefillAddressDetails() async {
    final fromOrders = context.read<FoodProvider>().lastAddressDetails ??
        context.read<MarketProvider>().lastAddressDetails;
    var details = fromOrders;
    if (details == null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final raw = prefs.getString(_savedDetailsKey);
        if (raw != null) details = AddressDetails.tryParse(jsonDecode(raw));
      } catch (e) {
        debugPrint('[Checkout] saved address details unreadable: $e');
      }
    }
    if (!mounted || details == null || !_details.isBlank) return;
    setState(() {
      _details.fill(details!);
      _detailsPrefilled = true;
    });
  }

  Future<void> _rememberAddressDetails(AddressDetails details) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (details.isEmpty) {
        await prefs.remove(_savedDetailsKey);
      } else {
        await prefs.setString(_savedDetailsKey, jsonEncode(details.toJson()));
      }
    } catch (e) {
      debugPrint('[Checkout] could not remember address details: $e');
    }
  }

  Future<void> _prefillFromCurrentPosition() async {
    final position = await _locationService.getCurrentPosition();
    if (!mounted) return;

    if (position == null) {
      setState(() => _resolvingAddress = false);
      return;
    }

    String address = context.l10n.saCurrentLocation;
    try {
      final placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        final parts = [p.street, p.subLocality, p.locality]
            .where((e) => e != null && e.isNotEmpty)
            .join(', ');
        if (parts.isNotEmpty) address = parts;
      }
    } catch (_) {
      // Geocoding is best-effort; the coordinates are what the courier needs
      // and they are already correct.
    }

    if (!mounted) return;
    setState(() {
      _destination = OrderLocation(
        address: address,
        lat: position.latitude,
        lng: position.longitude,
      );
      _resolvingAddress = false;
    });
  }

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

  /// Naqd ruxsat etilmasa — sababi ("200 000 so'mgacha"), aks holda `null`.
  String? get cashLimitNote {
    final superapp = context.read<SuperappProvider>();
    final limit = superapp.maxCashVendorOrder;
    if (superapp.cashAllowed || limit == null) return null;
    return context.l10n.saCashLimitNote(Formatters.formatSom(limit));
  }

  Future<void> _choosePaymentMethod() async {
    final note = cashLimitNote;
    final choice = await showModalBottomSheet<CheckoutPaymentMethod>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(kSpace5, kSpace4, kSpace5, kSpace2),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  context.l10n.saChoosePaymentMethod,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: kFontTitle,
                    color: agText,
                  ),
                ),
              ),
            ),
            RadioListTile<CheckoutPaymentMethod>(
              value: CheckoutPaymentMethod.cash,
              groupValue: _effectiveMethod,
              title: Text(context.l10n.saPaymentCash),
              subtitle: note == null ? null : Text(note),
              secondary: const Icon(Icons.payments_rounded),
              // Chegaradan oshgan savatda naqd — o'chiq.
              onChanged: note == null
                  ? (v) => Navigator.pop(sheetContext, v)
                  : null,
            ),
            RadioListTile<CheckoutPaymentMethod>(
              value: CheckoutPaymentMethod.card,
              groupValue: _effectiveMethod,
              title: Text(context.l10n.saPaymentCard),
              secondary: const Icon(Icons.credit_card_rounded),
              onChanged: (v) => Navigator.pop(sheetContext, v),
            ),
            const SizedBox(height: kSpace2),
          ],
        ),
      ),
    );
    if (choice != null && mounted) {
      setState(() => _paymentMethod = choice);
    }
  }

  /// Picks the delivery point on the map.
  ///
  /// This used to be a plain text dialog while the coordinates sent to the
  /// courier came from `getCurrentPosition()`. Editing the address therefore
  /// changed only the label the vendor saw — the courier was still routed to
  /// wherever the phone happened to be, with no warning that the two
  /// disagreed. Picking on the map keeps the address and its coordinates in
  /// sync by construction.
  Future<void> _editAddress() async {
    final current = await _locationService.getCurrentPosition();
    if (!mounted) return;

    final picked = await Navigator.of(context).push<OrderLocation>(
      MaterialPageRoute<OrderLocation>(
        builder: (_) => MapPickerScreen(
          title: context.l10n.saDeliveryAddress,
          initialLocation: _destination != null
              ? LatLng(_destination!.lat, _destination!.lng)
              : (current != null
                    ? LatLng(current.latitude, current.longitude)
                    : null),
        ),
      ),
    );

    if (picked != null && mounted) {
      setState(() => _destination = picked);
    }
  }

  Future<void> _submit() async {
    final superapp = context.read<SuperappProvider>();
    final kind = superapp.activeKind;
    // Resolved before the first `await` below: `context.read` after an async
    // gap can throw if the passenger navigated away while we waited for GPS.
    final foodProvider = kind == 'food' ? context.read<FoodProvider>() : null;
    final marketProvider = kind == 'food' ? null : context.read<MarketProvider>();

    final destination = _destination;
    if (destination == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.saChooseDeliveryAddress),
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    // Savat o'zgargan bo'lsa (orqaga qaytib qo'shilgan), promokod yangi
    // summaga qayta tekshiriladi — eski chegirma ko'rsatilib qolmasin.
    if (_promo.needsRevalidation(superapp.cartSubtotal)) {
      await _promo.apply(_promo.appliedCode!, amount: superapp.cartSubtotal);
      if (!mounted) return;
    }
    final promoCode = _promo.appliedCode;
    final details = _details.value;

    Object? order;
    String? error;
    if (kind == 'food') {
      final food = foodProvider!;
      order = await food.createOrder(
        items: superapp.cart,
        deliveryAddress: destination.address,
        deliveryLat: destination.lat,
        deliveryLng: destination.lng,
        paymentMethod: _effectiveMethod.name,
        promoCode: promoCode,
        addressDetails: details,
      );
      error = food.error;
    } else {
      final market = marketProvider!;
      order = await market.createOrder(
        items: superapp.cart,
        deliveryAddress: destination.address,
        deliveryLat: destination.lat,
        deliveryLng: destination.lng,
        paymentMethod: _effectiveMethod.name,
        promoCode: promoCode,
        addressDetails: details,
      );
      error = market.error;
    }

    if (!mounted) return;

    if (order == null) {
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error ?? context.l10n.saOrderNotSent)),
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
    unawaited(_rememberAddressDetails(details));
    // Buyurtma holati push bilan keladi — Android 13+ da ruxsat shu
    // lahzada so'raladi (ilgari faqat taksi buyurtmasida so'ralardi).
    unawaited(PushNotifications.instance.ensurePermission());

    final placedOrderId = kind == 'food'
        ? (order as FoodOrder).id
        : (order as MarketOrder).id;
    var paidOnline = false;

    if (_effectiveMethod == CheckoutPaymentMethod.card) {
      final orderId = placedOrderId;
      try {
        final result = await _paymentService.initiate(orderId: orderId);
        if (!mounted) return;
        final completed = await _openPaymentCheckout(context, result);
        if (!mounted) return;
        paidOnline = completed == true;
        if (completed != true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                context.l10n.saPaymentNotCompleted,
              ),
            ),
          );
        }
      } on PaymentException catch (e) {
        setState(() => _submitting = false);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.saPaymentStartFailed(e.message))),
        );
        return;
      }
    }

    setState(() => _submitting = false);
    if (!mounted) return;

    superapp.clearCart();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => OrderStatusScreen(
          orderId: placedOrderId,
          paidOnline: paidOnline,
          kind: kind == 'food' ? 'food' : 'market',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: context.l10n.saCheckoutTitle, onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                _OptionCard(
                  iconBg: agTint,
                  iconColor: agGreenText,
                  icon: Icons.location_on_rounded,
                  title: context.l10n.saDeliveryAddress,
                  subtitle: _addressLabel,
                  onTap: _editAddress,
                ),
                Builder(builder: (context) {
                  final favorites = context.watch<FavoritesProvider>().favorites;
                  final isSaved = favorites.any((f) => SavedAddressBar.sameSpot(f, _destination));
                  final canSave = _destination != null && !isSaved && !_savingAddress;
                  if (favorites.isEmpty && !canSave) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: kSpace3),
                    child: SavedAddressBar(
                      favorites: favorites,
                      selected: _destination,
                      onSelect: _selectFavorite,
                      onSave: canSave ? _saveCurrentAddress : null,
                      enabled: !_submitting,
                    ),
                  );
                }),
                const SizedBox(height: kSpace4),
                _OptionCard(
                  iconBg: kInfoLight,
                  iconColor: kInfoDeep,
                  icon: _effectiveMethod == CheckoutPaymentMethod.card
                      ? Icons.credit_card_rounded
                      : Icons.payments_rounded,
                  title: context.l10n.saPaymentMethod,
                  subtitle: _effectiveMethod == CheckoutPaymentMethod.card
                      ? context.l10n.saPaymentCard
                      : context.l10n.saPaymentCash,
                  onTap: _submitting ? null : _choosePaymentMethod,
                ),
                if (cashLimitNote case final note?) ...[
                  const SizedBox(height: kSpace2),
                  Text(
                    note,
                    style: const TextStyle(fontSize: kFontLabel, color: agSubtle),
                  ),
                ],
                const SizedBox(height: kSpace4),
                AddressDetailsForm(
                  controller: _details,
                  prefilled: _detailsPrefilled,
                  enabled: !_submitting,
                ),
                const SizedBox(height: kSpace4),
                PromoCodeField(
                  controller: _promo,
                  amount: provider.cartSubtotal,
                  enabled: !_submitting,
                ),
                const SizedBox(height: kSpace4),
                Container(
                  padding: const EdgeInsets.all(kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _row(context.l10n.saMarketProducts, Formatters.formatSom(provider.cartSubtotal)),
                      const SizedBox(height: kSpace3),
                      _row(
                          context.l10n.saDelivery,
                          provider.isFreeDelivery
                              ? context.l10n.saDeliveryFree
                              : Formatters.formatSom(provider.deliveryFee)),
                      ListenableBuilder(
                        listenable: _promo,
                        builder: (context, _) => _promo.discount > 0
                            ? Padding(
                                padding: const EdgeInsets.only(top: kSpace3),
                                child: _row(
                                  context.l10n.saPromoDiscount,
                                  '−${Formatters.formatSom(_promo.discount)}',
                                  valueColor: agGreenText,
                                  key: const ValueKey('promo-discount-line'),
                                ),
                              )
                            : const SizedBox.shrink(),
                      ),
                      const SizedBox(height: kSpace3),
                      const Divider(color: agBorder, height: 1),
                      const SizedBox(height: kSpace3),
                      ListenableBuilder(
                        listenable: _promo,
                        builder: (context, _) => Row(
                          children: [
                            Expanded(
                              child: Text(context.l10n.saTotal,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                            ),
                            Text(
                                Formatters.formatSom(
                                    (provider.cartTotal - _promo.discount).clamp(0, double.infinity)),
                                key: const ValueKey('checkout-total'),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
                kSpace4, 0, kSpace4, MediaQuery.of(context).padding.bottom + kSpace4),
            child: AgPrimaryButton(
              label: _submitting ? context.l10n.saSubmitting : context.l10n.saConfirmOrder,
              onPressed: (_submitting || provider.isCartEmpty) ? null : _submit,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _row(String label, String value, {Color valueColor = agText, Key? key}) => Row(
        key: key,
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: kFontLabel, color: agSubtle, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: kSpace2),
          Text(value,
              style: TextStyle(
                  fontSize: kFontLabel, color: valueColor, fontWeight: FontWeight.w700)),
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
    return Semantics(
      button: onTap != null,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.all(kSpace4),
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agCardShadow,
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(icon, color: iconColor, size: 24),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              if (onTap != null)
                const ExcludeSemantics(
                  child: Icon(Icons.chevron_right_rounded, color: agMuted, size: 20),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
