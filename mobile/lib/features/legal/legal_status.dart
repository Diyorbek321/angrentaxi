// ============================================================================
// OFERTA ROZILIGI — server holati (`GET /legal/acceptance`).
//
//   { mustAccept: bool,
//     documents: [{ document, version, acceptedVersion?, mustAccept,
//                   summary: { uz, ru } }] }
//
// `document` — 'terms' | 'driver-terms' | 'vendor-terms' | 'privacy'
// (backend `modules/legal/legal-versions.ts`).
// ============================================================================

/// Huquqiy hujjat turlari (server kodlari).
abstract final class LegalDocumentCode {
  static const terms = 'terms';
  static const driverTerms = 'driver-terms';
  static const vendorTerms = 'vendor-terms';
  static const privacy = 'privacy';
}

class LegalDocumentState {
  const LegalDocumentState({
    required this.document,
    required this.version,
    required this.mustAccept,
    this.acceptedVersion,
    this.summaryUz = '',
    this.summaryRu = '',
  });

  final String document;
  final String version;
  final String? acceptedVersion;
  final bool mustAccept;
  final String summaryUz;
  final String summaryRu;

  /// Ilgari boshqa tahrir qabul qilingan — "yangilandi" (birinchi marta emas).
  bool get isUpdate => mustAccept && acceptedVersion != null;

  String summaryFor(String localeName) =>
      localeName == 'ru' && summaryRu.isNotEmpty ? summaryRu : summaryUz;

  static LegalDocumentState? tryParse(dynamic json) {
    if (json is! Map) return null;
    final document = json['document']?.toString() ?? '';
    final version = json['version']?.toString() ?? '';
    if (document.isEmpty || version.isEmpty) return null;
    final summary = json['summary'];
    return LegalDocumentState(
      document: document,
      version: version,
      acceptedVersion: json['acceptedVersion']?.toString(),
      mustAccept: json['mustAccept'] == true,
      summaryUz: summary is Map ? summary['uz']?.toString() ?? '' : '',
      summaryRu: summary is Map ? summary['ru']?.toString() ?? '' : '',
    );
  }
}

class LegalStatus {
  const LegalStatus({required this.mustAccept, required this.documents});

  final bool mustAccept;
  final List<LegalDocumentState> documents;

  /// Qabul qilinishi kerak bo'lganlari (ko'rsatish tartibida).
  List<LegalDocumentState> get pending =>
      documents.where((d) => d.mustAccept).toList(growable: false);

  /// Birortasi ilgari boshqa tahrirda qabul qilingan — sarlavha "yangilandi".
  bool get isUpdate => pending.any((d) => d.isUpdate);

  /// `{ success, data }` konvertidan yoki to'g'ridan-to'g'ri `data` dan.
  static LegalStatus? tryParse(dynamic body) {
    var json = body;
    if (json is Map && json['data'] is Map) json = json['data'];
    if (json is! Map) return null;
    final raw = json['documents'];
    final documents = raw is List
        ? raw
            .map(LegalDocumentState.tryParse)
            .whereType<LegalDocumentState>()
            .toList(growable: false)
        : const <LegalDocumentState>[];
    return LegalStatus(
      mustAccept: json['mustAccept'] == true || documents.any((d) => d.mustAccept),
      documents: documents,
    );
  }
}
