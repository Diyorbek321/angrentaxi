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
      backgroundColor: kBackgroundWhite,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            children: [
              // Avatar
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  avatarLetter.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    color: kTextSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.passengerPhone,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: kTextPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Yo\'lovchi qanday edi?',
                style: TextStyle(fontSize: 15, color: kTextSecondary),
              ),
              const SizedBox(height: 28),

              // Star selector
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final filled = i < _selectedScore;
                  return GestureDetector(
                    onTap: () => _onStarTapped(i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: ScaleTransition(
                        scale: _starScales[i],
                        child: Icon(
                          filled ? Icons.star_rounded : Icons.star_outline_rounded,
                          color: filled ? kPrimaryYellow : Colors.grey.shade300,
                          size: 40,
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 8),
              Text(
                _ratingLabel(_selectedScore),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: kTextSecondary,
                ),
              ),
              const SizedBox(height: 28),

              // Comment field
              TextField(
                controller: _commentController,
                maxLength: 500,
                maxLines: 3,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: kSurfaceGrey,
                  hintText: "Yo'lovchi haqida izoh...",
                  hintStyle: const TextStyle(color: kTextSecondary),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: kPrimaryYellow, width: 2),
                  ),
                  contentPadding: const EdgeInsets.all(14),
                  counterStyle: const TextStyle(color: kTextSecondary),
                ),
              ),
              const Spacer(),

              // Submit button
              AppButton(
                label: 'Yuborish',
                onPressed: _submit,
                isLoading: _isLoading,
              ),
              const SizedBox(height: 12),

              // Skip button
              TextButton(
                onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
                child: const Text(
                  "O'tkazib yuborish",
                  style: TextStyle(
                    color: kTextSecondary,
                    fontSize: 15,
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
