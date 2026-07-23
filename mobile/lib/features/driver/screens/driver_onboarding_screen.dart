import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_document.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

// Label + icon for each KYC document type the driver must submit.
const List<(DriverDocumentType, String, IconData)> _kDriverDocumentTypes = [
  (
    DriverDocumentType.licenseFront,
    'Haydovchilik guvohnomasi (old tomoni)',
    Icons.badge_outlined,
  ),
  (
    DriverDocumentType.licenseBack,
    'Haydovchilik guvohnomasi (orqa tomoni)',
    Icons.badge_outlined,
  ),
  (DriverDocumentType.passport, 'Pasport', Icons.perm_identity_outlined),
  (
    DriverDocumentType.vehicleRegistration,
    'Texnik pasport',
    Icons.directions_car_filled_outlined,
  ),
];

// Gatekeeper shown right after a driver-flavor login, before the map/home
// screen. A fresh account has no driver profile yet, so this decides between:
// - application form (no profile / role isn't driver yet)
// - "awaiting approval" screen (profile exists, admin hasn't approved it)
// - straight through to /driver/home (already approved)
class DriverOnboardingScreen extends StatefulWidget {
  const DriverOnboardingScreen({super.key});

  @override
  State<DriverOnboardingScreen> createState() =>
      _DriverOnboardingScreenState();
}

class _DriverOnboardingScreenState extends State<DriverOnboardingScreen> {
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  Future<void> _check() async {
    final driver = context.read<DriverProvider>();
    final status = await driver.checkOnboarding();
    if (!mounted) return;
    if (status == DriverOnboardingStatus.approved) {
      Navigator.of(context).pushReplacementNamed('/driver/home');
      return;
    }
    setState(() => _checking = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Consumer<DriverProvider>(
          builder: (context, driverProvider, _) {
            if (_checking) {
              return const LoadingWidget();
            }
            if (driverProvider.onboardingStatus ==
                DriverOnboardingStatus.pendingApproval) {
              return _PendingApprovalView(onRefresh: _check);
            }
            return _ApplicationForm(onSubmitted: _check);
          },
        ),
      ),
    );
  }
}

class _ApplicationForm extends StatefulWidget {
  const _ApplicationForm({required this.onSubmitted});

  final Future<void> Function() onSubmitted;

  @override
  State<_ApplicationForm> createState() => _ApplicationFormState();
}

class _ApplicationFormState extends State<_ApplicationForm> {
  final _carModelController = TextEditingController();
  final _carNumberController = TextEditingController();
  final _carYearController = TextEditingController();

  @override
  void dispose() {
    _carModelController.dispose();
    _carNumberController.dispose();
    _carYearController.dispose();
    super.dispose();
  }

  Future<void> _submit(DriverProvider driverProvider) async {
    final ok = await driverProvider.applyAsDriver(
      carModel: _carModelController.text.trim(),
      carNumber: _carNumberController.text.trim(),
      carYear: int.tryParse(_carYearController.text.trim()),
    );
    if (!ok || !mounted) return;
    await widget.onSubmitted();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer2<DriverProvider, AuthProvider>(
      builder: (context, driverProvider, auth, _) {
        final isLoading = driverProvider.state == DriverProviderState.loading;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              const Icon(Icons.local_taxi, color: kPrimary, size: 48),
              const SizedBox(height: 16),
              const Text(
                'Haydovchi bo\'lish uchun ariza',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                '${auth.currentUser?.phone ?? ''} raqami hali haydovchi sifatida ro\'yxatdan o\'tmagan. Mashina ma\'lumotlarini kiriting — admin tasdiqlagach onlayn bo\'la olasiz.',
                style: const TextStyle(color: kTextSecondary, fontSize: 14),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _carModelController,
                decoration: const InputDecoration(
                  labelText: 'Mashina modeli',
                  hintText: 'Masalan: Chevrolet Cobalt',
                  prefixIcon: Icon(Icons.directions_car_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _carNumberController,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Davlat raqami',
                  hintText: 'Masalan: 01 A 123 BC',
                  prefixIcon: Icon(Icons.pin_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _carYearController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Mashina ishlab chiqarilgan yili',
                  hintText: 'Masalan: 2019',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                  border: OutlineInputBorder(),
                  helperText:
                      "Qaysi tarif darajasida ishlay olishingiz shu ma'lumot asosida ko'rib chiqiladi",
                ),
              ),
              if (driverProvider.state == DriverProviderState.error &&
                  driverProvider.error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    driverProvider.error!,
                    style: const TextStyle(color: kError, fontSize: 13),
                  ),
                ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Arizani yuborish',
                isLoading: isLoading,
                onPressed: () => _submit(driverProvider),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.read<AuthProvider>().logout(),
                child: const Text('Chiqish', style: TextStyle(color: kError)),
              ),
            ],
          ),
        );
      },
    );
  }
}

// Shown right after a successful application (car model/plate already
// submitted, role already promoted to `driver` server-side — see
// DriversService.createProfile). KYC document upload lives here rather than
// in `_ApplicationForm` above because POST/GET /drivers/documents require
// role `driver`, which only exists once the application form has been
// submitted; this is the first point in onboarding where those calls work.
class _PendingApprovalView extends StatelessWidget {
  const _PendingApprovalView({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: kPrimaryYellow.withAlpha(30),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.hourglass_top,
              color: kPrimaryYellow,
              size: 40,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Ariza ko\'rib chiqilmoqda',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Sizning haydovchilik arizangiz admin tomonidan tasdiqlanishini kutmoqda. Tasdiqlangach shu yerdan avtomatik davom etasiz.',
            textAlign: TextAlign.center,
            style: TextStyle(color: kTextSecondary, fontSize: 14),
          ),
          const SizedBox(height: 28),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Hujjatlarni yuklang',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 4),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Tasdiqlash tezroq bo\'lishi uchun quyidagi hujjatlarning aniq suratlarini yuklang.',
              style: TextStyle(color: kTextSecondary, fontSize: 13),
            ),
          ),
          const SizedBox(height: 12),
          const _DriverDocumentsSection(),
          const SizedBox(height: 24),
          AppButton(
            label: 'Holatni tekshirish',
            backgroundColor: kSurfaceGrey,
            foregroundColor: kTextPrimary,
            onPressed: () => onRefresh(),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => context.read<AuthProvider>().logout(),
            child: const Text('Chiqish', style: TextStyle(color: kError)),
          ),
        ],
      ),
    );
  }
}

// Lists all required KYC document types with per-document pick/upload
// controls, wired to DriverProvider.uploadDriverDocument. Fetches the
// driver's already-uploaded documents once on mount so review statuses
// (pending/approved/rejected) show up after returning to this screen.
class _DriverDocumentsSection extends StatefulWidget {
  const _DriverDocumentsSection();

  @override
  State<_DriverDocumentsSection> createState() =>
      _DriverDocumentsSectionState();
}

class _DriverDocumentsSectionState extends State<_DriverDocumentsSection> {
  // Tests stub the picked file by overriding `ImagePickerPlatform.instance`
  // (the officially supported way to fake image_picker in widget tests)
  // rather than injecting a picker here, so this stays a plain ImagePicker.
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<DriverProvider>().loadDriverDocuments(),
    );
  }

  Future<void> _pickAndUpload(DriverDocumentType type) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Kamera'),
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Galereya'),
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picked = await _picker.pickImage(source: source, imageQuality: 85);
    if (picked == null || !mounted) return;

    await context
        .read<DriverProvider>()
        .uploadDriverDocument(type, File(picked.path));
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DriverProvider>(
      builder: (context, driverProvider, _) {
        return Column(
          children: [
            for (final entry in _kDriverDocumentTypes)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _DriverDocumentRow(
                  documentType: entry.$1,
                  label: entry.$2,
                  icon: entry.$3,
                  document: driverProvider.documentFor(entry.$1),
                  uploadState: driverProvider.uploadStateFor(entry.$1),
                  onTap: () => _pickAndUpload(entry.$1),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DriverDocumentRow extends StatelessWidget {
  const _DriverDocumentRow({
    required this.documentType,
    required this.label,
    required this.icon,
    required this.document,
    required this.uploadState,
    required this.onTap,
  });

  final DriverDocumentType documentType;
  final String label;
  final IconData icon;
  final DriverDocument? document;
  final DriverDocumentUploadState uploadState;
  final VoidCallback onTap;

  bool get _isUploading =>
      uploadState.status == DriverDocumentUploadStatus.uploading;
  bool get _isFailed =>
      uploadState.status == DriverDocumentUploadStatus.failed;

  String get _statusText {
    if (_isUploading) {
      final pct = (uploadState.progress * 100).clamp(0, 100).toStringAsFixed(0);
      return 'Yuklanmoqda... $pct%';
    }
    if (_isFailed) {
      return uploadState.error ?? 'Yuklashda xatolik';
    }
    if (document == null) {
      return 'Yuklanmagan';
    }
    switch (document!.reviewStatus) {
      case DriverDocumentReviewStatus.pending:
        return 'Tekshirilmoqda';
      case DriverDocumentReviewStatus.approved:
        return 'Tasdiqlangan';
      case DriverDocumentReviewStatus.rejected:
        return 'Rad etilgan — qayta yuklang';
    }
  }

  Color get _statusColor {
    if (_isFailed) return kError;
    if (_isUploading) return kTextSecondary;
    if (document == null) return kTextSecondary;
    switch (document!.reviewStatus) {
      case DriverDocumentReviewStatus.pending:
        return kWarning;
      case DriverDocumentReviewStatus.approved:
        return kSuccess;
      case DriverDocumentReviewStatus.rejected:
        return kError;
    }
  }

  String get _actionLabel {
    if (_isFailed) return 'Qayta urinish';
    if (_isUploading) return '';
    if (document == null) return 'Yuklash';
    return 'Qayta yuklash';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kSurfaceGrey),
      ),
      child: Row(
        children: [
          Icon(icon, color: kTextSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                if (_isUploading)
                  Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 4),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: uploadState.progress > 0
                            ? uploadState.progress
                            : null,
                        minHeight: 4,
                        backgroundColor: kSurfaceGrey,
                        color: kPrimary,
                      ),
                    ),
                  ),
                Text(
                  _statusText,
                  key: ValueKey('doc_status_${documentType.name}'),
                  style: TextStyle(
                    color: _statusColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (document?.reviewStatus ==
                        DriverDocumentReviewStatus.rejected &&
                    (document?.rejectionReason?.trim().isNotEmpty ?? false))
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      document!.rejectionReason!,
                      key: ValueKey('doc_rejection_reason_${documentType.name}'),
                      style: const TextStyle(
                        color: kError,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (_isUploading)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            TextButton(
              key: ValueKey(
                _isFailed
                    ? 'doc_retry_${documentType.name}'
                    : 'doc_upload_${documentType.name}',
              ),
              onPressed: onTap,
              child: Text(_actionLabel),
            ),
        ],
      ),
    );
  }
}
