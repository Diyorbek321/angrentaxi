import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/driver/vehicle_change_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/vehicle_change_request.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_text_field.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Mashinani almashtirish so'rovi.
///
/// Haydovchi yangi mashinani kiritadi, menejer tasdiqlaguncha profilda ESKI
/// mashina qoladi — yo'lovchiga aytiladigan davlat raqami tekshiruvsiz
/// o'zgarmasligi uchun. Ekran oxirgi so'rov holatini ham ko'rsatadi: kutilmoqda,
/// rad etildi (sababi bilan) yoki tasdiqlandi.
class VehicleChangeScreen extends StatefulWidget {
  const VehicleChangeScreen({super.key, required this.current, this.service});

  /// Hozirgi (tasdiqlangan) mashina — taqqoslash uchun ko'rsatiladi.
  final Driver? current;

  /// Testlar uchun almashtiriladi.
  final VehicleChangeService? service;

  @override
  State<VehicleChangeScreen> createState() => _VehicleChangeScreenState();
}

class _VehicleChangeScreenState extends State<VehicleChangeScreen> {
  late final VehicleChangeService _service =
      widget.service ?? VehicleChangeService(sl<ApiClient>());
  final _formKey = GlobalKey<FormState>();
  final _model = TextEditingController();
  final _number = TextEditingController();
  final _year = TextEditingController();

  VehicleChangeRequest? _latest;
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _model.dispose();
    _number.dispose();
    _year.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final latest = await _service.latest();
      if (!mounted) return;
      setState(() {
        _latest = latest;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final created = await _service.submit(
        carModel: _model.text,
        carNumber: _number.text,
        carYear: int.tryParse(_year.text.trim()),
      );
      if (!mounted) return;
      setState(() {
        _latest = created;
        _submitting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.drvVehicleRequestSent)),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitError = extractErrorMessage(e);
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.drvVehicleChangeTitle)),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_loadError != null) {
      return AppErrorWidget(message: _loadError!, onRetry: _load);
    }
    final latest = _latest;
    return ListView(
      padding: const EdgeInsets.all(kSpace4),
      children: [
        _CurrentCar(driver: widget.current),
        const SizedBox(height: kSpace4),
        if (latest != null) ...[
          _RequestStatusCard(request: latest),
          const SizedBox(height: kSpace4),
        ],
        if (latest == null || !latest.isPending) _buildForm(),
      ],
    );
  }

  Widget _buildForm() {
    final l10n = context.l10n;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.drvNewCar,
            style: const TextStyle(fontSize: kFontH3, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: kSpace3),
          AppTextField(
            controller: _model,
            label: l10n.drvCarModel,
            hint: l10n.drvCarModelHint,
            textInputAction: TextInputAction.next,
            validator: (v) => (v == null || v.trim().length < 2)
                ? l10n.drvCarModelRequired
                : null,
          ),
          const SizedBox(height: kSpace3),
          AppTextField(
            controller: _number,
            label: l10n.drvPlateNumber,
            hint: '01 A 123 BC',
            textInputAction: TextInputAction.next,
            inputFormatters: [
              LengthLimitingTextInputFormatter(20),
              _UpperCaseFormatter(),
            ],
            validator: (v) => (v == null || v.trim().length < 4)
                ? l10n.drvPlateRequired
                : null,
          ),
          const SizedBox(height: kSpace3),
          AppTextField(
            controller: _year,
            label: l10n.drvCarYearOptional,
            hint: '2021',
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(4),
            ],
            validator: (v) {
              if (v == null || v.trim().isEmpty) return null;
              final year = int.tryParse(v.trim());
              final max = DateTime.now().year + 1;
              if (year == null || year < 1990 || year > max) {
                return l10n.drvCarYearRange(max);
              }
              return null;
            },
          ),
          if (_submitError != null) ...[
            const SizedBox(height: kSpace3),
            Text(
              _submitError!,
              style: const TextStyle(color: kErrorDeep, fontSize: kFontLabel),
            ),
          ],
          const SizedBox(height: kSpace4),
          Text(
            l10n.drvVehicleChangeNote,
            style: const TextStyle(color: kInkMuted, fontSize: kFontLabel, height: 1.4),
          ),
          const SizedBox(height: kSpace4),
          AppButton(
            label: l10n.drvSendRequest,
            isLoading: _submitting,
            onPressed: _submitting ? null : _submit,
          ),
        ],
      ),
    );
  }
}

class _CurrentCar extends StatelessWidget {
  const _CurrentCar({required this.driver});

  final Driver? driver;

  @override
  Widget build(BuildContext context) {
    final d = driver;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const Icon(Icons.directions_car_outlined, color: kInkMuted),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.drvCurrentCar,
                  style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
                ),
                Text(
                  d == null || d.carModel.isEmpty
                      ? '—'
                      : '${d.carModel} · ${d.carNumber}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontTitle,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestStatusCard extends StatelessWidget {
  const _RequestStatusCard({required this.request});

  final VehicleChangeRequest request;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, IconData icon, String title) = switch (request.status) {
      VehicleChangeStatus.pending => (
          kInfoLight,
          kInfoDeep,
          Icons.hourglass_top_rounded,
          context.l10n.drvRequestPending,
        ),
      VehicleChangeStatus.approved => (
          kMintTint,
          kPrimary,
          Icons.check_circle_outline,
          context.l10n.drvRequestApproved,
        ),
      VehicleChangeStatus.rejected => (
          kErrorLight,
          kErrorDeep,
          Icons.cancel_outlined,
          context.l10n.drvRequestRejected,
        ),
    };
    return Semantics(
      container: true,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: fg),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(color: fg, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: kSpace1),
                  Text(
                    '${request.carModel} · ${request.carNumber}',
                    style: const TextStyle(color: kInk),
                  ),
                  if (request.status == VehicleChangeStatus.rejected &&
                      (request.reviewNote?.isNotEmpty ?? false)) ...[
                    const SizedBox(height: kSpace1),
                    Text(
                      context.l10n.drvReason(request.reviewNote!),
                      style: const TextStyle(color: kInk, fontSize: kFontLabel),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Davlat raqami doim katta harflarda saqlanadi — "01a123bc" va "01A123BC"
/// menejer ekranida ikki xil raqamdek ko'rinmasin.
class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}
