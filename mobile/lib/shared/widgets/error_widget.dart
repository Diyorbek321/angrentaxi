import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

class AppErrorWidget extends StatelessWidget {
  const AppErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Qayta urinish',
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 64, color: kError),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(fontSize: 16, color: kTextPrimary),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: 180,
                child: AppButton(label: retryLabel, onPressed: onRetry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class InlineErrorWidget extends StatelessWidget {
  const InlineErrorWidget({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kError.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kError.withAlpha(80)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: kError, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: kError, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
