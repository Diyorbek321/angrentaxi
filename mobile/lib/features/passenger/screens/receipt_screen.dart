import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/lost_items/lost_items_service.dart';
import 'package:angren_taxi/features/passenger/widgets/receipt_widgets.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order_receipt.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/utils/receipt_formatter.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ============================================================================
// SAFAR CHEKI — `GET /orders/:id/receipt`.
//
// Bu ekranning yagona vazifasi: serverdan kelgan raqamlarni O'ZGARTIRMASDAN,
// foydalanuvchi qo'shib tekshira oladigan tartibda ko'rsatish.
//
// ⚠️ BU YERDA HECH QANDAY HISOB-KITOB YO'Q — bittadan tashqari:
// `OrderReceipt.grandTotal` (yo'l haqi + chaqim), chunki backend ularni
// ataylab alohida yuboradi. Narx tarkibi qatorlari serverda muzlatilgan va
// ular jonli tarifdan qayta hisoblanmaydi: tarif bir oydan keyin o'zgarsa,
// chek boshqa raqam ko'rsatib, hujjat yolg'on gapirgan bo'lardi.
//
// ⚠️ Tarkib bo'lmasa (eski safarlar) — SOXTA TARKIB CHIQMAYDI. Ekran buni
// ochiq aytadi va faqat jami / chegirma / yakuniyni ko'rsatadi.
//
// ⚠️ KUTISH QATORI NOL BO'LSA HAM CHIQADI (`fareLines`). Kutish — qat'iy
// narx kafolatidan tashqaridagi YAGONA qator, ya'ni yo'lovchi baholangandan
// ortiq to'laydigan yagona sabab. Shuning uchun chek uni yashirmaydi: "0 daq
// — 0 so'm" qatori "mendan qo'shimcha olishdimi?" savoliga hujjat bilan
// javob beradi.
// ============================================================================

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({
    super.key,
    required this.orderId,
    ApiClient? apiClient,
  }) : _apiClient = apiClient;

  final String orderId;

  /// Testda soxta mijoz berish uchun — ekran o'zi `sl<ApiClient>()` ga
  /// bog'lanib qolmasligi kerak.
  final ApiClient? _apiClient;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  late final ApiClient _apiClient = widget._apiClient ?? sl<ApiClient>();

  /// Safardan keyin 7 kun ichida (backend: LOST_ITEM_REPORT_WINDOW_DAYS) va
  /// faqat haydovchili safarda — xabar haydovchiga yuboriladi.
  bool _canReportLostItem(OrderReceipt receipt) {
    final completedAt = receipt.completedAt;
    if (completedAt == null || receipt.driver == null) return false;
    return DateTime.now().difference(completedAt) < const Duration(days: 7);
  }

  Future<void> _reportLostItem(OrderReceipt receipt) async {
    final controller = TextEditingController();
    final description = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.paxLostItemDialogTitle),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 500,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: context.l10n.paxLostItemDialogHint,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(context.l10n.paxCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: Text(context.l10n.paxSend),
          ),
        ],
      ),
    );
    if (!mounted || description == null || description.length < 3) return;
    final messenger = ScaffoldMessenger.of(context);
    final sentMessage = context.l10n.paxLostItemSent;
    try {
      await LostItemsService(_apiClient).report(
        orderId: receipt.orderId,
        description: description,
      );
      messenger.showSnackBar(SnackBar(
        content: Text(sentMessage),
      ));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(extractErrorMessage(e))));
    }
  }

  bool _loading = true;
  String? _error;

  /// 403 alohida holat: "qayta urinish" bu yerda foydasiz — huquq
  /// takrorlangan so'rovdan paydo bo'lmaydi. Shuning uchun u xato emas,
  /// tushuntirish sifatida ko'rsatiladi.
  bool _forbidden = false;

  OrderReceipt? _receipt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _forbidden = false;
    });

    try {
      final response = await _apiClient.get(
        ApiEndpoints.orderReceipt(widget.orderId),
      );
      // Global interceptor javobni `{success, data}` ga o'raydi — chek
      // maydonlari `data` ichida (backend/src/common/interceptors/
      // response.interceptor.ts).
      final body = response.data as Map<String, dynamic>;
      final receipt = OrderReceipt.fromJson(body['data'] as Map<String, dynamic>);
      if (!mounted) return;
      setState(() {
        _receipt = receipt;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _forbidden = e is DioException && e.response?.statusCode == 403;
        _error = _forbidden ? null : extractErrorMessage(e);
      });
    }
  }

  void _copyReceipt(OrderReceipt receipt) {
    Clipboard.setData(ClipboardData(text: receiptAsText(receipt)));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.paxReceiptTextCopied)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final receipt = _receipt;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: context.l10n.paxReceiptTitle,
            subtitle: receipt != null && receipt.orderNumber.isNotEmpty
                ? context.l10n.paxReceiptOrderNumber(receipt.orderNumber)
                : null,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(child: ResponsiveContent(child: _body(receipt))),
        ],
      ),
    );
  }

  Widget _body(OrderReceipt? receipt) {
    if (_loading) return const ReceiptSkeleton();

    if (_forbidden) {
      return AppEmptyState(
        icon: Icons.lock_outline_rounded,
        title: context.l10n.paxReceiptForbiddenTitle,
        message: context.l10n.paxReceiptForbiddenBody,
        actionLabel: context.l10n.paxBack,
        onAction: () => Navigator.of(context).pop(),
      );
    }

    if (_error != null) {
      return AppErrorState(message: _error!, onRetry: _load);
    }

    if (receipt == null) {
      return AppErrorState(
        message: context.l10n.paxReceiptParseError,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: kPrimary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
        children: [
          _HeaderCard(receipt: receipt),
          const SizedBox(height: kSpace4),
          _RouteCard(receipt: receipt),
          const SizedBox(height: kSpace4),
          _FareCard(receipt: receipt),
          const SizedBox(height: kSpace4),
          _PaymentCard(receipt: receipt),
          if (receipt.driver != null) ...[
            const SizedBox(height: kSpace4),
            _DriverCard(driver: receipt.driver!),
          ],
          const SizedBox(height: kSpace5),
          AppOutlinedButton(
            label: context.l10n.paxReferralCopy,
            icon: const Icon(Icons.copy_rounded, size: 18),
            onPressed: () => _copyReceipt(receipt),
            semanticsLabel: context.l10n.paxReceiptCopySemantics,
          ),
          if (_canReportLostItem(receipt)) ...[
            const SizedBox(height: kSpace3),
            AppOutlinedButton(
              label: context.l10n.paxLostItemButton,
              icon: const Icon(Icons.inventory_2_outlined, size: 18),
              onPressed: () => _reportLostItem(receipt),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Kartalar
// ---------------------------------------------------------------------------

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.receipt});

  final OrderReceipt receipt;

  @override
  Widget build(BuildContext context) {
    final serviceLabel = receiptServiceTypeLabel(receipt.serviceType);
    final status = receipt.paymentStatus;

    return ReceiptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: agTint,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
                child: const ExcludeSemantics(
                  child: Icon(
                    Icons.receipt_long_rounded,
                    color: agGreenText,
                    size: 25,
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.paxReceiptOrderNumberLabel,
                      style: const TextStyle(
                        fontSize: kFontMicro,
                        color: agSubtle,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      receipt.orderNumber.isEmpty ? '—' : receipt.orderNumber,
                      style: const TextStyle(
                        fontSize: kFontH2,
                        color: agText,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (status != null) ...[
                const SizedBox(width: kSpace2),
                AppStatusBadge(
                  label: status.label,
                  tone: receiptPaymentTone(status),
                  dense: true,
                ),
              ],
            ],
          ),
          const ReceiptDivider(),
          if (receipt.completedAt != null)
            ReceiptAmountRow(
              label: context.l10n.paxDetailDate,
              value: Formatters.formatDateTime(receipt.completedAt!),
            ),
          if (serviceLabel != null)
            ReceiptAmountRow(
              label: context.l10n.paxReceiptService,
              value: serviceLabel,
            ),
          if (receipt.tariffName != null)
            ReceiptAmountRow(
              label: context.l10n.paxReceiptTariff,
              value: receipt.tariffName!,
            ),
          if (receipt.distanceKm != null)
            ReceiptAmountRow(
              label: context.l10n.paxDetailDistance,
              value: Formatters.formatDistance(receipt.distanceKm! * 1000),
            ),
          if (receipt.durationMin != null)
            ReceiptAmountRow(
              label: context.l10n.paxReceiptDuration,
              value: Formatters.formatDuration(receipt.durationMin!),
            ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.receipt});

  final OrderReceipt receipt;

  @override
  Widget build(BuildContext context) {
    final waypoints = receipt.waypoints;

    return ReceiptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ReceiptRoutePoint(
            color: agGreenText,
            label: context.l10n.paxReceiptPickup,
            value: receipt.pickupAddress ?? context.l10n.paxReceiptAddressMissing,
          ),
          // Oraliq to'xtashlar chek marshrutining bir qismi — ular
          // ko'rsatilmasa, yo'lovchi "nega narx katta?" degan savolga
          // javobning yarmini yo'qotadi.
          for (var i = 0; i < waypoints.length; i++) ...[
            const ReceiptDivider(),
            ReceiptRoutePoint(
              color: agMuted,
              label: context.l10n.paxReceiptStop(i + 1),
              value: waypoints[i].address.isEmpty
                  ? context.l10n.paxReceiptAddressMissing
                  : waypoints[i].address,
            ),
          ],
          const ReceiptDivider(),
          ReceiptRoutePoint(
            color: agText,
            label: context.l10n.paxReceiptDropoff,
            value: receipt.dropoffAddress ?? context.l10n.paxReceiptAddressMissing,
          ),
        ],
      ),
    );
  }
}

class _FareCard extends StatelessWidget {
  const _FareCard({required this.receipt});

  final OrderReceipt receipt;

  @override
  Widget build(BuildContext context) {
    final fare = receipt.fare;

    // Chegirma va chaqim — jamini O'ZGARTIRADIGAN yagona qatorlar. Ular
    // bo'lmasa "Jami" va "Yakuniy" bir xil songa aylanadi va bitta raqamni
    // ikki marta yozish chekni tushunarli emas, shubhali qiladi.
    final hasAdjustments = receipt.discountAmount > 0 || receipt.tipAmount > 0;

    return ReceiptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.paxReceiptFareBreakdown,
            style: const TextStyle(
              fontSize: kFontTitle,
              color: agText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: kSpace3),

          if (fare == null) ...[
            // Eski safarlarda tarkib umuman saqlanmagan. Uni "asos = 85%,
            // xizmat haqi = 15%" qabilida o'ylab topish — foydalanuvchiga
            // yolg'on hujjat berish demak.
            ReceiptNotice(
              icon: Icons.info_outline_rounded,
              text: context.l10n.paxReceiptNoBreakdown,
            ),
          ] else ...[
            for (final line in fareLines(fare))
              ReceiptAmountRow(label: line.label, value: line.value),
            const SizedBox(height: kSpace2),
            // Kutish qatori chekda paydo bo'lgani uchun uning QOIDASI ham
            // shu yerda aytiladi. Buyurtma ekranidagi "narx belgilangan"
            // va'dasi bilan bu izoh BIR XIL ma'noni berishi shart — ikkalasi
            // ajralib ketsa, yo'lovchi va'da bilan chekni solishtirib
            // aldangandek his qiladi.
            ReceiptNotice(
              icon: Icons.timer_outlined,
              text: context.l10n.paxReceiptWaitingNote,
            ),
          ],

          if (hasAdjustments) ...[
            const ReceiptDivider(),
            ReceiptAmountRow(
              label: context.l10n.paxReceiptSubtotal,
              // Tarkib bo'lsa, yuqoridagi qatorlar AYNAN shu songa
              // qo'shiladi — backend invarianti (`fare-breakdown.ts`) buni
              // kafolatlaydi. Tarkib bo'lmasa, bu chegirmagacha bo'lgan
              // summa.
              value: formatSomRounded(fare?.total ?? receipt.grossPrice),
              emphasized: true,
            ),
            if (receipt.discountAmount > 0)
              ReceiptAmountRow(
                label: receipt.promoCode != null
                    ? context.l10n.paxReceiptDiscountWithCode(receipt.promoCode!)
                    : context.l10n.paxReceiptDiscount,
                value: '−${formatSomRounded(receipt.discountAmount)}',
                valueColor: agGreenText,
              ),
            if (receipt.tipAmount > 0)
              ReceiptAmountRow(
                label: context.l10n.paxReceiptTip,
                hint: context.l10n.paxReceiptTipHint,
                value: '+${formatSomRounded(receipt.tipAmount)}',
              ),
          ],

          const ReceiptDivider(),
          ReceiptAmountRow(
            label: context.l10n.paxReceiptGrandTotal,
            value: formatSomRounded(receipt.grandTotal),
            emphasized: true,
            large: true,
          ),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.receipt});

  final OrderReceipt receipt;

  @override
  Widget build(BuildContext context) {
    final method = receipt.paymentMethod;
    final status = receipt.paymentStatus;

    return ReceiptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.paxReceiptPayment,
            style: const TextStyle(
              fontSize: kFontTitle,
              color: agText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: kSpace3),
          if (method != null)
            ReceiptAmountRow(
              label: context.l10n.paxReceiptPaymentMethod,
              value: method.label,
            ),
          if (status != null)
            ReceiptAmountRow(
              label: context.l10n.paxReceiptPaymentStatus,
              value: status.label,
            ),
          if (method == null && status == null)
            ReceiptNotice(
              icon: Icons.info_outline_rounded,
              text: context.l10n.paxReceiptNoPaymentInfo,
            ),
          if (receipt.hasUnpaidAmount) ...[
            const SizedBox(height: kSpace3),
            // Qoldiq faqat rang bilan emas, ikona + matn + summa bilan
            // bildiriladi va nima qilish kerakligi aytiladi.
            ReceiptNotice(
              icon: Icons.warning_amber_rounded,
              tone: ReceiptNoticeTone.warning,
              text: context.l10n.paxReceiptUnpaid(
                formatSomRounded(receipt.unpaidAmount),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DriverCard extends StatelessWidget {
  const _DriverCard({required this.driver});

  final ReceiptDriver driver;

  @override
  Widget build(BuildContext context) {
    final car = [
      if (driver.carModel != null) driver.carModel!,
      if (driver.carNumber != null) driver.carNumber!,
    ].join(' · ');

    return ReceiptCard(
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: agBg,
              shape: BoxShape.circle,
            ),
            child: const ExcludeSemantics(
              child: Icon(Icons.person_rounded, color: agSubtle, size: 24),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.paxDetailDriver,
                  style: const TextStyle(
                    fontSize: kFontMicro,
                    color: agSubtle,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  driver.name,
                  style: const TextStyle(
                    fontSize: kFontBodyLg,
                    color: agText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (car.isNotEmpty)
                  Text(
                    car,
                    style: const TextStyle(
                      fontSize: kFontCaption,
                      color: agSubtle,
                      fontWeight: FontWeight.w600,
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
