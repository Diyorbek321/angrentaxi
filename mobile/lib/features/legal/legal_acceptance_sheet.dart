import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/legal/legal_status.dart';
import 'package:angren_taxi/features/legal/legal_terms_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Hujjat matnini ochish — testlarda almashtiriladi.
typedef OpenLegalDocument = Future<void> Function(String document);

/// Oferta rozilik oynasi — yo'lovchi va haydovchi ilovasi uchun bitta.
///
/// [blocking] — yopib bo'lmaydi (ilova ochilganda tahrir o'zgargan bo'lsa):
/// faqat "Qabul qilaman" yoki "Chiqish" ([onLogout]). Aks holda (haydovchi
/// onlayn chiqmoqchi bo'lganda) "Keyinroq" bilan yopiladi.
///
/// `true` — qabul qilindi va server yozdi.
Future<bool> showLegalAcceptanceSheet(
  BuildContext context, {
  required LegalStatus status,
  required LegalTermsService service,
  bool blocking = true,
  String? intro,
  VoidCallback? onLogout,
  OpenLegalDocument openDocument = openLegalDocument,
}) async {
  final accepted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: !blocking,
    enableDrag: !blocking,
    showDragHandle: !blocking,
    builder: (_) => PopScope(
      canPop: !blocking,
      child: LegalAcceptanceSheet(
        status: status,
        service: service,
        blocking: blocking,
        intro: intro,
        onLogout: onLogout,
        openDocument: openDocument,
      ),
    ),
  );
  return accepted == true;
}

class LegalAcceptanceSheet extends StatefulWidget {
  const LegalAcceptanceSheet({
    super.key,
    required this.status,
    required this.service,
    this.blocking = true,
    this.intro,
    this.onLogout,
    this.openDocument = openLegalDocument,
  });

  final LegalStatus status;
  final LegalTermsService service;
  final bool blocking;
  final String? intro;
  final VoidCallback? onLogout;
  final OpenLegalDocument openDocument;

  @override
  State<LegalAcceptanceSheet> createState() => _LegalAcceptanceSheetState();
}

class _LegalAcceptanceSheetState extends State<LegalAcceptanceSheet> {
  late LegalStatus _status = widget.status;
  bool _saving = false;
  String? _error;

  Future<void> _accept() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await widget.service.accept(_status.pending);
      if (!mounted) return;
      if (result != null && result.mustAccept) {
        // Server boshqa hujjatni ham kutmoqda — ro'yxatni yangilaymiz.
        setState(() {
          _status = result;
          _saving = false;
        });
        return;
      }
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final outdated = ApiError.from(e)?.code == ApiErrorCode.legalVersionOutdated;
      LegalStatus? fresh;
      if (outdated) {
        try {
          fresh = await widget.service.fetchStatus();
        } catch (_) {
          fresh = null;
        }
      }
      if (!mounted) return;
      setState(() {
        if (fresh != null) _status = fresh;
        _saving = false;
        _error = outdated
            ? context.l10n.ofrOutdatedReloaded
            : context.l10n.ofrAcceptFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.maybeLocaleOf(context)?.languageCode ?? AppL10n.localeName;
    final pending = _status.pending;

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(kSpace5, widget.blocking ? kSpace5 : 0, kSpace5, kSpace5),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _status.isUpdate ? l10n.ofrSheetTitleUpdated : l10n.ofrSheetTitleNew,
            style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
          ),
          const SizedBox(height: kSpace2),
          Text(
            widget.intro ?? l10n.ofrSheetIntro,
            style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
          ),
          const SizedBox(height: kSpace4),
          for (final doc in pending) _DocumentTile(doc: doc, locale: locale, open: widget.openDocument),
          if (_error != null) ...[
            const SizedBox(height: kSpace2),
            Text(_error!, style: const TextStyle(color: kErrorDeep, fontSize: kFontLabel)),
          ],
          const SizedBox(height: kSpace4),
          FilledButton(
            key: const Key('legalAcceptButton'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(kControlHeightSm)),
            onPressed: _saving || pending.isEmpty ? null : _accept,
            child: _saving
                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(l10n.ofrAccept),
          ),
          const SizedBox(height: kSpace2),
          if (!widget.blocking)
            TextButton(
              style: TextButton.styleFrom(minimumSize: const Size.fromHeight(kMinTapTarget)),
              onPressed: _saving ? null : () => Navigator.of(context).pop(false),
              child: Text(l10n.ofrLater),
            )
          else if (widget.onLogout != null)
            TextButton(
              style: TextButton.styleFrom(minimumSize: const Size.fromHeight(kMinTapTarget)),
              onPressed: _saving
                  ? null
                  : () {
                      Navigator.of(context).pop(false);
                      widget.onLogout!();
                    },
              child: Text(l10n.ofrLogout, style: const TextStyle(color: kInkMuted)),
            ),
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.doc, required this.locale, required this.open});

  final LegalDocumentState doc;
  final String locale;
  final OpenLegalDocument open;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final summary = doc.summaryFor(locale);
    return Padding(
      padding: const EdgeInsets.only(bottom: kSpace3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            legalDocumentTitle(l10n, doc.document),
            style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: kInk),
          ),
          Text(
            l10n.ofrVersion(doc.version),
            style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
          ),
          if (summary.isNotEmpty) ...[
            const SizedBox(height: kSpace1),
            Text(
              '${l10n.ofrWhatChanged}: $summary',
              style: const TextStyle(fontSize: kFontLabel, color: kInk, height: 1.4),
            ),
          ],
          TextButton(
            style: TextButton.styleFrom(
              minimumSize: const Size(0, kMinTapTarget),
              padding: EdgeInsets.zero,
              alignment: Alignment.centerLeft,
            ),
            onPressed: () => open(doc.document),
            child: Text(
              l10n.ofrReadFull,
              style: const TextStyle(fontSize: kFontLabel, decoration: TextDecoration.underline),
            ),
          ),
        ],
      ),
    );
  }
}
