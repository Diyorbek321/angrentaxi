import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/support/support_provider.dart';
import 'package:angren_taxi/shared/models/support_message.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final provider = context.read<SupportProvider>();
      await provider.loadThread();
      if (!mounted) return;
      await provider.markRead();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    context.read<SupportProvider>().sendMessage(text);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: SafeArea(
        child: Column(
          children: [
            AgHeader(
                title: 'Operator bilan chat',
                onBack: () => Navigator.of(context).pop()),
            Expanded(
              child: Consumer<SupportProvider>(
                builder: (context, provider, _) {
                  if (provider.state == SupportProviderState.loading &&
                      provider.messages.isEmpty) {
                    return const LoadingWidget(message: 'Yuklanmoqda...');
                  }

                  if (provider.state == SupportProviderState.error &&
                      provider.messages.isEmpty) {
                    return AppErrorWidget(
                      message: provider.error ?? 'Xatolik yuz berdi',
                      onRetry: provider.loadThread,
                    );
                  }

                  if (provider.messages.isEmpty) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          "Xabar yozing — operatorlarimiz 24/7 yordam berishga tayyor",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: agSubtle, fontWeight: FontWeight.w600),
                        ),
                      ),
                    );
                  }

                  return ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.all(16),
                    itemCount: provider.messages.length,
                    itemBuilder: (context, index) {
                      final message = provider
                          .messages[provider.messages.length - 1 - index];
                      return _MessageBubble(message: message);
                    },
                  );
                },
              ),
            ),
            _Composer(controller: _controller, onSend: _send),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final SupportMessage message;

  @override
  Widget build(BuildContext context) {
    final fromOperator = message.isFromOperator;

    return Align(
      alignment: fromOperator ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: fromOperator ? agSurface : agGreen,
          borderRadius: BorderRadius.circular(16),
          boxShadow: agCardShadow,
        ),
        child: Text(
          message.body,
          style: TextStyle(
            color: fromOperator ? agText : Colors.white,
            fontWeight: FontWeight.w600,
            fontSize: 14.5,
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend});

  final TextEditingController controller;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: [
          BoxShadow(
              color: agInk.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, -4)),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: 'Xabar yozing...',
                hintStyle: const TextStyle(color: agMuted),
                filled: true,
                fillColor: agBg,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: onSend,
            child: Container(
              width: 44,
              height: 44,
              decoration:
                  const BoxDecoration(gradient: agCta, shape: BoxShape.circle),
              child:
                  const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
