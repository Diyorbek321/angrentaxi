import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';

/// Qatnovdagi bitta yo'lovchi — haydovchi uni bir qarashda o'qishi kerak:
/// ism, nechta joy, qayerdan olinadi (yo'lda — qayerga tushadi) va SHU
/// lahzada mumkin bo'lgan amal(lar). Amal tugmalari haydovchi o'lchamida
/// (`kControlHeightDriver`) — harakatdagi qo'l kichik nishonni topolmaydi.
class IntercityRunPassengerCard extends StatelessWidget {
  const IntercityRunPassengerCard({
    super.key,
    required this.booking,
    required this.tripStatus,
    required this.busy,
    required this.onArrived,
    required this.onNoShow,
    required this.onDropOff,
    required this.onCall,
    this.sequence,
    this.etaMinutes,
    this.onNavigate,
  });

  final IntercityDriverBooking booking;
  final String tripStatus;
  final bool busy;
  final VoidCallback onArrived;
  final VoidCallback onNoShow;
  final VoidCallback onDropOff;
  final ValueChanged<String> onCall;

  /// Bekatlar rejasidagi tartib raqami (1, 2, 3…); rejasiz — null.
  final int? sequence;

  /// Oldingi bekatdan taxminiy daqiqa.
  final int? etaMinutes;

  /// Faqat KEYINGI bekatda — tashqi navigatorni ochadi.
  final VoidCallback? onNavigate;

  bool get _boarding => tripStatus == IntercityTripStatus.boarding;
  bool get _onTheRoad => tripStatus == IntercityTripStatus.inProgress;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final b = booking;
    final id = b.orderId;
    final phone = b.passengerPhone;
    final address = _onTheRoad ? b.dropoffAddress : b.pickupAddress;
    // Hozirgi bosqichga tegishli davom: yig'ishda — olish tomoni, yo'lda —
    // tushirish tomoni. Haydovchi "nega summa ko'p" ni shu qatordan biladi.
    final extension = b.extensions
        .where((c) => c.isDropoff == _onTheRoad)
        .firstOrNull;

    return Padding(
      padding: const EdgeInsets.only(bottom: kSpace3),
      child: Opacity(
        opacity: b.isLive ? 1 : 0.55,
        child: AgSurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (sequence != null && b.isLive) ...[
                    _SequenceDot(sequence: sequence!),
                    const SizedBox(width: kSpace2),
                  ],
                  Expanded(
                    child: Text(
                      b.passengerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: kFontBodyLg,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                  ),
                  if (phone != null && b.isLive)
                    IconButton(
                      key: ValueKey('ic_run_call_$id'),
                      tooltip: l10n.icRunCall,
                      iconSize: 28,
                      onPressed: () => onCall(phone),
                      icon: const Icon(Icons.call_rounded, color: kInk),
                    ),
                ],
              ),
              const SizedBox(height: kSpace1),
              // `Wrap`: tor ekran yoki katta shriftda belgi keyingi qatorga
              // o'tadi — `Row` bo'lsa toshib chiqardi.
              Wrap(
                spacing: kSpace2,
                runSpacing: kSpace1,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  AppStatusBadge(
                    label: b.status == 'arrived' && _boarding
                        ? l10n.icRunPickedUp
                        : intercityBookingStatusLabel(b.status),
                    tone: _tone(b.status),
                    dense: true,
                  ),
                  Text(
                    b.isWholeCar
                        ? l10n.icRunWholeCar
                        : l10n.icRunSeats(b.seats ?? 1),
                    style:
                        const TextStyle(fontSize: kFontLabel, color: kInkMuted),
                  ),
                  if (etaMinutes != null && b.isLive)
                    Text(
                      l10n.icRunEtaFromPrev(etaMinutes!),
                      key: ValueKey('ic_run_eta_$id'),
                      style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: kInk),
                    ),
                ],
              ),
              if (address != null) ...[
                const SizedBox(height: kSpace1),
                Text(
                  address,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: kFontBody, color: kInk),
                ),
              ],
              if (extension != null) ...[
                const SizedBox(height: kSpace1),
                Text(
                  l10n.icRunExtension(
                    extension.km.toStringAsFixed(1),
                    extension.pointName,
                  ),
                  style: const TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w600,
                    color: kInkMuted,
                  ),
                ),
              ],
              if (onNavigate != null) ...[
                const SizedBox(height: kSpace2),
                SizedBox(
                  height: kControlHeightDriver,
                  child: OutlinedButton.icon(
                    key: ValueKey('ic_run_navigate_$id'),
                    onPressed: onNavigate,
                    icon: const Icon(Icons.navigation_rounded),
                    label: Text(l10n.icRunNavigate),
                  ),
                ),
              ],
              if (phone == null && b.isLive && !_onTheRoad) ...[
                const SizedBox(height: kSpace1),
                Text(
                  l10n.icRunPhoneLater,
                  style:
                      const TextStyle(fontSize: kFontCaption, color: kInkMuted),
                ),
              ],
              ..._actions(context),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _actions(BuildContext context) {
    final l10n = context.l10n;
    final id = booking.orderId;
    final status = booking.status;

    if (_boarding && (status == 'accepted' || status == 'arrived')) {
      return [
        const SizedBox(height: kSpace3),
        Row(
          children: [
            if (status == 'accepted') ...[
              Expanded(
                child: SizedBox(
                  height: kControlHeightDriver,
                  child: FilledButton(
                    key: ValueKey('ic_run_arrived_$id'),
                    onPressed: busy ? null : onArrived,
                    child: Text(l10n.icRunArrived),
                  ),
                ),
              ),
              const SizedBox(width: kSpace2),
            ],
            Expanded(
              child: SizedBox(
                height: kControlHeightDriver,
                child: OutlinedButton(
                  key: ValueKey('ic_run_noshow_$id'),
                  onPressed: busy ? null : onNoShow,
                  style: OutlinedButton.styleFrom(foregroundColor: kErrorDeep),
                  child: Text(l10n.icRunNoShow),
                ),
              ),
            ),
          ],
        ),
      ];
    }

    if (_onTheRoad && status == 'in_progress') {
      return [
        const SizedBox(height: kSpace2),
        Text(
          l10n.icRunCollectCash(Formatters.formatPrice(booking.price)),
          style: const TextStyle(
            fontSize: kFontBodyLg,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace2),
        SizedBox(
          height: kControlHeightDriver,
          child: FilledButton(
            key: ValueKey('ic_run_dropoff_$id'),
            onPressed: busy ? null : onDropOff,
            child: Text(l10n.icRunDropOff),
          ),
        ),
      ];
    }
    return const [];
  }

  static AppStatusTone _tone(String status) => switch (status) {
        'arrived' || 'in_progress' || 'completed' => AppStatusTone.success,
        'cancelled' => AppStatusTone.danger,
        'accepted' => AppStatusTone.info,
        _ => AppStatusTone.neutral,
      };
}

/// Bekat tartib raqami — haydovchi "kim keyingi" ni bir qarashda ko'rsin.
class _SequenceDot extends StatelessWidget {
  const _SequenceDot({required this.sequence});

  final int sequence;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
      child: Text(
        '$sequence',
        style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w800, color: kOnPrimary),
      ),
    );
  }
}

