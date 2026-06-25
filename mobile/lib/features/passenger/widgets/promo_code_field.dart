import 'package:flutter/material.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';

class PromoCodeField extends StatefulWidget {
  const PromoCodeField({
    super.key,
    required this.onApplied,
    required this.orderAmount,
  });

  /// Called when a promo code is successfully validated.
  /// [promoCodeId] is the server-returned promo identifier.
  /// [discountAmount] is the discount value in the order's currency.
  final void Function(String promoCodeId, double discountAmount) onApplied;
  final double orderAmount;

  @override
  State<PromoCodeField> createState() => _PromoCodeFieldState();
}

class _PromoCodeFieldState extends State<PromoCodeField>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  bool _isLoading = false;
  bool _applied = false;
  String? _errorMessage;
  String? _successMessage;

  final TextEditingController _codeController = TextEditingController();
  late final AnimationController _expandController;
  late final Animation<double> _expandAnimation;

  @override
  void initState() {
    super.initState();
    _expandController = AnimationController(
      duration: const Duration(milliseconds: 220),
      vsync: this,
    );
    _expandAnimation = CurvedAnimation(
      parent: _expandController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _codeController.dispose();
    _expandController.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _expandController.forward();
    } else {
      _expandController.reverse();
    }
  }

  Future<void> _apply() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _errorMessage = "Promo kodni kiriting");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final apiClient = sl<ApiClient>();
      final response = await apiClient.post(
        ApiEndpoints.validatePromo,
        data: {'code': code, 'orderAmount': widget.orderAmount},
      );

      final data = response.data as Map<String, dynamic>;
      final payload = data['data'] as Map<String, dynamic>;
      final promoCodeId = payload['id'] as String;
      final discountAmount = (payload['discountAmount'] as num).toDouble();
      final discountPercent = (payload['discountPercent'] as num?)?.toInt();

      final label =
          discountPercent != null
              ? '$discountPercent% chegirma qo\'llandi'
              : '${discountAmount.toStringAsFixed(0)} so\'m chegirma qo\'llandi';

      setState(() {
        _applied = true;
        _successMessage = label;
        _isLoading = false;
      });

      widget.onApplied(promoCodeId, discountAmount);
    } catch (e) {
      setState(() {
        _errorMessage = extractErrorMessage(e);
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Collapsed toggle link
        if (!_expanded || _applied)
          GestureDetector(
            onTap: _applied ? null : _toggle,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _applied
                        ? Icons.check_circle_outline
                        : Icons.local_offer_outlined,
                    size: 18,
                    color: _applied ? kSuccess : kPrimaryYellow,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _applied
                        ? (_successMessage ?? 'Chegirma qo\'llandi')
                        : 'Promo kod bormi?',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: _applied ? kSuccess : kSecondaryBlack,
                      decoration:
                          _applied ? TextDecoration.none : TextDecoration.underline,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Expanded input area
        if (!_applied)
          SizeTransition(
            sizeFactor: _expandAnimation,
            axisAlignment: -1,
            child: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          textCapitalization: TextCapitalization.characters,
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: kSurfaceGrey,
                            hintText: 'Promo kodni kiriting',
                            hintStyle: const TextStyle(
                              color: kTextSecondary,
                              fontSize: 14,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: kPrimaryYellow,
                                width: 2,
                              ),
                            ),
                            errorBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: kError),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                          ),
                          onSubmitted: (_) => _apply(),
                        ),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _apply,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kSecondaryBlack,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: Colors.grey.shade300,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 18),
                          ),
                          child:
                              _isLoading
                                  ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                  : const Text(
                                    "Qo'llash",
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                        ),
                      ),
                    ],
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.error_outline, color: kError, size: 14),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: kError,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  // Collapse link
                  TextButton(
                    onPressed: _toggle,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Yopish',
                      style: TextStyle(color: kTextSecondary, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
