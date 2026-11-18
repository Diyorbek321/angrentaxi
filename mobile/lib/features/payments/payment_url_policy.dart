/// To'lov WebView'i qaysi manzillarni ochishi mumkin.
///
/// Ikki qatlam:
/// 1. **Boshlang'ich sahifa** — serverdan kelgan URL faqat ma'lum provayder
///    xostida bo'lsa ochiladi ([isTrustedCheckoutUrl]). Server buzilsa yoki
///    javob soxtalashtirilsa ham ilova karta ma'lumoti so'raydigan begona
///    sahifani to'lov oynasi sifatida ko'rsatmaydi.
/// 2. **Sahifa ichidagi o'tishlar** — provayder 3-D Secure uchun bank
///    sahifasiga yo'naltirishi mumkin, shuning uchun xost cheklanmaydi, lekin
///    faqat `https`. Bank ilovasini ochadigan sxemalar (`intent:`, `click:`,
///    `tel:` …) WebView'da ochilmaydi (ERR_UNKNOWN_URL_SCHEME edi) — tizimga
///    beriladi.
library;

/// Provayderlarning to'lov sahifalari (backend `payments/*.provider.ts`).
const Set<String> kTrustedCheckoutDomains = {
  'paycom.uz',
  'payme.uz',
  'click.uz',
  'uzcard.uz',
};

/// Qo'shimcha xostlar reliz qayta yozilmasdan: masalan Uzcard (UZPS)
/// `redirect_url` boshqa domenda bo'lsa —
/// `--dart-define=PAYMENT_EXTRA_DOMAINS=uzps.uz,humo.uz`.
const String _extraDomainsDefine = String.fromEnvironment('PAYMENT_EXTRA_DOMAINS');

Set<String> get _extraDomains => _extraDomainsDefine
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .where((d) => d.isNotEmpty)
    .toSet();

enum PaymentNavigation {
  /// `angrengo://…` — to'lovdan qaytish, oyna yopiladi.
  appReturn,

  /// WebView ichida ochiladi.
  allow,

  /// Tashqi ilovaga (bank ilovasi, telefon) beriladi.
  external,

  /// Umuman ochilmaydi (`http:`, `javascript:`, `file:`, `data:` …).
  block,
}

const Set<String> _blockedSchemes = {
  'http',
  'javascript',
  'file',
  'data',
  'content',
  'about',
  'blob',
};

PaymentNavigation classifyPaymentNavigation(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null) return PaymentNavigation.block;
  final scheme = uri.scheme.toLowerCase();
  if (scheme == 'angrengo') return PaymentNavigation.appReturn;
  if (scheme == 'https') return PaymentNavigation.allow;
  if (scheme.isEmpty || _blockedSchemes.contains(scheme)) {
    return PaymentNavigation.block;
  }
  return PaymentNavigation.external;
}

bool isTrustedCheckoutUrl(String url, {Set<String>? extraDomains}) {
  final uri = Uri.tryParse(url);
  if (uri == null || uri.scheme.toLowerCase() != 'https') return false;
  final host = uri.host.toLowerCase();
  return {...kTrustedCheckoutDomains, ...(extraDomains ?? _extraDomains)}
      .any((domain) => host == domain || host.endsWith('.$domain'));
}
