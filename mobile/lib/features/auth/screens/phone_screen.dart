import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/shared/utils/validators.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});

  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController(text: '+998');

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _onContinue() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final phone = Validators.normalizePhone(_phoneController.text.trim());
    final auth = context.read<AuthProvider>();
    await auth.sendOtp(phone);

    if (!mounted) return;
    if (auth.state == AuthState.otpSent) {
      Navigator.of(context).pushNamed('/otp');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(kSpace4),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: kSpace10),
                _buildHeader()
                    .animate()
                    .fadeIn(duration: 450.ms)
                    .slideY(begin: -0.2, curve: Curves.easeOutCubic),
                const SizedBox(height: kSpace10),
                _buildPhoneField()
                    .animate()
                    .fadeIn(delay: 150.ms, duration: 450.ms)
                    .slideY(begin: 0.2, curve: Curves.easeOutCubic),
                const SizedBox(height: kSpace4),
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
                      label: 'Davom etish',
                      onPressed: _onContinue,
                      isLoading: auth.state == AuthState.loading,
                    );
                  },
                ).animate().fadeIn(delay: 300.ms, duration: 450.ms).slideY(begin: 0.3),
                const SizedBox(height: kSpace6),
                _buildTermsText().animate().fadeIn(delay: 450.ms),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Dekorativ brend belgisi — matn uni takrorlaydi.
        ExcludeSemantics(
          child: SizedBox(
            width: 64,
            height: 64,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: kPrimary,
                borderRadius: BorderRadius.all(Radius.circular(kRadiusMd)),
              ),
              child: Icon(Icons.bolt_rounded, size: 36, color: kOnPrimary),
            ),
          ),
        ),
        SizedBox(height: kSpace6),
        Text(
          'Angren Taxi',
          style: TextStyle(
            fontSize: kFontDisplay,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        SizedBox(height: kSpace2),
        Text(
          'Telefon raqamingizni kiriting',
          style: TextStyle(fontSize: kFontBodyLg, color: kInkMuted),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Telefon raqam',
          style: TextStyle(
            fontSize: kFontBody,
            fontWeight: FontWeight.w600,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace2),
        TextFormField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          autofocus: true,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[+0-9]')),
            LengthLimitingTextInputFormatter(13),
          ],
          validator: Validators.validatePhone,
          onFieldSubmitted: (_) => _onContinue(),
          style: const TextStyle(fontSize: kFontH2, letterSpacing: 1),
          decoration: const InputDecoration(
            hintText: '+998XXXXXXXXX',
            prefixIcon: Icon(Icons.phone_outlined, color: kInkMuted),
          ),
        ),
      ],
    );
  }

  Widget _buildTermsText() {
    return const Text(
      'Davom etish orqali siz foydalanish shartlari va '
      'maxfiylik siyosatiga rozilik bildirasiz.',
      style: TextStyle(
        fontSize: kFontCaption,
        color: kInkMuted,
        height: 1.5,
      ),
      textAlign: TextAlign.center,
    );
  }
}
