import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Receipt for a single taxi/cargo order.
///
/// This screen used to render a fabricated one: the fare was split into
/// "base = amount * 0.85" and a made-up service fee, and the driver block
/// always read "Bobur A. · 4.9 · Cobalt · 01 A 777 BB" no matter who actually
/// drove. Everything below now comes from the order the server returned, and
/// anything the server did not send is simply not shown.
class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.order});

  final Order order;

  double get _amount => order.actualPrice ?? order.estimatedPrice;

  bool get _isFinished =>
      order.status == OrderStatus.completed || order.status == OrderStatus.cancelled;

  bool get _isCancelled => order.status == OrderStatus.cancelled;

  /// Reuses the shared status labels rather than restating them, so a status
  /// reads identically here and on the passenger home screen.
  String get _statusLabel => order.status.label;

  @override
  Widget build(BuildContext context) {
    final driver = order.driver;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: '${order.pickup.address} → ${order.dropoff.address}',
            subtitle: Formatters.formatDateTime(order.createdAt),
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                _card(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: _isCancelled ? agBg : agTint,
                          borderRadius: BorderRadius.circular(kRadiusMd),
                        ),
                        child: ExcludeSemantics(
                          child: Icon(
                            _isCancelled
                                ? Icons.cancel_rounded
                                : (_isFinished
                                      ? Icons.check_circle_rounded
                                      : Icons.local_taxi_rounded),
                            color: _isCancelled ? agSubtle : agGreenText,
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
                              _statusLabel,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: kFontTitle,
                                color: agText,
                              ),
                            ),
                            if (_isCancelled && order.cancelReason != null)
                              Text(
                                order.cancelReason!,
                                style: const TextStyle(
                                  fontSize: kFontCaption,
                                  color: agSubtle,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: kSpace2),
                      Text(
                        Formatters.formatSom(_amount),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: kFontH2,
                          color: agText,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace4),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Point(
                        color: agGreenText,
                        label: 'Olib ketish',
                        value: order.pickup.address,
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: kSpace2),
                        child: Divider(color: agDivider, height: 1),
                      ),
                      _Point(
                        color: agText,
                        label: 'Manzil',
                        value: order.dropoff.address,
                      ),
                    ],
                  ),
                ),
                if (driver != null) ...[
                  const SizedBox(height: kSpace4),
                  _card(
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
                                driver.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: kFontBody,
                                  color: agText,
                                ),
                              ),
                              Text(
                                [
                                  if (driver.rating > 0)
                                    Formatters.formatRating(driver.rating),
                                  if (driver.carModel.isNotEmpty) driver.carModel,
                                  if (driver.carNumber.isNotEmpty) driver.carNumber,
                                ].join(' · '),
                                style: const TextStyle(
                                  fontSize: kFontCaption,
                                  color: agSubtle,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (driver.phone.isNotEmpty)
                          AgIconButton(
                            icon: Icons.call_rounded,
                            onTap: () => _callDriver(context, driver.phone),
                            semanticsLabel: 'Haydovchiga qo\'ng\'iroq qilish',
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: kSpace4),
                _card(
                  child: Column(
                    children: [
                      _Row(
                        label: 'Buyurtma raqami',
                        value: order.id.split('-').first.toUpperCase(),
                      ),
                      if (order.distanceKm != null)
                        _Row(
                          label: 'Masofa',
                          value: Formatters.formatDistance(order.distanceKm! * 1000),
                        ),
                      if (order.durationMin != null)
                        _Row(
                          label: 'Davomiyligi',
                          value: Formatters.formatDuration(order.durationMin!),
                        ),
                      if (order.completedAt != null)
                        _Row(
                          label: 'Yakunlandi',
                          value: Formatters.formatDateTime(order.completedAt!),
                        ),
                      // The total is the server's figure. There is no invented
                      // base/service-fee breakdown here: the backend records a
                      // single fare plus an optional promo discount, and
                      // showing a split it never sent would be fiction.
                      _Row(
                        label: 'Jami',
                        value: Formatters.formatSom(_amount),
                        emphasized: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _callDriver(BuildContext context, String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Qo\'ng\'iroq qilib bo\'lmadi')),
      );
    }
  }

  Widget _card({required Widget child}) => Container(
    padding: const EdgeInsets.all(kSpace4),
    decoration: BoxDecoration(
      color: agSurface,
      borderRadius: BorderRadius.circular(kRadiusLg),
      boxShadow: agCardShadow,
    ),
    child: child,
  );
}

class _Point extends StatelessWidget {
  const _Point({required this.color, required this.label, required this.value});

  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: ExcludeSemantics(
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: kFontMicro,
                  color: agSubtle,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: kFontBody,
                  color: agText,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.emphasized = false});

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: kFontBody,
              color: agSubtle,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: kFontBody,
              color: agText,
              fontWeight: emphasized ? FontWeight.w800 : FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
