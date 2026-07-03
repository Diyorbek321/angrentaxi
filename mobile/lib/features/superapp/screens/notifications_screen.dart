import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const _items = [
    (Icons.redeem_rounded, agTint, agGreen, '−30% birinchi safaringizga', 'ANGREN30 promokodidan foydalaning', '5 daqiqa oldin', true),
    (Icons.local_taxi_rounded, agBg, agSubtle, 'Safaringiz yakunlandi', "Bobur A. · 18 000 so'm. Baholang!", 'Kecha, 18:24', false),
    (Icons.restaurant_rounded, agBg, agSubtle, 'Buyurtmangiz yetkazildi', 'Milliy Taomlar · Yoqimli ishtaha!', '24-iyun, 13:40', false),
    (Icons.account_balance_wallet_rounded, Color(0xFFEFF6FF), agBlue, "Hisob to'ldirildi", '+50 000 so\'m muvaffaqiyatli qo\'shildi', '24-iyun, 09:12', false),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: 'Bildirishnomalar',
            onBack: () => Navigator.of(context).pop(),
            trailing: const Text("O'qildi", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: agGreen)),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 11),
              itemBuilder: (context, i) {
                final n = _items[i];
                return Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: agCardShadow,
                    border: n.$7 ? const Border(left: BorderSide(color: agGreen, width: 3)) : null,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(color: n.$2, borderRadius: BorderRadius.circular(13)),
                        child: Icon(n.$1, color: n.$3, size: 23),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(n.$4, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
                            const SizedBox(height: 3),
                            Text(n.$5, style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.4)),
                            const SizedBox(height: 6),
                            Text(n.$6, style: const TextStyle(fontSize: 11.5, color: agMuted, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
