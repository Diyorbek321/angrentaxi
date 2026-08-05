import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

class RateDriverScreen extends StatefulWidget {
  const RateDriverScreen({
    super.key,
    required this.orderId,
    required this.driverName,
  });

  final String orderId;
  final String driverName;

  @override
  State<RateDriverScreen> createState() => _RateDriverScreenState();
}

class _RateDriverScreenState extends State<RateDriverScreen>
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

    // Animate all stars up to and including the tapped one.
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
    final avatarLetter =
        widget.driverName.isNotEmpty ? widget.driverName[0].toUpperCase() : '?';

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: Padding(
          padding:
              const EdgeInsets.fromLTRB(kSpace6, kSpace8, kSpace6, kSpace6),
          child: Column(
            children: [
              // Avatar — mint dekorativ to'ldirish, ustidagi harf ink
              // (7.84:1), hech qachon oq (2.12:1).
              ExcludeSemantics(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: kMint,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    avatarLetter,
                    style: const TextStyle(
                      fontSize: kFontDisplay,
                      fontWeight: FontWeight.w800,
                      color: kOnMint,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: kSpace4),
              Text(
                widget.driverName,
                style: const TextStyle(
                  fontSize: kFontH1,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace1 + 2),
              const Text(
                'Sayohat qanday kechdi?',
                style: TextStyle(fontSize: kFontTitle, color: kInkMuted),
              ),
              const SizedBox(height: kSpace8),

              // Star selector — har bir yulduz 48x48 tegish maydoni va
              // "N yulduz" yorlig'i bilan.
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
                      onTap: () => _onStarTapped(i),
                      behavior: HitTestBehavior.opaque,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minHeight: kMinTapTarget,
                          minWidth: kMinTapTarget,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: kSpace1 + 2),
                          child: ScaleTransition(
                            scale: _starScales[i],
                            child: Icon(
                              filled
                                  ? Icons.star_rounded
                                  : Icons.star_outline_rounded,
                              // Reyting ma'no tashiydi — yorug' fonda
                              // ko'rinadigan mint kMintDeep bo'lishi shart.
                              color: filled ? kMintDeep : kInkSubtle,
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
                  hintText: 'Haydovchi haqida izoh...',
                  hintStyle: const TextStyle(color: kInkMuted),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    borderSide: const BorderSide(color: kPrimary, width: 2),
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
              SizedBox(
                height: kMinTapTarget,
                child: TextButton(
                  onPressed:
                      _isLoading ? null : () => Navigator.of(context).pop(),
                  child: const Text(
                    "O'tkazib yuborish",
                    style: TextStyle(
                      color: kInkMuted,
                      fontSize: kFontTitle,
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
