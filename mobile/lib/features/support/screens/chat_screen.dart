import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/support/support_provider.dart';
import 'package:angren_taxi/shared/models/support_message.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
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
                    return const AppSkeletonList(
                      itemCount: 4,
                      hasLeading: false,
                      lines: 2,
                    );
                  }

                  if (provider.state == SupportProviderState.error &&
                      provider.messages.isEmpty) {
                    return AppErrorState(
                      message: provider.error ?? 'Xatolik yuz berdi',
                      onRetry: provider.loadThread,
                    );
                  }

                  if (provider.messages.isEmpty) {
                    return const AppEmptyState(
                      icon: Icons.forum_outlined,
                      title:
                          "Xabar yozing — operatorlarimiz 24/7 yordam berishga tayyor",
                    );
                  }

                  return ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.all(kSpace4),
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
        margin: const EdgeInsets.only(bottom: kSpace2),
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace3,
          vertical: kSpace2,
        ),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          // O'z xabaring — `kPrimary` + oq matn (5.38:1). Ilgari `agGreen`
          // (#10A064) oq matn bilan atigi 3.3:1 berardi.
          color: fromOperator ? agSurface2 : agPrimary,
          borderRadius: BorderRadius.circular(kRadiusMd),
          boxShadow: fromOperator ? agCardShadow : null,
        ),
        child: Text(
          message.body,
          style: TextStyle(
            color: fromOperator ? agInk : agOnPrimary,
            fontWeight: FontWeight.w600,
            fontSize: kFontBody,
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
      padding: const EdgeInsets.fromLTRB(
        kSpace3,
        kSpace2,
        kSpace3,
        kSpace2,
      ),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: agSoftShadow,
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
                hintStyle: const TextStyle(color: agSubtle),
                filled: true,
                fillColor: agSurface2,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: kSpace4,
                  vertical: kSpace3,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(kRadiusLg),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(kRadiusLg),
                  borderSide: const BorderSide(color: kFocusRing, width: 2),
                ),
              ),
            ),
          ),
          const SizedBox(width: kSpace2),
          Semantics(
            button: true,
            label: 'Yuborish',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onSend,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: kMinTapTarget,
                height: kMinTapTarget,
                decoration: const BoxDecoration(
                  gradient: agCta,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.send_rounded,
                    color: agOnPrimary, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
