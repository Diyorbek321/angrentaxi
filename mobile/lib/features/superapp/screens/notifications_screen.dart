import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/notification_log.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
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
              final enabled = provider.unreadCount != 0;
              return AgHeader(
                title: 'Bildirishnomalar',
                onBack: () => Navigator.of(context).pop(),
                trailing: Semantics(
                  button: true,
                  enabled: enabled,
                  label: "Barchasini o'qilgan deb belgilash",
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: enabled ? provider.markAllRead : null,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: kMinTapTarget,
                        minWidth: kMinTapTarget,
                      ),
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(left: kSpace3),
                      child: Text(
                        "O'qildi",
                        style: TextStyle(
                          fontSize: kFontLabel,
                          fontWeight: FontWeight.w700,
                          color: enabled ? agGreenText : agSubtle,
                        ),
                      ),
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
                  return const AppSkeletonList(
                    itemCount: 5,
                    lines: 3,
                    padding: EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
                  );
                }

                if (provider.state == NotificationsProviderState.error &&
                    provider.notifications.isEmpty) {
                  return AppErrorState(
                    message: provider.error ?? 'Xatolik yuz berdi',
                    onRetry: provider.loadNotifications,
                  );
                }

                if (provider.notifications.isEmpty) {
                  return const AppEmptyState(
                    icon: Icons.notifications_none_rounded,
                    title: "Hozircha bildirishnomalar yo'q",
                  );
                }

                return RefreshIndicator(
                  onRefresh: provider.loadNotifications,
                  color: agPrimary,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
                    itemCount: provider.notifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
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
    final unread = !notification.read;
    return Semantics(
      button: true,
      label: unread
          ? "O'qilmagan: ${notification.title}"
          : notification.title,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.all(kSpace4),
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agCardShadow,
            border: unread
                ? const Border(left: BorderSide(color: kMintDeep, width: 3))
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
                  borderRadius: BorderRadius.circular(kRadiusSm),
                ),
                child: Icon(
                  notification.icon,
                  color: notification.iconColor,
                  size: 23,
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontBody,
                        color: agText,
                      ),
                    ),
                    const SizedBox(height: kSpace1),
                    Text(
                      notification.body,
                      style: const TextStyle(
                        fontSize: kFontCaption,
                        color: agSubtle,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: kSpace2),
                    Text(
                      Formatters.formatRelativeTime(notification.createdAt),
                      style: const TextStyle(
                        fontSize: kFontMicro,
                        color: agSubtle,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
