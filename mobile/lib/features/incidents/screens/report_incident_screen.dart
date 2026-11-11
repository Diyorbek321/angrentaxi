import 'dart:io';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/incidents/incident_labels.dart';
import 'package:angren_taxi/features/incidents/incidents_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Ochilgan shikoyat oynasi uchun hamma kiritmalar.
class IncidentReportArgs {
  const IncidentReportArgs({
    required this.vertical,
    required this.orderId,
    required this.side,
    this.safetyOnly = false,
    this.clientLabel,
  });

  final String vertical;
  final String orderId;
  final IncidentReporterSide side;

  /// Faol safar — faqat xavfsizlik toifalari (server ham shuni talab qiladi).
  final bool safetyOnly;

  /// Haydovchi uchun sarlavha: "Yo'lovchi" / "Mijoz".
  final String? clientLabel;

  bool get _vendorOrder => vertical != IncidentVertical.taxi;
}

/// Shikoyatni ochadi; yuborilsa `true`.
Future<bool> openIncidentReport(BuildContext context, IncidentReportArgs args) async {
  final sent = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => ReportIncidentScreen(args: args)),
  );
  return sent ?? false;
}

/// "Muammo bor": sabab + matn + ≤ 3 foto (docs/INCIDENT-POLICY.md §3).
class ReportIncidentScreen extends StatefulWidget {
  const ReportIncidentScreen({super.key, required this.args, this.service, this.picker});

  final IncidentReportArgs args;
  final IncidentsService? service;
  final ImagePicker? picker;

  @override
  State<ReportIncidentScreen> createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends State<ReportIncidentScreen> {
  static const _maxPhotos = 3;

  late final IncidentsService _service = widget.service ?? IncidentsService(sl<ApiClient>());
  late final ImagePicker _picker = widget.picker ?? ImagePicker();
  final TextEditingController _text = TextEditingController();
  final List<String> _photos = [];
  String? _category;
  String? _subject;
  bool _sending = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  bool get _canSend => _category != null && _text.text.trim().length >= 3 && !_sending;

  Future<void> _addPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(context.l10n.drvCamera),
              onTap: () => Navigator.of(sheet).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(context.l10n.drvGallery),
              onTap: () => Navigator.of(sheet).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    // 5 MB server chegarasi — siqib olamiz.
    final picked = await _picker.pickImage(source: source, imageQuality: 80, maxWidth: 1600);
    if (picked == null || !mounted) return;
    setState(() => _photos.add(picked.path));
  }

  Future<void> _send() async {
    if (!_canSend) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => _sending = true);
    try {
      final id = await _service.report(
        vertical: widget.args.vertical,
        orderId: widget.args.orderId,
        category: _category!,
        description: _text.text,
        subject: _subject,
      );
      var photosFailed = false;
      for (final path in _photos) {
        try {
          await _service.uploadPhoto(id, path);
        } catch (_) {
          photosFailed = true;
        }
      }
      messenger.showSnackBar(SnackBar(
        content: Text(photosFailed ? l10n.incSentPhotosFailed : l10n.incSent),
      ));
      navigator.pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: kErrorDeep));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final args = widget.args;
    final categories = IncidentCategory.forReport(
      side: args.side,
      vertical: args.vertical,
      safetyOnly: args.safetyOnly,
    );
    final title = args.safetyOnly
        ? l10n.incReportSafetyTitle
        : args.clientLabel != null
            ? l10n.incReportClient(args.clientLabel!)
            : l10n.incReportTitle;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(kSpace4),
          children: [
            if (args.safetyOnly) ...[
              _note(l10n.incSafetyNote),
              const SizedBox(height: kSpace4),
            ],
            Text(l10n.incCategoryLabel, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontTitle)),
            const SizedBox(height: kSpace2),
            Wrap(
              spacing: kSpace2,
              runSpacing: kSpace2,
              children: [
                for (final c in categories)
                  ChoiceChip(
                    key: ValueKey('incident-category-$c'),
                    label: Text(incidentCategoryLabel(l10n, c)),
                    selected: _category == c,
                    onSelected: _sending ? null : (_) => setState(() => _category = c),
                  ),
              ],
            ),
            if (args._vendorOrder && args.side == IncidentReporterSide.customer) ...[
              const SizedBox(height: kSpace4),
              Text(l10n.incSubjectLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: kSpace2),
              Wrap(
                spacing: kSpace2,
                children: [
                  for (final (id, label) in [('courier', l10n.incSubjectCourier), ('vendor', l10n.incSubjectVendor)])
                    ChoiceChip(
                      label: Text(label),
                      selected: _subject == id,
                      onSelected: (on) => setState(() => _subject = on ? id : null),
                    ),
                ],
              ),
            ],
            const SizedBox(height: kSpace4),
            TextField(
              key: const ValueKey('incident-description'),
              controller: _text,
              maxLength: 1000,
              maxLines: 4,
              enabled: !_sending,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(hintText: l10n.incDescriptionHint, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: kSpace2),
            Text(l10n.incPhotosLabel, style: const TextStyle(color: kInkMuted, fontSize: kFontLabel)),
            const SizedBox(height: kSpace2),
            _photosRow(l10n),
            const SizedBox(height: kSpace5),
            AppButton(
              key: const ValueKey('incident-submit'),
              label: _category == null ? l10n.incPickCategory : l10n.incSubmit,
              onPressed: _canSend ? _send : null,
              isLoading: _sending,
            ),
          ],
        ),
      ),
    );
  }

  Widget _note(String text) => Container(
        padding: const EdgeInsets.all(kSpace3),
        decoration: BoxDecoration(color: kErrorLight, borderRadius: BorderRadius.circular(kRadiusMd)),
        child: Text(text, style: const TextStyle(color: kErrorDeep, fontWeight: FontWeight.w600)),
      );

  Widget _photosRow(AppLocalizations l10n) => Wrap(
        spacing: kSpace2,
        runSpacing: kSpace2,
        children: [
          for (var i = 0; i < _photos.length; i++)
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  child: Image.file(File(_photos[i]), width: 72, height: 72, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox(width: 72, height: 72, child: Icon(Icons.image))),
                ),
                Positioned(
                  right: 0,
                  top: 0,
                  child: IconButton(
                    tooltip: l10n.incRemovePhoto,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: _sending ? null : () => setState(() => _photos.removeAt(i)),
                  ),
                ),
              ],
            ),
          if (_photos.length < _maxPhotos)
            OutlinedButton.icon(
              onPressed: _sending ? null : _addPhoto,
              icon: const Icon(Icons.add_a_photo_outlined, size: 18),
              label: Text(l10n.incAddPhoto),
            ),
        ],
      );
}
