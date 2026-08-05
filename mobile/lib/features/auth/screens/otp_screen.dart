import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('6 ta raqamli kodni kiriting')),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final success = await auth.verifyOtp(_otpValue);

    if (!mounted) return;
    if (success) {
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    }
  }

  Future<void> _onResend() async {
    final auth = context.read<AuthProvider>();
    if (auth.phone == null) return;

    await auth.sendOtp(auth.phone!);
    if (!mounted) return;
    if (auth.state == AuthState.otpSent) {
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 24),
              _buildHeader()
                  .animate()
                  .fadeIn(duration: 450.ms)
                  .slideY(begin: -0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: 40),
              _buildOtpField()
                  .animate()
                  .fadeIn(delay: 150.ms, duration: 450.ms)
                  .slideY(begin: 0.2, curve: Curves.easeOutCubic),
              const SizedBox(height: 12),
              _buildResendRow().animate().fadeIn(delay: 300.ms),
              const SizedBox(height: 24),
              Consumer<AuthProvider>(
                builder: (context, auth, _) {
                  if (auth.state == AuthState.error && auth.error != null) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
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
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: kTextPrimary,
          ),
        ),
        const SizedBox(height: 8),
        RichText(
          text: TextSpan(
            style: const TextStyle(fontSize: 15, color: kTextSecondary),
            children: [
              const TextSpan(text: 'Kod '),
              TextSpan(
                text: Formatters.formatPhone(phone),
                style: const TextStyle(
                  color: kTextPrimary,
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
        borderRadius: BorderRadius.circular(10),
        fieldHeight: 52,
        fieldWidth: 48,
        activeFillColor: kBackgroundWhite,
        selectedFillColor: kPrimaryYellow.withAlpha(30),
        inactiveFillColor: kSurfaceGrey,
        activeColor: kPrimaryYellow,
        selectedColor: kPrimaryYellow,
        inactiveColor: kSurfaceGrey,
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
          return TextButton(
            onPressed: auth.state != AuthState.loading ? _onResend : null,
            child: const Text(
              'Kodni qayta yuborish',
              style: TextStyle(
                color: kSecondaryBlack,
                fontWeight: FontWeight.w600,
              ),
            ),
          );
        },
      );
    }

    return Text(
      'Qayta yuborish: $_secondsLeft s',
      style: const TextStyle(color: kTextSecondary, fontSize: 14),
    );
  }
}
