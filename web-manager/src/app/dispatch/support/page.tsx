'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { clsx } from 'clsx';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPhone, formatTime } from '@/lib/format';

export default function SupportPage() {
  const {
    threads,
    isLoading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useSupportThreads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

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
    <div className="h-full flex bg-bg">
      {/* Thread list */}
      <aside className="w-72 lg:w-80 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-4 py-3 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold text-ink">Qoʻllab-quvvatlash</h2>
          <p className="text-xs text-muted mt-0.5">Mijoz va haydovchi murojaatlari</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {threadsError ? (
            <ErrorState compact message={threadsError} onRetry={refetchThreads} />
          ) : threadsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : threads.length === 0 ? (
            <EmptyState
              compact
              tone="positive"
              icon={<MessageCircle size={20} />}
              title="Murojaat yoʻq"
              description="Yangi murojaat kelsa shu yerda koʻrinadi."
            />
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                className={clsx(
                  'w-full text-left rounded-xl border px-3 py-2.5 transition-colors',
                  thread.id === selectedId
                    ? 'border-primary bg-primary/[0.08]'
                    : 'border-line hover:bg-surface-2'
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar name={thread.userName} size="xs" tone="muted" />
                  <span className="text-sm font-medium text-ink truncate">{thread.userName}</span>
                  {thread.unreadCount > 0 && (
                    <Badge variant="danger" size="sm" className="ml-auto shrink-0">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-[11px] font-mono text-muted truncate">
                    {formatPhone(thread.userPhone)}
                  </span>
                  <span className="text-[11px] text-subtle shrink-0">
                    {thread.lastMessageAt ? formatTime(thread.lastMessageAt) : ''}
                  </span>
                </div>
                <Badge
                  variant={thread.status === 'open' ? 'mint-soft' : 'default'}
                  size="sm"
                  className="mt-1.5"
                >
                  {thread.status === 'open' ? 'Ochiq' : 'Yopiq'}
                </Badge>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex-1 flex flex-col min-w-0">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={<MessageCircle size={22} />}
              title="Suhbat tanlanmagan"
              description="Chapdagi roʻyxatdan murojaatni tanlang."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={selectedThread.userName} size="sm" tone="muted" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {selectedThread.userName}
                  </p>
                  <p className="text-xs text-muted truncate">
                    <span className="font-mono">{formatPhone(selectedThread.userPhone)}</span> ·{' '}
                    {selectedThread.userRole === 'driver' ? 'Haydovchi' : 'Yoʻlovchi'}
                  </p>
                </div>
              </div>
              <Button
                variant={selectedThread.status === 'open' ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleToggleStatus}
              >
                {selectedThread.status === 'open' ? 'Yopish' : 'Qayta ochish'}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messagesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-2/3 rounded-2xl" />
                  <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
                  <Skeleton className="h-10 w-3/5 rounded-2xl" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  compact
                  icon={<MessageCircle size={20} />}
                  title="Xabarlar yoʻq"
                  description="Suhbatni birinchi boʻlib boshlang."
                />
              ) : (
                messages.map((message) => {
                  const fromOperator =
                    message.senderRole === 'manager' || message.senderRole === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={clsx('flex', fromOperator ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={clsx(
                          'max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm border',
                          fromOperator
                            ? 'bg-primary/12 border-primary/30 text-ink rounded-br-sm'
                            : 'bg-surface border-line text-ink rounded-bl-sm'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className="text-[10px] text-subtle mt-1 text-right font-mono">
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-line bg-surface p-3 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder="Javob yozing…"
                  className="flex-1"
                  aria-label="Javob matni"
                />
                <Button
                  onClick={handleSend}
                  isLoading={sending}
                  disabled={!draft.trim()}
                  aria-label="Yuborish"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
