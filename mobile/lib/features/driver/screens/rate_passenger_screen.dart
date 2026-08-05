import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

class RatePassengerScreen extends StatefulWidget {
  const RatePassengerScreen({
    super.key,
    required this.orderId,
    required this.passengerPhone,
  });

  final String orderId;
  final String passengerPhone;

  @override
  State<RatePassengerScreen> createState() => _RatePassengerScreenState();
}

class _RatePassengerScreenState extends State<RatePassengerScreen>
    with TickerProviderStateMixin {
  int _selectedScore = 0;
  final TextEditingController _commentController = TextEditingController();
  bool _isLoading = false;
  final List<AnimationController> _starControllers = [];
  final List<Animation<double>> _starScales = [];

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < 5; i++) {
      final controller = AnimationController(
        duration: const Duration(milliseconds: 150),
        vsync: this,
      );
      final scale = Tween<double>(begin: 1.0, end: 1.3).animate(
        CurvedAnimation(parent: controller, curve: Curves.easeOutBack),
      );
      _starControllers.add(controller);
      _starScales.add(scale);
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    for (final c in _starControllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _onStarTapped(int index) {
    final newScore = index + 1;
    setState(() => _selectedScore = newScore);

    for (int i = 0; i < 5; i++) {
      if (i <= index) {
        _starControllers[i].forward().then((_) => _starControllers[i].reverse());
      }
    }
  }

  Future<void> _submit() async {
    if (_selectedScore == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Iltimos, baho bering')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final apiClient = sl<ApiClient>();
      await apiClient.post(
        ApiEndpoints.submitRating,
        data: {
          'orderId': widget.orderId,
          'score': _selectedScore,
          if (_commentController.text.trim().isNotEmpty)
            'comment': _commentController.text.trim(),
        },
      );
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show the first digit of the phone number as the avatar letter.
    final avatarLetter =
        widget.passengerPhone.isNotEmpty
            ? widget.passengerPhone[0]
            : '?';

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace8, kSpace4, kSpace6),
          child: Column(
            children: [
              // Avatar
              Container(
                width: 80,
                height: 80,
                decoration: const BoxDecoration(
                  color: kSurface2,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  avatarLetter.toUpperCase(),
                  style: const TextStyle(
                    fontSize: kFontDisplay,
                    fontWeight: FontWeight.w800,
                    color: kInkMuted,
                  ),
                ),
              ),
              const SizedBox(height: kSpace4),
              Text(
                widget.passengerPhone,
                style: const TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace1 + 2),
              const Text(
                'Yo\'lovchi qanday edi?',
                style: TextStyle(fontSize: kFontBodyLg, color: kInkMuted),
              ),
              const SizedBox(height: kSpace8),

              // Star selector
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final filled = i < _selectedScore;
                  return Semantics(
                    button: true,
                    selected: filled,
                    label: '${i + 1} yulduz',
                    excludeSemantics: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _onStarTapped(i),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minHeight: kMinTapTarget,
                          minWidth: kMinTapTarget,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: kSpace1 + 2,
                            vertical: kSpace1,
                          ),
                          child: ScaleTransition(
                            scale: _starScales[i],
                            child: Icon(
                              filled
                                  ? Icons.star_rounded
                                  : Icons.star_outline_rounded,
                              // Yorug' fonda ma'noli yashil = kPrimary.
                              color: filled ? kPrimary : kInkSubtle,
                              size: 40,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: kSpace2),
              Text(
                _ratingLabel(_selectedScore),
                style: const TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w600,
                  color: kInkMuted,
                ),
              ),
              const SizedBox(height: kSpace8),

              // Comment field
              TextField(
                controller: _commentController,
                maxLength: 500,
                maxLines: 3,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: kSurface2,
                  hintText: "Yo'lovchi haqida izoh...",
                  hintStyle: const TextStyle(color: kInkMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    // Fokus halqasi — kPrimary (mint 2.12:1, ko'rinmas).
                    borderSide: const BorderSide(color: kFocusRing, width: 2),
                  ),
                  contentPadding: const EdgeInsets.all(kSpace4),
                  counterStyle: const TextStyle(color: kInkMuted),
                ),
              ),
              const Spacer(),

              // Submit button
              AppButton(
                label: 'Yuborish',
                onPressed: _submit,
                isLoading: _isLoading,
              ),
              const SizedBox(height: kSpace3),

              // Skip button
              ConstrainedBox(
                constraints: const BoxConstraints(
                  minHeight: kMinTapTarget,
                  minWidth: kMinTapTarget,
                ),
                child: TextButton(
                  onPressed:
                      _isLoading ? null : () => Navigator.of(context).pop(),
                  child: const Text(
                    "O'tkazib yuborish",
                    style: TextStyle(
                      color: kInkMuted,
                      fontSize: kFontBodyLg,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _ratingLabel(int score) {
    switch (score) {
      case 1:
        return 'Juda yomon';
      case 2:
        return 'Yomon';
      case 3:
        return 'Oddiy';
      case 4:
        return 'Yaxshi';
      case 5:
        return 'Ajoyib!';
      default:
        return 'Yulduz tanlang';
    }
  }
}
