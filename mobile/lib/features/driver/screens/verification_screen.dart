import 'dart:io';

import 'package:angren_taxi/core/config/app_platform.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_verification.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

// ============================================================================
// HAYDOVCHI TEKSHIRUVI EKRANI.
//
// ⚠️ BU EKRANDA TALABLAR RO'YXATI YO'Q — u butunlay serverdan keladi
// (`GET /drivers/me/verification`). Ekran hech narsa taxmin qilmaydi:
// nomi ham, izohi ham, tartibi ham serverniki. Yangi talab qo'shilganda
// bu fayl O'ZGARMAYDI va yangi APK kerak bo'lmaydi.
//
// Solishtiring: driver_onboarding_screen.dart dagi `_kDriverDocumentTypes`
// — aynan shu naqshdan voz kechildi.
//
// To'rt holat to'liq qoplangan:
//   yuklanmoqda → skeleton
//   xato        → `AppErrorState` + "Qayta urinish"
//   bo'sh       → `AppEmptyState` (bu NORMAL holat, xato EMAS)
//   ro'yxat     → elementlar
// ============================================================================

class DriverVerificationScreen extends StatefulWidget {
  const DriverVerificationScreen({super.key});

  @override
  State<DriverVerificationScreen> createState() =>
      _DriverVerificationScreenState();
}

class _DriverVerificationScreenState extends State<DriverVerificationScreen> {
  // Testlar tanlangan faylni `ImagePickerPlatform.instance` ni almashtirib
  // soxtalashtiradi (image_picker paketi rasman shuni tavsiya qiladi),
  // shuning uchun bu yerda oddiy `ImagePicker` qoladi.
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<DriverProvider>().loadDriverVerification(),
    );
  }

  Future<void> _pickAndUpload(DriverVerificationItem item) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: kSpace2),
            Text(
              item.label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: kFontTitle,
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
            const SizedBox(height: kSpace2),
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
            const SizedBox(height: kSpace2),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picked = await _picker.pickImage(source: source, imageQuality: 85);
    if (picked == null || !mounted) return;

    await context
        .read<DriverProvider>()
        .uploadVerificationItem(item.code, File(picked.path));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tekshiruv')),
      body: Consumer<DriverProvider>(
        builder: (context, driverProvider, _) {
          return RefreshIndicator(
            onRefresh: driverProvider.loadDriverVerification,
            child: _buildBody(driverProvider),
          );
        },
      ),
    );
  }

  Widget _buildBody(DriverProvider driverProvider) {
    final verification = driverProvider.verification;

    // Birinchi yuklanish — ekranda hali hech narsa yo'q. Keyingi
    // yangilanishlarda (pull-to-refresh) mavjud ro'yxat o'rnida qoladi,
    // aks holda ro'yxat ko'z oldida yo'qolib-paydo bo'lardi.
    if (driverProvider.isLoadingVerification && verification.isEmpty) {
      return const _VerificationSkeleton();
    }

    final error = driverProvider.verificationError;
    if (error != null && verification.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: kSpace10),
          AppErrorState(
            message: error,
            onRetry: driverProvider.loadDriverVerification,
          ),
        ],
      );
    }

    if (verification.isEmpty) {
      // ⚠️ BO'SH RO'YXAT — XATO EMAS. Server "sizdan hech narsa talab
      // qilinmayapti" deyishi mutlaqo normal holat.
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: kSpace10),
          AppEmptyState(
            key: ValueKey('verification_empty'),
            icon: Icons.verified_outlined,
            title: 'Talab yo\'q',
            message:
                'Hozircha sizdan hech qanday hujjat yoki surat talab qilinmayapti. '
                'Yangi talab paydo bo\'lsa shu yerda ko\'rinadi.',
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
      children: [
        if (!verification.canGoOnline)
          Padding(
            padding: const EdgeInsets.only(bottom: kSpace4),
            child: _VerificationBanner(
              key: const ValueKey('verification_blocked_banner'),
              tone: AppStatusTone.danger,
              icon: Icons.block_rounded,
              title: "Onlayn bo'lish yopiq",
              message: verification.blockedReason ??
                  "Tekshiruv to'liq emas — quyidagi talablarni bajaring.",
            ),
          )
        else if (verification.hasDueSoon)
          const Padding(
            padding: EdgeInsets.only(bottom: kSpace4),
            child: _VerificationBanner(
              key: ValueKey('verification_due_soon_banner'),
              tone: AppStatusTone.warning,
              icon: Icons.schedule_rounded,
              title: 'Muddat yaqinlashmoqda',
              // Bloklamaydi — haydovchi ishlashda davom etadi.
              message: 'Ba\'zi hujjatlarning muddati tugayapti. '
                  'Ishingiz to\'xtab qolmasligi uchun oldindan yangilang.',
            ),
          ),
        for (final item in verification.items)
          Padding(
            padding: const EdgeInsets.only(bottom: kSpace3),
            child: _VerificationItemCard(
              item: item,
              uploadState:
                  driverProvider.verificationUploadStateFor(item.code),
              onUpload: () => _pickAndUpload(item),
            ),
          ),
      ],
    );
  }
}

class _VerificationSkeleton extends StatelessWidget {
  const _VerificationSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      physics: AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.all(kSpace4),
      child: AppSkeletonGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppSkeleton(width: 200, height: 18),
            SizedBox(height: kSpace5),
            AppSkeletonTile(),
            SizedBox(height: kSpace3),
            AppSkeletonTile(),
            SizedBox(height: kSpace3),
            AppSkeletonTile(),
          ],
        ),
      ),
    );
  }
}

/// Ekran boshidagi ogohlantirish/blok banneri.
///
/// Ma'no faqat rangda emas: ikonka + sarlavha + matn birga keladi.
class _VerificationBanner extends StatelessWidget {
  const _VerificationBanner({
    super.key,
    required this.tone,
    required this.icon,
    required this.title,
    required this.message,
  });

  final AppStatusTone tone;
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final fg = tone.foreground;
    return Semantics(
      container: true,
      liveRegion: true,
      label: '$title. $message',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: tone.background,
          borderRadius: BorderRadius.circular(kRadiusMd),
          border: Border.all(color: fg.withValues(alpha: 0.24)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: fg, size: 22),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: fg,
                      fontSize: kFontBody,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: kSpace1),
                  Text(
                    message,
                    style: const TextStyle(
                      color: kInk,
                      fontSize: kFontLabel,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bitta talab: nomi, izohi, holati, muddati, rad etilgan bo'lsa sababi.
class _VerificationItemCard extends StatelessWidget {
  const _VerificationItemCard({
    required this.item,
    required this.uploadState,
    required this.onUpload,
  });

  final DriverVerificationItem item;
  final DriverDocumentUploadState uploadState;
  final VoidCallback onUpload;

  bool get _isUploading =>
      uploadState.status == DriverDocumentUploadStatus.uploading;
  bool get _isFailed =>
      uploadState.status == DriverDocumentUploadStatus.failed;

  String get _actionLabel {
    if (_isFailed) return 'Qayta urinish';
    if (item.status == DriverVerificationStatus.missing) return 'Yuklash';
    return 'Yangisini yuklash';
  }

  /// Muddat matni rangi: kechikkan bo'lsa xato, yaqin bo'lsa ogohlantirish.
  /// Rang YAGONA signal emas — matnning o'zi "kechikkan"/"qoldi" deb yozadi.
  Color get _deadlineColor {
    final days = item.daysLeft;
    if (days == null) return kInkMuted;
    if (days < 0) return kErrorDeep;
    if (days <= 7) return kWarningDeep;
    return kInkMuted;
  }

  @override
  Widget build(BuildContext context) {
    final deadline = item.deadlineText;
    return Container(
      key: ValueKey('verification_item_${item.code}'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Ikonka dekorativ — yonidagi serverdan kelgan nom ma'noni
              // to'liq beradi.
              ExcludeSemantics(
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: kSurface2,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(item.kind.icon, color: kInkMuted, size: 20),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label,
                      key: ValueKey('verification_label_${item.code}'),
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                    if (item.hint != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.hint!,
                        key: ValueKey('verification_hint_${item.code}'),
                        style: const TextStyle(
                          fontSize: kFontCaption,
                          color: kInkMuted,
                          height: 1.35,
                        ),
                      ),
                    ],
                    if (!item.isRequired) ...[
                      const SizedBox(height: 2),
                      const Text(
                        'Majburiy emas',
                        style: TextStyle(
                          fontSize: kFontMicro,
                          color: kInkSubtle,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace3),
          // Holat: ikonka + matn + rang (WCAG 1.4.1 — rang yolg'iz emas).
          Align(
            alignment: Alignment.centerLeft,
            child: AppStatusBadge(
              key: ValueKey('verification_status_${item.code}'),
              label: item.status.label,
              tone: item.status.tone,
              icon: item.status.icon,
              dense: true,
            ),
          ),
          if (deadline != null) ...[
            const SizedBox(height: kSpace2),
            Row(
              children: [
                ExcludeSemantics(
                  child: Icon(
                    Icons.event_outlined,
                    size: 14,
                    color: _deadlineColor,
                  ),
                ),
                const SizedBox(width: kSpace1 + 2),
                Flexible(
                  child: Text(
                    deadline,
                    key: ValueKey('verification_deadline_${item.code}'),
                    style: TextStyle(
                      fontSize: kFontCaption,
                      fontWeight: FontWeight.w700,
                      color: _deadlineColor,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (item.status == DriverVerificationStatus.rejected &&
              item.rejectionReason != null) ...[
            const SizedBox(height: kSpace3),
            InlineErrorWidget(
              key: ValueKey('verification_rejection_${item.code}'),
              message: item.rejectionReason!,
            ),
          ],
          if (_isFailed && uploadState.error != null) ...[
            const SizedBox(height: kSpace3),
            InlineErrorWidget(
              key: ValueKey('verification_upload_error_${item.code}'),
              message: uploadState.error!,
            ),
          ],
          const SizedBox(height: kSpace3),
          if (_isUploading)
            _UploadProgress(progress: uploadState.progress)
          // Harakat talab qiladigan element to'ldirilgan tugma oladi,
          // qolganlari konturli — ekranga kirgan haydovchi nimadan
          // boshlashini bir qarashda ko'radi.
          else if (item.status.needsAction || _isFailed)
            AppButton(
              key: ValueKey('verification_upload_${item.code}'),
              label: _actionLabel,
              height: kControlHeightSm,
              icon: const Icon(
                Icons.photo_camera_outlined,
                size: 18,
                color: kOnPrimary,
              ),
              semanticsLabel: '${item.label} — $_actionLabel',
              onPressed: onUpload,
            )
          else
            AppOutlinedButton(
              key: ValueKey('verification_upload_${item.code}'),
              label: _actionLabel,
              height: kControlHeightSm,
              icon: const Icon(
                Icons.photo_camera_outlined,
                size: 18,
                color: kInk,
              ),
              semanticsLabel: '${item.label} — $_actionLabel',
              onPressed: onUpload,
            ),
        ],
      ),
    );
  }
}

/// Yuklash jarayoni — progress bo'lsa aniq, bo'lmasa noaniq chiziq.
class _UploadProgress extends StatelessWidget {
  const _UploadProgress({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final percent = (progress * 100).clamp(0, 100).toStringAsFixed(0);
    return Semantics(
      container: true,
      liveRegion: true,
      label: 'Yuklanmoqda, $percent foiz',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(kRadiusXs),
            child: LinearProgressIndicator(
              value: progress > 0 ? progress : null,
              minHeight: 6,
              backgroundColor: kSurface2,
              color: kPrimary,
            ),
          ),
          const SizedBox(height: kSpace2),
          Row(
            children: [
              const AdaptiveProgress(size: 14, color: kInkMuted),
              const SizedBox(width: kSpace2),
              Text(
                'Yuklanmoqda... $percent%',
                style: const TextStyle(
                  fontSize: kFontCaption,
                  color: kInkMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
