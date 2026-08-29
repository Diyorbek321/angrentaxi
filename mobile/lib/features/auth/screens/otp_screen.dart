import 'dart:async';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:provider/provider.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _otpController = TextEditingController();
  String _otpValue = '';

  Timer? _timer;
  int _secondsLeft = 0;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _secondsLeft = AppConfig.otpResendDuration.inSeconds;
    _canResend = false;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 0) {
        timer.cancel();
        if (mounted) setState(() => _canResend = true);
        return;
      }
      if (mounted) setState(() => _secondsLeft--);
    });
  }

  Future<void> _onVerify() async {
    if (_otpValue.length != 6) {
      AppHaptics.warning();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('6 ta raqamli kodni kiriting')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final success = await auth.verifyOtp(_otpValue);

    if (!mounted) return;
    if (success) {
      // Kirish muvaffaqiyatli — ikki zarbali ko'tariluvchi naqsh.
      AppHaptics.success();
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    } else {
      // Noto'g'ri kod. Xato haptikasi ekranga qaramasdan ham tushunarli —
      // foydalanuvchi ko'pincha klaviaturaga qarab turadi.
      AppHaptics.error();
    }
  }

  Future<void> _onResend() async {
    final auth = context.read<AuthProvider>();
    if (auth.phone == null) return;

    await auth.sendOtp(auth.phone!);
    if (!mounted) return;
    if (auth.state == AuthState.otpSent) {
      AppHaptics.tap();
      _otpController.clear();
      _otpValue = '';
      _startCountdown();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasdiqlash'),
        leading: Semantics(
          button: true,
          label: 'Orqaga',
          child: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: kSpace6),
              _buildHeader()
                  .animate()
                  .fadeIn(duration: 450.ms)
                  .slideY(begin: -0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: kSpace10),
              _buildOtpField()
                  .animate()
                  .fadeIn(delay: 150.ms, duration: 450.ms)
                  .slideY(begin: 0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: kSpace3),
              _buildResendRow().animate().fadeIn(delay: 300.ms),
              const SizedBox(height: kSpace6),
              Consumer<AuthProvider>(
                builder: (context, auth, _) {
                  if (auth.state == AuthState.error && auth.error != null) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: kSpace4),
                      child: InlineErrorWidget(message: auth.error!),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
              Consumer<AuthProvider>(
                builder: (context, auth, _) {
                  return AppButton(
                    label: 'Tasdiqlash',
                    onPressed: _otpValue.length == 6 ? _onVerify : null,
                    isLoading: auth.state == AuthState.loading,
                    isEnabled: _otpValue.length == 6,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final auth = context.read<AuthProvider>();
    final phone = auth.phone ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SMS kod kiriting',
          style: TextStyle(
            fontSize: kFontH1,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace2),
        RichText(
          text: TextSpan(
            style: const TextStyle(fontSize: kFontBodyLg, color: kInkMuted),
            children: [
              const TextSpan(text: 'Kod '),
              TextSpan(
                text: Formatters.formatPhone(phone),
                style: const TextStyle(
                  color: kInk,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const TextSpan(text: ' raqamiga yuborildi'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOtpField() {
    return PinCodeTextField(
      appContext: context,
      length: 6,
      controller: _otpController,
      keyboardType: TextInputType.number,
      animationType: AnimationType.fade,
      pinTheme: PinTheme(
        shape: PinCodeFieldShape.box,
        borderRadius: BorderRadius.circular(kRadiusSm),
        fieldHeight: kControlHeight,
        fieldWidth: kMinTapTarget,
        activeFillColor: kSurface,
        // Tanlangan katak — kPrimary chegara (yorug' fonda 5.38:1),
        // mint chegara oq ustida atigi 2.12:1 berardi.
        selectedFillColor: kMintTint,
        inactiveFillColor: kSurface2,
        activeColor: kPrimary,
        selectedColor: kPrimary,
        inactiveColor: kSurface2,
      ),
      enableActiveFill: true,
      onChanged: (value) {
        setState(() => _otpValue = value);
        if (value.length == 6) {
          FocusScope.of(context).unfocus();
        }
      },
      onCompleted: (_) => _onVerify(),
    );
  }

  Widget _buildResendRow() {
    if (_canResend) {
      return Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: kMinTapTarget,
              minWidth: kMinTapTarget,
            ),
            child: TextButton(
              onPressed: auth.state != AuthState.loading ? _onResend : null,
              child: const Text(
                'Kodni qayta yuborish',
                style: TextStyle(
                  // Yorug' fondagi link — kPrimary (5.38:1).
                  color: kPrimary,
                  fontSize: kFontBodyLg,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          );
        },
      );
    }

    return Text(
      'Qayta yuborish: $_secondsLeft s',
      style: const TextStyle(color: kInkMuted, fontSize: kFontBody),
    );
  }
}
