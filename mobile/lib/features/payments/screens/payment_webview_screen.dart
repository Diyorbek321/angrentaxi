import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/platform/secure_screen.dart';
import 'package:angren_taxi/features/payments/payment_url_policy.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Signature used to open the hosted checkout page after
/// `POST /payments/initiate` succeeds. Returns true if the user confirmed
/// they finished paying, false/null if they cancelled/backed out. Overridable
/// in widget tests so they don't need a real webview_flutter platform
/// implementation.
typedef OpenPaymentCheckout = Future<bool?> Function(
  BuildContext context,
  PaymentInitiateResult result,
);

/// Hosts the real Payme/Click/Uzcard checkout page returned by
/// `POST /payments/initiate` inside the app, so the passenger never has to
/// leave Angren Taxi to pay.
///
/// This screen only renders whatever hosted page the provider returns — it
/// does not itself move money. Whether a completed checkout on that page
/// actually clears funds depends on the merchant credentials configured for
/// that provider on the backend (see the doc comment on [PaymentService]).
///
/// There's no universal, provider-agnostic way to detect "payment succeeded"
/// purely from client-side navigation events (each provider's hosted flow
/// redirects differently), so this screen keeps that decision explicit and
/// user-driven: a persistent bottom bar lets the passenger confirm once
/// they've finished on the provider's page, or cancel. The real source of
/// truth is still the provider's server-to-server callback
/// (`/payments/{payme,click,uzcard}/callback`), which updates the
/// transaction row backing `GET /payments/wallet` /
/// `GET /payments/transactions` independently of what this screen reports.
/// Ilovaning o'z sxemasi (`angrengo://…`) — to'lov sahifasidan qaytish.
bool isAppReturnUrl(String url) =>
    classifyPaymentNavigation(url) == PaymentNavigation.appReturn;

class PaymentWebViewScreen extends StatefulWidget {
  const PaymentWebViewScreen({super.key, required this.result});

  final PaymentInitiateResult result;

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _loadError;

  /// Serverdan kelgan sahifa ma'lum provayderniki emas — ochilmaydi.
  bool _untrusted = false;

  @override
  void initState() {
    super.initState();
    // Karta raqami va SMS kodi skrinshotga, ekran yozuviga va "so'nggi
    // ilovalar" rasmiga tushmasin.
    SecureScreen.instance.acquire();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          // Siyosat: `payment_url_policy.dart`.
          onNavigationRequest: (request) {
            switch (classifyPaymentNavigation(request.url)) {
              // Hamyonni to'ldirishdan qaytish havolasi
              // (`angrengo://wallet/topup/<id>`, WALLET_TOPUP_RETURN_URL) —
              // sahifa yopiladi, chaqiruvchi ekran holatni serverdan
              // so'raydi. Qaytish to'lovni tasdiqlamaydi.
              case PaymentNavigation.appReturn:
                _finish(true);
                return NavigationDecision.prevent;
              case PaymentNavigation.allow:
                return NavigationDecision.navigate;
              case PaymentNavigation.external:
                _openExternally(request.url);
                return NavigationDecision.prevent;
              case PaymentNavigation.block:
                return NavigationDecision.prevent;
            }
          },
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          // Faqat asosiy sahifa xatosi: bitta rasm yoki analitika skripti
          // yuklanmasa butun to'lov oynasi xato ekraniga almashardi.
          onWebResourceError: (error) {
            if (error.isForMainFrame == false) return;
            setState(() {
              _loading = false;
              _loadError = error.description;
            });
          },
        ),
      );
    _loadCheckout();
  }

  void _loadCheckout() {
    if (!isTrustedCheckoutUrl(widget.result.url)) {
      _loading = false;
      _untrusted = true;
      return;
    }
    _controller.loadRequest(Uri.parse(widget.result.url));
  }

  Future<void> _openExternally(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Bank ilovasi o'rnatilmagan — provayder sahifasi odatda boshqa yo'l
      // taklif qiladi, WebView o'z joyida qoladi.
    }
  }

  @override
  void dispose() {
    SecureScreen.instance.release();
    super.dispose();
  }

  void _finish(bool completed) {
    if (!mounted) return;
    Navigator.of(context).pop(completed);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish(false);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            context.l10n
                .saPaymentTitle(widget.result.provider.toUpperCase()),
          ),
          leading: Semantics(
            button: true,
            label: context.l10n.saClose,
            excludeSemantics: true,
            child: IconButton(
              icon: const Icon(Icons.close_rounded),
              onPressed: () => _finish(false),
              constraints: const BoxConstraints(
                minWidth: kMinTapTarget,
                minHeight: kMinTapTarget,
              ),
            ),
          ),
        ),
        body: Column(
          children: [
            if (_loading)
              const LinearProgressIndicator(
                minHeight: 2,
                color: kPrimary,
                backgroundColor: kSurface2,
              ),
            Expanded(
              child: _untrusted
                  ? AppErrorState(message: context.l10n.saPaymentUntrustedPage)
                  : _loadError != null
                      ? _ErrorState(
                          message: _loadError!,
                          onRetry: () {
                            setState(() => _loadError = null);
                            _loadCheckout();
                          },
                        )
                      : WebViewWidget(controller: _controller),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  kSpace4,
                  kSpace3,
                  kSpace4,
                  kSpace4,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _finish(false),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, kControlHeight),
                        ),
                        child: Text(context.l10n.saCancel),
                      ),
                    ),
                    const SizedBox(width: kSpace3),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => _finish(true),
                        style: FilledButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: kOnPrimary,
                          minimumSize: const Size(0, kControlHeight),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(kRadiusMd),
                          ),
                        ),
                        child: Text(context.l10n.saPaymentIPaid),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // Matn o'zgarmagan — faqat umumiy `AppErrorState` ko'rinishiga o'tdi.
    return AppErrorState(
      message: context.l10n.saPaymentPageLoadFailed(message),
      onRetry: onRetry,
    );
  }
}
