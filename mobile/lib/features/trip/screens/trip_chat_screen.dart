import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/trip/trip_chat_provider.dart';
import 'package:angren_taxi/shared/models/trip_message.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

/// In-trip passenger<->driver chat screen. Shared by both the passenger and
/// driver apps — [currentUserId] decides which side of the conversation
/// aligns right, so callers on either app pass their own logged-in user's id.
class TripChatScreen extends StatefulWidget {
  const TripChatScreen({
    super.key,
    required this.orderId,
    required this.currentUserId,
    this.chatProvider,
  });

  final String orderId;
  final String currentUserId;

  /// Injectable for tests — defaults to a [TripChatProvider] built from the
  /// service locator (same pattern as PassengerHomeScreen.sosService).
  final TripChatProvider? chatProvider;

  @override
  State<TripChatScreen> createState() => _TripChatScreenState();
}

class _TripChatScreenState extends State<TripChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  late final TripChatProvider _provider =
      widget.chatProvider ?? buildTripChatProvider();

  @override
  void initState() {
    super.initState();
    _provider.listen(widget.orderId);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _provider.loadHistory(widget.orderId).then((_) => _scrollToBottom());
    });
  }

  @override
  void dispose() {
    _provider.stopListening();
    _controller.dispose();
    _scrollController.dispose();
    if (widget.chatProvider == null) {
      _provider.dispose();
    }
    super.dispose();
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _send() {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    _provider.sendMessage(widget.orderId, text);
    _controller.clear();
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<TripChatProvider>.value(
      value: _provider,
      child: Scaffold(
        backgroundColor: kBackground,
        appBar: AppBar(
          title: const Text('Suhbat'),
          backgroundColor: kSurface,
          foregroundColor: kTextPrimary,
          elevation: 0,
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: Consumer<TripChatProvider>(
                  builder: (context, provider, _) {
                    if (provider.state == TripChatState.loading &&
                        provider.messages.isEmpty) {
                      return const LoadingWidget(message: 'Yuklanmoqda...');
                    }

                    if (provider.state == TripChatState.error &&
                        provider.messages.isEmpty) {
                      return AppErrorWidget(
                        message: provider.error ?? 'Xatolik yuz berdi',
                        onRetry: () => provider.loadHistory(widget.orderId),
                      );
                    }

                    if (provider.messages.isEmpty) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Hali xabar yo\'q. Birinchi bo\'lib yozing!',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: kTextSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      );
                    }

                    WidgetsBinding.instance
                        .addPostFrameCallback((_) => _scrollToBottom());

                    return ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.messages.length,
                      itemBuilder: (context, index) {
                        final message = provider.messages[index];
                        return _MessageBubble(
                          message: message,
                          isMe: message.senderId == widget.currentUserId,
                        );
                      },
                    );
                  },
                ),
              ),
              _Composer(controller: _controller, onSend: _send),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.isMe});

  final TripMessage message;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? kPrimary : kSurfaceGrey,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          message.body,
          style: TextStyle(
            color: isMe ? Colors.white : kTextPrimary,
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
        color: kSurface,
        boxShadow: [
          BoxShadow(
            color: kInk.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              maxLength: 500,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: 'Xabar yozing...',
                hintStyle: const TextStyle(color: kTextSecondary),
                filled: true,
                fillColor: kSurfaceGrey,
                counterText: '',
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
              decoration: const BoxDecoration(
                color: kPrimary,
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
