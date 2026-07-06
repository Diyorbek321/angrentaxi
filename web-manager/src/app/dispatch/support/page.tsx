'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import {
  getSupportMessages,
  sendSupportMessage,
  markSupportThreadRead,
  setSupportThreadStatus,
  SupportMessage,
  SupportThreadListItem,
} from '@/lib/api';
import { getSocket, SOCKET_EVENTS } from '@/lib/socket';
import { getAuthToken } from '@/lib/auth';
import { useSupportThreads } from '@/hooks/useSupportThreads';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

export default function SupportPage() {
  const { threads, isLoading: threadsLoading, refetch: refetchThreads } = useSupportThreads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const selectedThread: SupportThreadListItem | undefined = threads.find(
    (t) => t.id === selectedId
  );

  const selectThread = useCallback(
    (id: string) => {
      const token = getAuthToken();
      if (token && selectedIdRef.current) {
        getSocket(token).emit(SOCKET_EVENTS.LEAVE_SUPPORT_THREAD, {
          threadId: selectedIdRef.current,
        });
      }
      setSelectedId(id);
      if (token) {
        getSocket(token).emit(SOCKET_EVENTS.JOIN_SUPPORT_THREAD, { threadId: id });
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId) return;
    setMessagesLoading(true);
    getSupportMessages(selectedId)
      .then((data) => setMessages(data.messages))
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
    markSupportThreadRead(selectedId).then(refetchThreads).catch(() => {});
  }, [selectedId, refetchThreads]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const socket = getSocket(token);

    const handleNewMessage = (message: SupportMessage) => {
      if (message.threadId !== selectedIdRef.current) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    socket.on(SOCKET_EVENTS.SUPPORT_MESSAGE_NEW, handleNewMessage);
    return () => {
      socket.off(SOCKET_EVENTS.SUPPORT_MESSAGE_NEW, handleNewMessage);
    };
  }, []);

  const handleSend = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      const message = await sendSupportMessage(selectedId, draft.trim());
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setDraft('');
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedThread) return;
    const nextStatus = selectedThread.status === 'open' ? 'closed' : 'open';
    await setSupportThreadStatus(selectedThread.id, nextStatus);
    await refetchThreads();
  };

  return (
    <div className="h-full flex">
      {/* Thread list */}
      <div className="w-80 shrink-0 border-r border-white/[0.08] overflow-y-auto p-4 space-y-2">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-2">Yordam chatlari</h2>
        {threadsLoading ? (
          <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">Hozircha chatlar yo&apos;q</p>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => selectThread(thread.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                thread.id === selectedId
                  ? 'border-[#FACC15]/30 bg-[#FACC15]/10'
                  : 'border-white/[0.08] hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#F1F5F9] truncate">
                  {thread.userName}
                </span>
                {thread.unreadCount > 0 && (
                  <Badge variant="info" size="sm">
                    {thread.unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-[#94A3B8]">{thread.userPhone}</span>
                <span className="text-xs text-[#94A3B8]/70">{formatTime(thread.lastMessageAt)}</span>
              </div>
              <Badge variant={thread.status === 'open' ? 'success' : 'default'} size="sm">
                {thread.status === 'open' ? 'Ochiq' : 'Yopiq'}
              </Badge>
            </button>
          ))
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 flex flex-col">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Suhbatni tanlang</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[#F1F5F9]">{selectedThread.userName}</p>
                <p className="text-xs text-[#94A3B8]">
                  {selectedThread.userPhone} ·{' '}
                  {selectedThread.userRole === 'driver' ? 'Haydovchi' : "Yo'lovchi"}
                </p>
              </div>
              <Button
                variant={selectedThread.status === 'open' ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleStatus}
              >
                {selectedThread.status === 'open' ? 'Yopish' : 'Qayta ochish'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messagesLoading ? (
                <p className="text-sm text-[#94A3B8]">Yuklanmoqda...</p>
              ) : (
                messages.map((message) => {
                  const fromOperator =
                    message.senderRole === 'manager' || message.senderRole === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${fromOperator ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                          fromOperator
                            ? 'bg-[#FACC15]/15 text-[#F1F5F9]'
                            : 'bg-white/[0.06] text-[#F1F5F9]'
                        }`}
                      >
                        {message.body}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Card padding="sm" className="m-4 mt-0 flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Javob yozing..."
                className="flex-1"
              />
              <Button onClick={handleSend} isLoading={sending} disabled={!draft.trim()}>
                <Send size={16} />
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
