import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/notification_log.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Consumer<NotificationsProvider>(
            builder: (context, provider, _) {
              return AgHeader(
                title: 'Bildirishnomalar',
                onBack: () => Navigator.of(context).pop(),
                trailing: GestureDetector(
                  onTap: provider.unreadCount == 0
                      ? null
                      : provider.markAllRead,
                  child: Text(
                    "O'qildi",
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: provider.unreadCount == 0 ? agMuted : agGreen,
                    ),
                  ),
                ),
              );
            },
          ),
          Expanded(
            child: Consumer<NotificationsProvider>(
              builder: (context, provider, _) {
                if (provider.state == NotificationsProviderState.loading &&
                    provider.notifications.isEmpty) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (provider.state == NotificationsProviderState.error &&
                    provider.notifications.isEmpty) {
                  return _ErrorState(
                    message: provider.error ?? 'Xatolik yuz berdi',
                    onRetry: provider.loadNotifications,
                  );
                }

                if (provider.notifications.isEmpty) {
                  return const _EmptyState();
                }

                return RefreshIndicator(
                  onRefresh: provider.loadNotifications,
                  color: agGreen,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                    itemCount: provider.notifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 11),
                    itemBuilder: (context, i) {
                      final n = provider.notifications[i];
                      return _NotificationCard(
                        notification: n,
                        onTap: () =>
                            context.read<NotificationsProvider>().markRead(n.id),
                      );
                    },
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

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final NotificationLog notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: agCardShadow,
          border: !notification.read
              ? const Border(left: BorderSide(color: agGreen, width: 3))
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: notification.iconBgColor,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(
                notification.icon,
                color: notification.iconColor,
                size: 23,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: agText,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notification.body,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: agSubtle,
                      fontWeight: FontWeight.w500,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    Formatters.formatRelativeTime(notification.createdAt),
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: agMuted,
                      fontWeight: FontWeight.w600,
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

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.notifications_none_rounded,
            size: 56,
            color: agMuted,
          ),
          SizedBox(height: 12),
          Text(
            "Hozircha bildirishnomalar yo'q",
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: agSubtle,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, size: 48, color: agRed),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: agSubtle,
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextButton(
            onPressed: onRetry,
            child: const Text(
              'Qayta urinish',
              style: TextStyle(color: agGreen, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
