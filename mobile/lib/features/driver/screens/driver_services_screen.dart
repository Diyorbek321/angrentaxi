import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/shared/models/driver_service.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// XIZMAT TURLARINI TANLASH EKRANI.
//
// ⚠️ RO'YXAT BU YERDA YO'Q — u butunlay serverdan keladi
// (`GET /drivers/me/services`). Nom ham, izoh ham, bloklanish sababi ham
// serverniki: tekshiruv ekranidagi (verification_screen.dart) naqshning
// aynan o'zi. Yangi vertikal qo'shilganda bu fayl O'ZGARMAYDI.
//
// NEGA BU EKRAN UMUMAN KERAK: matching xizmat turi bo'yicha filtrlaydi,
// migratsiya esa barcha haydovchilarga faqat `taxi` yozgan. Haydovchi
// o'zi tanlay olmasa, ovqat va market buyurtmalari HECH KIMGA mos
// kelmaydi va 60 soniyadan keyin "haydovchi topilmadi" ga tushadi.
//
// To'rt holat to'liq qoplangan:
//   yuklanmoqda → skeleton
//   xato        → `AppErrorState` + "Qayta urinish"
//   bo'sh       → `AppEmptyState` (server hech narsa taklif qilmadi)
//   ro'yxat     → elementlar + "Saqlash"
// ============================================================================

/// Hech narsa tanlanmaganda saqlashga YO'L QO'YILMAYDI.
///
/// Bu shunchaki validatsiya emas: bo'sh ro'yxat bilan haydovchiga hech
/// qanday buyurtma kelmaydi va u buni sababini bilmay smenani bekorga
/// o'tkazadi. Server ham bunga ruxsat bermaydi — lekin haydovchi xatoni
/// tarmoqqa chiqmasdan, DARHOL ko'rishi kerak.
const String kDriverServicesEmptySelectionError =
    "Kamida bitta xizmat turi yoqilgan bo'lishi kerak — aks holda sizga "
    'buyurtma kelmaydi.';

class DriverServicesScreen extends StatefulWidget {
  const DriverServicesScreen({super.key});

  @override
  State<DriverServicesScreen> createState() => _DriverServicesScreenState();
}

class _DriverServicesScreenState extends State<DriverServicesScreen> {
  /// Haydovchining hali SAQLANMAGAN tanlovi.
  ///
  /// `null` — ro'yxat hali kelmagan. Serverdagi holatdan alohida turadi:
  /// bir nechta turni birdaniga yoqib, keyin bitta so'rov bilan saqlash
  /// mumkin bo'lsin.
  Set<String>? _draft;

  /// Mijoz tomonida topilgan xato (bo'sh tanlov). Server xatosi alohida —
  /// u `DriverProvider.servicesSaveError` da.
  String? _localError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final provider = context.read<DriverProvider>();
    // Tekshiruv ro'yxati ham kerak: `missingRequirements` faqat `code`
    // qiymatlarini beradi, ularning O'ZBEKCHA NOMI esa tekshiruv
    // javobida turadi. Mobil tomonda kod→nom jadvali YO'Q.
    await Future.wait([
      provider.loadDriverServices(),
      provider.loadDriverVerification(),
    ]);
    if (!mounted) return;
    _syncDraft(provider.services);
  }

  void _syncDraft(DriverServices services) {
    setState(() {
      _draft = {
        for (final option in services.options)
          if (option.enabled) option.serviceType,
      };
      _localError = null;
    });
  }

  bool _isSelected(DriverServiceOption option) =>
      _draft?.contains(option.serviceType) ?? option.enabled;

  bool _hasChanges(DriverServices services) {
    final draft = _draft;
    if (draft == null) return false;
    final saved = {
      for (final option in services.options)
        if (option.enabled) option.serviceType,
    };
    return draft.length != saved.length || !draft.containsAll(saved);
  }

  void _toggle(DriverServiceOption option, bool value) {
    final draft = _draft;
    if (draft == null) return;
    setState(() {
      // Yangi to'plam quriladi, mavjudi joyida o'zgartirilmaydi — tanlov
      // holati faqat `setState` orqali almashsin.
      _draft = value
          ? {...draft, option.serviceType}
          : {
              for (final type in draft)
                if (type != option.serviceType) type,
            };
      _localError = null;
    });
    // Eski server sababi yangi tanlovga taalluqli emas.
    context.read<DriverProvider>().clearServicesSaveError();
  }

  Future<void> _save(DriverServices services) async {
    final draft = _draft;
    if (draft == null) return;

    if (draft.isEmpty) {
      setState(() => _localError = kDriverServicesEmptySelectionError);
      return;
    }

    setState(() => _localError = null);
    final provider = context.read<DriverProvider>();
    // Tartib serverdan kelgan ro'yxat bo'yicha — so'rov tanasi
    // takrorlanuvchan (deterministik) bo'lsin.
    final ordered = [
      for (final option in services.options)
        if (draft.contains(option.serviceType)) option.serviceType,
    ];
    final saved = await provider.updateDriverServices(ordered);
    if (!mounted) return;

    if (saved) {
      _syncDraft(provider.services);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Xizmat turlari saqlandi'),
          backgroundColor: kPrimary,
        ),
      );
    }
    // Xato bo'lsa `provider.servicesSaveError` ro'yxat tepasida ko'rinadi.
  }

  /// `missingRequirements` kodlarini tekshiruv ro'yxatidagi SERVER bergan
  /// nomlarga aylantiradi. Topilmagan kod umuman ko'rsatilmaydi — xom
  /// `thermal_bag_photo` ni haydovchiga ko'rsatishdan ko'ra jim qolgan
  /// afzal, sababni `blockedReason` baribir o'zbekcha aytadi.
  List<String> _requirementLabels(
    DriverProvider provider,
    DriverServiceOption option,
  ) {
    final labels = <String>[];
    for (final code in option.missingRequirements) {
      for (final item in provider.verification.items) {
        if (item.code == code) {
          labels.add(item.label);
          break;
        }
      }
    }
    return labels;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Xizmat turlari')),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) => RefreshIndicator(
          onRefresh: _load,
          child: _buildBody(provider),
        ),
      ),
      bottomNavigationBar: Consumer<DriverProvider>(
        builder: (context, provider, _) => _buildSaveBar(provider),
      ),
    );
  }

  Widget _buildBody(DriverProvider provider) {
    final services = provider.services;

    // Birinchi yuklash — ekranda hali hech narsa yo'q. Keyingi
    // yangilanishlarda mavjud ro'yxat o'rnida qoladi.
    if (provider.isLoadingServices && services.isEmpty) {
      return const _ServicesSkeleton();
    }

    final error = provider.servicesError;
    if (error != null && services.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: kSpace10),
          AppErrorState(message: error, onRetry: _load),
        ],
      );
    }

    if (services.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: kSpace10),
          AppEmptyState(
            key: ValueKey('driver_services_empty'),
            icon: Icons.category_outlined,
            title: 'Xizmat turi yo\'q',
            message: 'Hozircha sizga hech qanday xizmat turi taklif '
                'qilinmayapti. Yangisi paydo bo\'lsa shu yerda ko\'rinadi.',
          ),
        ],
      );
    }

    final saveError = provider.servicesSaveError ?? _localError;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
      children: [
        const Text(
          'Qaysi buyurtmalarni olasiz',
          style: TextStyle(
            fontSize: kFontH3,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace1),
        const Text(
          'Faqat yoqilgan turlar bo\'yicha buyurtma keladi. Talablari '
          'bajarilmagan turni yoqib bo\'lmaydi.',
          style: TextStyle(
            fontSize: kFontLabel,
            color: kInkMuted,
            height: 1.4,
          ),
        ),
        const SizedBox(height: kSpace4),
        if (saveError != null) ...[
          InlineErrorWidget(
            key: const ValueKey('driver_services_save_error'),
            message: saveError,
          ),
          const SizedBox(height: kSpace4),
        ],
        for (final option in services.options)
          Padding(
            padding: const EdgeInsets.only(bottom: kSpace3),
            child: _ServiceOptionCard(
              option: option,
              selected: _isSelected(option),
              requirementLabels: _requirementLabels(provider, option),
              onChanged: (value) => _toggle(option, value),
              onOpenVerification: () =>
                  Navigator.of(context).pushNamed('/driver/verification'),
            ),
          ),
      ],
    );
  }

  /// Saqlash paneli — faqat ro'yxat bor va o'zgargan holatda.
  Widget _buildSaveBar(DriverProvider provider) {
    final services = provider.services;
    if (services.isEmpty || !_hasChanges(services)) {
      return const SizedBox.shrink();
    }
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
      child: AppButton(
        key: const ValueKey('driver_services_save'),
        label: 'Saqlash',
        isLoading: provider.isSavingServices,
        onPressed: () => _save(services),
      ),
    );
  }
}

class _ServicesSkeleton extends StatelessWidget {
  const _ServicesSkeleton();

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
            AppSkeletonTile(hasTrailing: true),
            SizedBox(height: kSpace3),
            AppSkeletonTile(hasTrailing: true),
            SizedBox(height: kSpace3),
            AppSkeletonTile(hasTrailing: true),
          ],
        ),
      ),
    );
  }
}

/// Bitta xizmat turi: nomi, izohi, yoqish tugmasi va bloklangan bo'lsa —
/// sababi bilan tekshiruvga o'tish yo'li.
class _ServiceOptionCard extends StatelessWidget {
  const _ServiceOptionCard({
    required this.option,
    required this.selected,
    required this.requirementLabels,
    required this.onChanged,
    required this.onOpenVerification,
  });

  final DriverServiceOption option;
  final bool selected;
  final List<String> requirementLabels;
  final ValueChanged<bool> onChanged;
  final VoidCallback onOpenVerification;

  /// Bloklangan tur — sababi ko'rsatiladi va yoqib bo'lmaydi.
  bool get _isBlocked => !option.canEnable;

  @override
  Widget build(BuildContext context) {
    // ⚠️ Yoqilgan turni O'CHIRISH bloklangan holatda ham mumkin —
    // shared/models/driver_service.dart dagi `isInteractive` izohiga qarang.
    final interactive = option.isInteractive;
    // Ikonka DEKORATIV: noma'lum tur uchun taksi ikonasini qo'yish yolg'on
    // bo'lardi, shuning uchun neytral zaxira ishlatiladi.
    final icon = DriverServiceWording.lookup(option.serviceType)?.icon ??
        Icons.category_rounded;

    return Container(
      key: ValueKey('service_item_${option.serviceType}'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: selected ? kPrimary : kLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: selected ? kMintTint : kSurface2,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(
                    icon,
                    color: selected ? kPrimary : kInkMuted,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.label,
                      key: ValueKey('service_label_${option.serviceType}'),
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                    if (option.description != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        option.description!,
                        key: ValueKey(
                          'service_description_${option.serviceType}',
                        ),
                        style: const TextStyle(
                          fontSize: kFontCaption,
                          color: kInkMuted,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: kSpace2),
              Semantics(
                toggled: selected,
                enabled: interactive,
                label: option.label,
                // Ekran o'quvchi tugma NEGA bosilmasligini aytsin.
                hint: interactive ? null : option.blockedReason,
                excludeSemantics: true,
                child: Switch(
                  key: ValueKey('service_toggle_${option.serviceType}'),
                  value: selected,
                  onChanged: interactive ? onChanged : null,
                  activeColor: kOnPrimary,
                  activeTrackColor: kPrimary,
                ),
              ),
            ],
          ),
          if (_isBlocked) ...[
            const SizedBox(height: kSpace3),
            _BlockedNotice(
              key: ValueKey('service_blocked_${option.serviceType}'),
              reason: option.blockedReason ??
                  "Bu turni yoqish uchun tekshiruv talablari bajarilishi kerak.",
              requirementLabels: requirementLabels,
              onOpenVerification: onOpenVerification,
            ),
          ],
        ],
      ),
    );
  }
}

/// Bloklangan tur uchun sabab + tekshiruvga o'tish.
///
/// Ma'no faqat rangda emas: ikonka + matn + harakat birga keladi
/// (WCAG 1.4.1).
class _BlockedNotice extends StatelessWidget {
  const _BlockedNotice({
    super.key,
    required this.reason,
    required this.requirementLabels,
    required this.onOpenVerification,
  });

  final String reason;
  final List<String> requirementLabels;
  final VoidCallback onOpenVerification;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kWarningDeep.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.lock_outline_rounded,
                    color: kWarningDeep, size: 18),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  reason,
                  style: const TextStyle(
                    fontSize: kFontCaption,
                    color: kInk,
                    height: 1.35,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (requirementLabels.isNotEmpty) ...[
            const SizedBox(height: kSpace2),
            Text(
              'Kerak: ${requirementLabels.join(', ')}',
              style: const TextStyle(
                fontSize: kFontCaption,
                color: kInkMuted,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: kSpace3),
          AppOutlinedButton(
            label: 'Tekshiruvni ochish',
            height: kControlHeightSm,
            onPressed: onOpenVerification,
            icon: const Icon(Icons.verified_outlined, size: 18, color: kInk),
          ),
        ],
      ),
    );
  }
}
